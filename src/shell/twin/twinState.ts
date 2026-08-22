import type { CockpitState } from '../../core';
import type { DemoCue } from '../autoDemo';
import type { EvaMood } from '../evaFace';

export type TwinCameraPreset = 'rearChase' | 'rainChase' | 'rearWide' | 'cabin' | 'console' | 'driver' | 'gaze' | 'cause' | 'assist' | 'verify';
export type TwinAccent = 'neutral' | 'cause' | 'verify' | 'danger';
export type TwinGaze = 'off' | 'monitor' | 'warning' | 'urgent';
export type TwinEffect = 'commute' | 'monitoring' | 'care' | 'urgent' | 'rest' | 'weather' | 'recovery' | 'voice' | 'complete';
export type TwinEnvironment = 'city' | 'highway' | 'rain-night' | 'cabin';

export interface TwinFrame {
  camera: TwinCameraPreset;
  bodyOpacity: number;
  accent: TwinAccent;
  gaze: TwinGaze;
  effect: TwinEffect;
  environment: TwinEnvironment;
  motionIntensity: number;
  braking: boolean;
}

export interface ModelFit {
  scale: number;
  position: readonly [number, number, number];
  groundY: number;
}

/** CSS 环境流动的统一冻结闸门。 */
export function isTwinMotionActive(
  frame: TwinFrame,
  running: boolean,
  reducedMotion: boolean,
  pageVisible = true,
): boolean {
  return running && pageVisible && !reducedMotion && frame.motionIntensity > 0;
}

/** 将任意模型包围盒缩放并重新居中到孪生舞台原点。 */
export function fitModelBounds(
  size: readonly [number, number, number],
  center: readonly [number, number, number],
  targetLength = 5.4,
): ModelFit {
  const scale = targetLength / Math.max(size[0], size[2], 0.001);
  return {
    scale,
    position: [-center[0] * scale, -center[1] * scale, -center[2] * scale],
    groundY: -(size[1] * scale) / 2,
  };
}

const CAMERA_BY_CUE: Record<DemoCue, TwinCameraPreset> = {
  commute: 'rearChase',
  'fatigue-monitoring': 'driver',
  'fatigue-care': 'gaze',
  'fatigue-urgent': 'cause',
  'fatigue-rest': 'cabin',
  'complex-roads': 'rainChase',
  'conditions-ease': 'rearWide',
  'voice-command': 'console',
  completed: 'rearWide',
};

const OPACITY_BY_CUE: Record<DemoCue, number> = {
  commute: 1,
  'fatigue-monitoring': 0.34,
  'fatigue-care': 0.28,
  'fatigue-urgent': 0.2,
  'fatigue-rest': 0.38,
  'complex-roads': 1,
  'conditions-ease': 1,
  'voice-command': 0.34,
  completed: 1,
};

const EFFECT_BY_CUE: Record<DemoCue, TwinEffect> = {
  commute: 'commute',
  'fatigue-monitoring': 'monitoring',
  'fatigue-care': 'care',
  'fatigue-urgent': 'urgent',
  'fatigue-rest': 'rest',
  'complex-roads': 'weather',
  'conditions-ease': 'recovery',
  'voice-command': 'voice',
  completed: 'complete',
};

const ENVIRONMENT_BY_CUE: Record<DemoCue, TwinEnvironment> = {
  commute: 'city',
  'fatigue-monitoring': 'highway',
  'fatigue-care': 'highway',
  'fatigue-urgent': 'highway',
  'fatigue-rest': 'cabin',
  'complex-roads': 'rain-night',
  'conditions-ease': 'highway',
  'voice-command': 'cabin',
  completed: 'highway',
};

const MOTION_BY_CUE: Record<DemoCue, number> = {
  commute: 0.82,
  'fatigue-monitoring': 1,
  'fatigue-care': 0.42,
  'fatigue-urgent': 0.28,
  'fatigue-rest': 0.08,
  'complex-roads': 0.9,
  'conditions-ease': 0.62,
  'voice-command': 0.16,
  completed: 0,
};

/** 将三幕提示与领域状态压缩为 Three.js 可消费的一帧描述。 */
export function deriveTwinFrame(state: CockpitState, cue: DemoCue | null, mood: EvaMood): TwinFrame {
  const effectiveCue = cue ?? (state.scenario === 'complex'
    ? 'complex-roads'
    : state.scenario === 'fatigue'
      ? 'fatigue-monitoring'
      : 'commute');
  const accent: TwinAccent = effectiveCue === 'fatigue-urgent'
    ? 'danger'
    : effectiveCue === 'complex-roads'
      ? (state.drive.leadBrake ? 'danger' : 'cause')
      : effectiveCue === 'fatigue-care'
        ? 'cause'
        : ['commute', 'fatigue-rest', 'conditions-ease', 'completed'].includes(effectiveCue)
          ? 'verify'
          : mood === 'urgent'
            ? 'danger'
            : 'neutral';

  const gaze: TwinGaze = effectiveCue === 'fatigue-monitoring'
    ? 'monitor'
    : effectiveCue === 'fatigue-care'
      ? 'warning'
      : effectiveCue === 'fatigue-urgent'
        ? 'urgent'
        : 'off';

  const speedFactor = Math.min(1, Math.max(0, state.drive.speed / 105));
  const motionIntensity = Math.round(speedFactor * MOTION_BY_CUE[effectiveCue] * 1000) / 1000;
  const camera = CAMERA_BY_CUE[effectiveCue];

  return {
    camera,
    bodyOpacity: OPACITY_BY_CUE[effectiveCue],
    accent,
    gaze,
    effect: EFFECT_BY_CUE[effectiveCue],
    environment: ENVIRONMENT_BY_CUE[effectiveCue],
    motionIntensity,
    braking: effectiveCue === 'complex-roads' && state.drive.leadBrake,
  };
}
