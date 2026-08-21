/**
 * 驾驶员监测（DMS）指标纯函数：零副作用、可单测。
 * 输入为 MediaPipe FaceLandmarker 的 478 点面部关键点与 4×4 变换矩阵。
 */

export interface Pt {
  x: number;
  y: number;
  z?: number;
}

/** EAR 六点法关键点索引（MediaPipe 478 mesh）：p1..p6 = [外角, 上1, 上2, 内角, 下2, 下1] */
export const EYE_RIGHT = [33, 160, 158, 133, 153, 144] as const;
export const EYE_LEFT = [362, 385, 387, 263, 373, 380] as const;

/** 眼睛睁开判定阈值（EAR 低于该值视为闭眼帧；典型睁眼 0.25-0.40） */
export const EAR_CLOSED = 0.15;

/** 头部姿态偏离阈值（度）：超出即记为视线离开 */
export const LOOK_TH = { yaw: 22, pitch: 18 } as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const deg = (r: number) => (r * 180) / Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 眼睛纵横比（EAR）：单眼六点 (|p2-p6|+|p3-p5|) / (2|p1-p4|) */
export function earOf(lms: Pt[], idx: readonly number[]): number {
  const p = idx.map((i) => lms[i]);
  const h1 = dist(p[1], p[5]);
  const h2 = dist(p[2], p[4]);
  const w = dist(p[0], p[3]);
  return w < 1e-9 ? 0 : (h1 + h2) / (2 * w);
}

/** 双眼平均 EAR */
export function bothEar(lms: Pt[]): number {
  return (earOf(lms, EYE_LEFT) + earOf(lms, EYE_RIGHT)) / 2;
}

/**
 * 头部姿态：从 facialTransformationMatrixes 的 4×4 列主序矩阵提取 yaw/pitch（度）。
 * 欧拉角 XYZ 分解：yaw = atan2(r02, r22)，pitch = asin(-r12)。
 */
export function headPoseOf(matrix?: ArrayLike<number>): { yaw: number; pitch: number } {
  if (!matrix || matrix.length < 16) return { yaw: 0, pitch: 0 };
  const r02 = matrix[8];
  const r12 = matrix[9];
  const r22 = matrix[10];
  const yaw = Math.atan2(r02, r22);
  const pitch = Math.asin(clamp(-r12, -1, 1));
  return { yaw: deg(yaw), pitch: deg(pitch) };
}

export interface PerclosState {
  /** 滑动窗口内闭眼帧占比 */
  perclos: number;
  /** 近 1 分钟眨眼次数（窗口不足按时间外推） */
  blinkPm: number;
  eyeClosed: boolean;
}

/**
 * PERCLOS 追踪器：滑动窗口统计闭眼占比与眨眼频率。
 * feed 的 t 单位为秒（单调递增即可，可用 performance.now()/1000）。
 */
export function createPerclosTracker(windowSec = 30) {
  const frames: { t: number; closed: boolean }[] = [];
  const blinks: number[] = [];
  let wasClosed = false;
  let firstT: number | null = null;

  return {
    feed(t: number, ear: number): PerclosState {
      if (firstT === null) firstT = t;
      const closed = ear < EAR_CLOSED;
      frames.push({ t, closed });
      while (frames.length && frames[0].t < t - windowSec) frames.shift();
      if (closed && !wasClosed) blinks.push(t);
      while (blinks.length && blinks[0] < t - 60) blinks.shift();
      wasClosed = closed;

      const closedN = frames.reduce((n, f) => n + (f.closed ? 1 : 0), 0);
      const span = Math.max(1e-6, Math.min(60, t - firstT));
      return {
        perclos: frames.length ? closedN / frames.length : 0,
        blinkPm: (blinks.length * 60) / span,
        eyeClosed: closed,
      };
    },
  };
}

export interface LookAwayState {
  lookAwaySec: number;
  looking: boolean;
}

/** 视线离开追踪器：头部 yaw/pitch 超阈值持续时长 */
export function createLookAwayTracker(th: { yaw: number; pitch: number } = LOOK_TH) {
  let awaySince: number | null = null;
  return {
    feed(t: number, yaw: number, pitch: number): LookAwayState {
      const away = Math.abs(yaw) > th.yaw || Math.abs(pitch) > th.pitch;
      if (away && awaySince === null) awaySince = t;
      if (!away) awaySince = null;
      return {
        lookAwaySec: awaySince === null ? 0 : Math.max(0, t - awaySince),
        looking: away,
      };
    },
  };
}
