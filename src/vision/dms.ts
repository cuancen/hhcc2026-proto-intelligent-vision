/**
 * 机器视觉引擎：MediaPipe FaceLandmarker（浏览器端 WASM/GPU 推理）。
 * 稳定性设计：
 *  - WASM 运行时多源容灾：本地自托管 → jsDelivr → unpkg
 *  - 模型多源容灾：本地自托管 → Google 官方源
 *  - GPU 委托失败自动回退 CPU
 *  - 任何失败都不抛出到 UI 层：以 status 事件上报，由上层决定是否切模拟信号
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { bothEar, classifyEmotion, createEmotionSmoother, createLookAwayTracker, createPerclosTracker, headPoseOf } from './metrics';
import type { VisionSample } from '../core';

const MP_VERSION = '0.10.35';

const WASM_SOURCES = [
  `${import.meta.env.BASE_URL}mediapipe-wasm`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MP_VERSION}/wasm`,
];

const MODEL_SOURCES = [
  `${import.meta.env.BASE_URL}models/face_landmarker.task`,
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
];

export type DmsStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; detail: string }
  | { kind: 'running' }
  | { kind: 'error'; detail: string };

export interface DmsEngine {
  status: DmsStatus;
  start(video: HTMLVideoElement): Promise<void>;
  stop(): void;
}

export interface DmsCallbacks {
  onStatus(st: DmsStatus): void;
  /** 每个采样周期输出的融合视觉信号（写入座舱内核） */
  onSample(sample: VisionSample): void;
  /** 每帧关键点（叠加层绘制用；无人脸时为 null） */
  onLandmarks(pts: { x: number; y: number }[] | null): void;
}

async function firstOk<T>(sources: string[], open: (src: string) => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (const src of sources) {
    try {
      const r = await open(src);
      return r;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`${label}: all sources failed — ${String(lastErr)}`);
}

export async function createDmsEngine(cb: DmsCallbacks): Promise<DmsEngine> {
  let status: DmsStatus = { kind: 'idle' };
  let landmarker: FaceLandmarker | null = null;
  let stream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | null = null;
  let loopId = 0;
  let running = false;

  const setStatus = (st: DmsStatus) => {
    status = st;
    cb.onStatus(st);
  };

  return {
    get status() {
      return status;
    },

    async start(video: HTMLVideoElement) {
      setStatus({ kind: 'loading', detail: 'Requesting camera…' });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      videoEl = video;
      video.srcObject = stream;
      await video.play();

      setStatus({ kind: 'loading', detail: 'Loading vision model (local source first)…' });
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await firstOk(
        WASM_SOURCES,
        (p) => vision.FilesetResolver.forVisionTasks(p),
        'WASM runtime',
      );

      const tryCreate = (delegate: 'GPU' | 'CPU') =>
        firstOk(
          MODEL_SOURCES,
          (modelAssetPath) =>
            vision.FaceLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath, delegate },
              runningMode: 'VIDEO',
              numFaces: 1,
              outputFacialTransformationMatrixes: true,
              outputFaceBlendshapes: true, // 情绪分类复用同一模型，零额外开销
            }),
          `model(${delegate})`,
        );

      try {
        landmarker = await tryCreate('GPU');
      } catch {
        landmarker = await tryCreate('CPU');
      }

      // 指标追踪器（与模拟信号共用同一套纯函数管线）
      const perclos = createPerclosTracker(30);
      const lookAway = createLookAwayTracker();
      const emotionSmooth = createEmotionSmoother(10);
      let lastEmit = 0;
      let lastVideoTs = -1;
      running = true;
      setStatus({ kind: 'running' });

      const loop = () => {
        if (!running || !landmarker || !videoEl) return;
        loopId = requestAnimationFrame(loop);
        const now = performance.now();
        if (videoEl.readyState < 2) return;
        const ts = videoEl.currentTime;
        if (ts === lastVideoTs) return; // 同一帧不重复推理
        lastVideoTs = ts;

        let result;
        try {
          result = landmarker.detectForVideo(videoEl, now);
        } catch {
          return; // 偶发推理错误：跳过本帧，不中断
        }
        const face = result.faceLandmarks?.[0];
        cb.onLandmarks(face ?? null);

        const tSec = now / 1000;
        const matrix = result.facialTransformationMatrixes?.[0]?.data;
        const { yaw, pitch } = headPoseOf(matrix);
        const ear = face ? bothEar(face) : 0;
        const p = perclos.feed(tSec, face ? ear : 0.3);
        const la = lookAway.feed(tSec, face ? yaw : 0, face ? pitch : 0);

        // 情绪分类：blendshapes → 加权启发式 → 多数投票平滑
        const bsCats = result.faceBlendshapes?.[0]?.categories;
        const bs: Record<string, number> = {};
        if (bsCats) for (const c of bsCats) bs[c.categoryName as string] = c.score;
        const emotion = emotionSmooth.feed(face ? classifyEmotion(bs).id : 'neutral');

        // 采样节流：≥100ms 向内核发一次
        if (now - lastEmit >= 100) {
          lastEmit = now;
          cb.onSample({
            present: !!face,
            perclos: p.perclos,
            blinkPm: p.blinkPm,
            lookAwaySec: face ? la.lookAwaySec : 0,
            yaw,
            pitch,
            ear,
            emotion,
            source: 'model',
          });
        }
      };
      loopId = requestAnimationFrame(loop);
    },

    stop() {
      running = false;
      cancelAnimationFrame(loopId);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      landmarker?.close();
      landmarker = null;
      videoEl = null;
      cb.onLandmarks(null);
      setStatus({ kind: 'idle' });
    },
  };
}
