import { useCallback, useEffect, useRef, useState } from 'react';
import type { CockpitActions, CockpitState, VisionSample } from '../../core';
import { createDmsEngine } from '../../vision/dms';
import type { DmsStatus } from '../../vision/dms';
import { startSimVision } from '../../vision/simVision';
import type { SimVisionHandle } from '../../vision/simVision';

export type DmsMode = 'off' | 'model' | 'sim';

/**
 * 机器视觉（DMS）生命周期管理：
 * model = 摄像头 + MediaPipe 真实推理；sim = 模拟信号（链路与真实管线一致）；
 * off   = 不注入视觉。所有失败路径都安全降级，绝不影响座舱内核运行。
 */
export function useDms(act: CockpitActions, liveState: () => CockpitState) {
  const [mode, setMode] = useState<DmsMode>('off');
  const [status, setStatus] = useState<DmsStatus>({ kind: 'idle' });
  const [sample, setSample] = useState<VisionSample | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Awaited<ReturnType<typeof createDmsEngine>> | null>(null);
  const simRef = useRef<SimVisionHandle | null>(null);
  const modeRef = useRef<DmsMode>('off');
  const rafRef = useRef(0);

  const stopAll = useCallback(() => {
    simRef.current?.stop();
    simRef.current = null;
    engineRef.current?.stop();
    engineRef.current = null;
    cancelAnimationFrame(rafRef.current);
    modeRef.current = 'off';
    setMode('off');
    setSample(null);
    act.setVision(null);
  }, [act]);

  const startModel = useCallback(async () => {
    if (modeRef.current !== 'off') stopAll();
    if (!videoRef.current) return;
    modeRef.current = 'model';
    setMode('model');
    try {
      const engine = await createDmsEngine({
        onStatus: setStatus,
        onSample: (s) => {
          setSample(s);
          act.setVision(s);
        },
        onLandmarks: (pts) => {
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
      await engine.start(videoRef.current);
    } catch (e) {
      // 摄像头拒绝 / 模型不可达：自动切模拟信号，演示不中断
      modeRef.current = 'off';
      engineRef.current = null;
      setStatus({ kind: 'error', detail: e instanceof Error ? e.message : String(e) });
      setMode('off');
    }
  }, [act, stopAll]);

  const startSim = useCallback(() => {
    if (modeRef.current !== 'off') stopAll();
    modeRef.current = 'sim';
    setMode('sim');
    setStatus({ kind: 'running' });
    simRef.current = startSimVision(liveState, (s) => {
      setSample(s);
      act.setVision(s);
    });
  }, [act, liveState, stopAll]);

  useEffect(() => stopAll, [stopAll]);

  return { mode, status, sample, videoRef, canvasRef, startModel, startSim, stopAll };
}
