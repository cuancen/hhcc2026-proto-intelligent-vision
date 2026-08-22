import { useCallback, useEffect, useRef, useState } from 'react';
import type { CockpitActions, CockpitState, VisionSample } from '../../core';
import { createDmsEngine } from '../../vision/dms';
import type { DmsStatus } from '../../vision/dms';
import type { DmsMediaInput } from '../../vision/dms';
import { startSimVision } from '../../vision/simVision';
import type { SimVisionHandle } from '../../vision/simVision';
import { createObjectUrlLease, validateLocalDmsVideo } from '../localVideo';

export type DmsMode = 'off' | 'model' | 'video' | 'sim' | 'replay';

export interface LocalDmsVideo {
  name: string;
  size: number;
  type: string;
}

/**
 * 机器视觉（DMS）生命周期管理：
 * model = 摄像头 + MediaPipe 真实推理；video = 本地视频 + 同一 MediaPipe 推理；
 * sim = 模拟信号（链路与真实管线一致）；off = 不注入视觉。
 * 所有失败路径都安全降级，绝不影响座舱内核运行。
 */
export function useDms(act: CockpitActions, liveState: () => CockpitState) {
  const [mode, setMode] = useState<DmsMode>('off');
  const [status, setStatus] = useState<DmsStatus>({ kind: 'idle' });
  const [sample, setSample] = useState<VisionSample | null>(null);
  const [localVideo, setLocalVideo] = useState<LocalDmsVideo | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Awaited<ReturnType<typeof createDmsEngine>> | null>(null);
  const simRef = useRef<SimVisionHandle | null>(null);
  const modeRef = useRef<DmsMode>('off');
  const sampleRef = useRef<VisionSample | null>(null);
  const generationRef = useRef(0);
  const rafRef = useRef(0);
  const objectUrlRef = useRef<ReturnType<typeof createObjectUrlLease> | null>(null);

  const stopAll = useCallback(() => {
    generationRef.current += 1;
    simRef.current?.stop();
    simRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    cancelAnimationFrame(rafRef.current);
    objectUrlRef.current?.release();
    objectUrlRef.current = null;
    modeRef.current = 'off';
    setMode('off');
    setStatus({ kind: 'idle' });
    setSample(null);
    setLocalVideo(null);
    setInputError(null);
    sampleRef.current = null;
    act.setVision(null);
  }, [act]);

  const startInference = useCallback(async (
    nextMode: 'model' | 'video',
    makeInput: () => DmsMediaInput,
    fileMeta: LocalDmsVideo | null = null,
  ): Promise<boolean> => {
    stopAll();
    if (!videoRef.current) return false;
    const generation = ++generationRef.current;
    const input = makeInput();
    modeRef.current = nextMode;
    setMode(nextMode);
    setLocalVideo(fileMeta);
    setInputError(null);
    try {
      const engine = await createDmsEngine({
        onStatus: setStatus,
        onSample: (s) => {
          if (generationRef.current !== generation) return;
          sampleRef.current = s;
          setSample(s);
          act.setVision(s);
        },
        onLandmarks: (pts) => {
          if (generationRef.current !== generation) return;
          // 叠加层绘制：稀疏关键点 + 眼部轮廓（canvas 与 video 同被 CSS 镜像）
          const cv = canvasRef.current;
          if (!cv) return;
          const ctx = cv.getContext('2d');
          if (!ctx) return;
          if (cv.width !== cv.clientWidth || cv.height !== cv.clientHeight) {
            cv.width = cv.clientWidth;
            cv.height = cv.clientHeight;
          }
          ctx.clearRect(0, 0, cv.width, cv.height);
          if (!pts) return;
          ctx.fillStyle = 'rgba(45, 212, 191, 0.85)';
          for (let i = 0; i < pts.length; i += 7) {
            const p = pts[i];
            ctx.fillRect(p.x * cv.width - 0.5, p.y * cv.height - 0.5, 1.6, 1.6);
          }
          // 眼部重点标记
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
          ctx.lineWidth = 1.6;
          for (const idx of [33, 133, 159, 145, 362, 263, 386, 374]) {
            const p = pts[idx];
            if (!p) continue;
            ctx.beginPath();
            ctx.arc(p.x * cv.width, p.y * cv.height, 4, 0, Math.PI * 2);
            ctx.stroke();
          }
        },
      });
      engineRef.current = engine;
      await engine.start(videoRef.current, input);
      if (generationRef.current !== generation) {
        engine.stop();
        return false;
      }
      return true;
    } catch (e) {
      if (generationRef.current !== generation) return false;
      engineRef.current?.stop();
      modeRef.current = 'off';
      engineRef.current = null;
      objectUrlRef.current?.release();
      objectUrlRef.current = null;
      setLocalVideo(null);
      setStatus({ kind: 'error', detail: e instanceof Error ? e.message : String(e) });
      setMode('off');
      setSample(null);
      sampleRef.current = null;
      act.setVision(null);
      return false;
    }
  }, [act, stopAll]);

  const startModel = useCallback(
    () => startInference('model', () => ({ kind: 'camera' })),
    [startInference],
  );

  const startVideo = useCallback((file: File): Promise<boolean> => {
    const validationError = validateLocalDmsVideo(file);
    if (validationError) {
      setInputError(validationError);
      return Promise.resolve(false);
    }
    return startInference('video', () => {
      const lease = createObjectUrlLease(file);
      objectUrlRef.current = lease;
      return { kind: 'video', url: lease.url };
    }, { name: file.name, size: file.size, type: file.type });
  }, [startInference]);

  const startSignal = useCallback((nextMode: 'sim' | 'replay') => {
    if (modeRef.current !== 'off') stopAll();
    modeRef.current = nextMode;
    setMode(nextMode);
    setStatus({ kind: 'running' });
    simRef.current = startSimVision(liveState, (s) => {
      sampleRef.current = s;
      setSample(s);
      act.setVision(s);
    });
  }, [act, liveState, stopAll]);

  const startSim = useCallback(() => startSignal('sim'), [startSignal]);
  const startReplay = useCallback(() => startSignal('replay'), [startSignal]);

  useEffect(() => stopAll, [stopAll]);

  const getMode = useCallback(() => modeRef.current, []);
  const getSample = useCallback(() => sampleRef.current, []);

  return {
    mode,
    status,
    sample,
    localVideo,
    inputError,
    videoRef,
    canvasRef,
    startModel,
    startVideo,
    startSim,
    startReplay,
    stopAll,
    getMode,
    getSample,
  };
}
