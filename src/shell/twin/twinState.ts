import type { CockpitState } from '../../core';
import type { DemoCue } from '../autoDemo';
import type { EvaMood } from '../evaFace';

export type TwinCameraPreset = 'rearChase' | 'rearRightChase' | 'rearRightReveal' | 'rainChase' | 'rearWide' | 'leftFrontHigh' | 'rearRightFocus' | 'cabin' | 'console' | 'driver' | 'gaze' | 'cause' | 'assist' | 'verify';
export type TwinAccent = 'neutral' | 'cause' | 'verify' | 'danger';
export type TwinGaze = 'off' | 'monitor' | 'warning' | 'urgent';
export type TwinEffect = 'commute' | 'monitoring' | 'care' | 'urgent' | 'rest' | 'weather' | 'recovery' | 'voice' | 'oms-perceive' | 'oms-correlate' | 'oms-verify' | 'moment-trace' | 'complete';
export type TwinEnvironment = 'city' | 'highway' | 'rain-night' | 'cabin';
export type TwinOmsMarker = 'off' | 'care' | 'urgent' | 'clear';

export interface TwinFrame {
  camera: TwinCameraPreset;
  bodyOpacity: number;
  accent: TwinAccent;
  gaze: TwinGaze;
  effect: TwinEffect;
  environment: TwinEnvironment;
  motionIntensity: number;
  braking: boolean;
  omsMarker: TwinOmsMarker;
  correlation: boolean;
  traceArtifact: boolean;
}

/** 只有机位身份变化才属于剧情切镜；车速/FOV/语义状态变化都应在当前机位内连续收敛。 */
export function cameraCutKey(frame: TwinFrame): TwinCameraPreset {
  return frame.camera;
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
  'oms-cruise': 'rearChase',
  'oms-candidate': 'rearRightReveal',
  'oms-prompt': 'rearRightChase',
  'oms-correlate': 'leftFrontHigh',
  'oms-decide': 'leftFrontHigh',
  'oms-urgent': 'rearRightFocus',
  'oms-clear': 'rearRightFocus',
  'oms-verify': 'rearWide',
  'moment-trace': 'rearWide',
  commute: 'rearChase',
  'fatigue-monitoring': 'driver',
  'fatigue-care': 'gaze',
  'fatigue-urgent': 'cause',
  'fatigue-rest': 'cabin',
  'complex-roads': 'rainChase',
  'conditions-ease': 'rearWide',
  'voice-command': 'console',
  'cabin-memory': 'cabin',
  completed: 'rearWide',
};

const OPACITY_BY_CUE: Record<DemoCue, number> = {
  'oms-cruise': 1,
  'oms-candidate': 0.56,
  'oms-prompt': 1,
  'oms-correlate': 0.24,
  'oms-decide': 0.24,
  'oms-urgent': 0.42,
  'oms-clear': 0.48,
  'oms-verify': 1,
  'moment-trace': 1,
  commute: 1,
  'fatigue-monitoring': 0.34,
  'fatigue-care': 0.28,
  'fatigue-urgent': 0.2,
  'fatigue-rest': 0.38,
  'complex-roads': 1,
  'conditions-ease': 1,
  'voice-command': 0.34,
  'cabin-memory': 0.34,
  completed: 1,
};

const EFFECT_BY_CUE: Record<DemoCue, TwinEffect> = {
  'oms-cruise': 'oms-perceive',
  'oms-candidate': 'oms-perceive',
  'oms-prompt': 'oms-perceive',
  'oms-correlate': 'oms-correlate',
  'oms-decide': 'oms-correlate',
  'oms-urgent': 'urgent',
  'oms-clear': 'oms-verify',
  'oms-verify': 'oms-verify',
  'moment-trace': 'moment-trace',
  commute: 'commute',
  'fatigue-monitoring': 'monitoring',
  'fatigue-care': 'care',
  'fatigue-urgent': 'urgent',
  'fatigue-rest': 'rest',
  'complex-roads': 'weather',
  'conditions-ease': 'recovery',
  'voice-command': 'voice',
  'cabin-memory': 'voice',
  completed: 'complete',
};

const ENVIRONMENT_BY_CUE: Record<DemoCue, TwinEnvironment> = {
  'oms-cruise': 'highway',
  'oms-candidate': 'highway',
  'oms-prompt': 'highway',
  'oms-correlate': 'cabin',
  'oms-decide': 'cabin',
  'oms-urgent': 'highway',
  'oms-clear': 'highway',
  'oms-verify': 'highway',
  'moment-trace': 'highway',
  commute: 'city',
  'fatigue-monitoring': 'highway',
  'fatigue-care': 'highway',
  'fatigue-urgent': 'highway',
  'fatigue-rest': 'cabin',
  'complex-roads': 'rain-night',
  'conditions-ease': 'highway',
  'voice-command': 'cabin',
  'cabin-memory': 'cabin',
  completed: 'highway',
};

const MOTION_BY_CUE: Record<DemoCue, number> = {
  'oms-cruise': 0.78,
  'oms-candidate': 0.62,
  'oms-prompt': 0.72,
  'oms-correlate': 0.18,
  'oms-decide': 0.14,
  'oms-urgent': 0.34,
  'oms-clear': 0.44,
  'oms-verify': 0.58,
  'moment-trace': 0,
  commute: 0.82,
  'fatigue-monitoring': 1,
  'fatigue-care': 0.42,
  'fatigue-urgent': 0.28,
  'fatigue-rest': 0.08,
  'complex-roads': 0.9,
  'conditions-ease': 0.62,
  'voice-command': 0.16,
  'cabin-memory': 0.08,
  completed: 0,
};

/** 将三幕提示与领域状态压缩为 Three.js 可消费的一帧描述。 */
export function deriveTwinFrame(state: CockpitState, cue: DemoCue | null, mood: EvaMood): TwinFrame {
  const effectiveCue: DemoCue = cue ?? (state.scenario === 'cabin-safety'
    ? 'oms-cruise'
    : state.scenario === 'complex'
      ? 'complex-roads'
      : state.scenario === 'fatigue'
        ? 'fatigue-monitoring'
        : 'commute');
  const accent: TwinAccent = ['fatigue-urgent', 'oms-urgent'].includes(effectiveCue)
    ? 'danger'
    : effectiveCue === 'complex-roads'
      ? (state.drive.leadBrake ? 'danger' : 'cause')
      : ['fatigue-care', 'oms-candidate', 'oms-prompt', 'oms-correlate', 'oms-decide'].includes(effectiveCue)
        ? 'cause'
        : ['commute', 'fatigue-rest', 'conditions-ease', 'oms-clear', 'oms-verify', 'moment-trace', 'completed'].includes(effectiveCue)
          ? 'verify'
          : mood === 'urgent'
            ? 'danger'
            : 'neutral';

  const gaze: TwinGaze = effectiveCue === 'fatigue-monitoring'
    ? 'monitor'
    : ['fatigue-care', 'oms-correlate', 'oms-decide'].includes(effectiveCue)
      ? 'warning'
      : ['fatigue-urgent', 'oms-urgent'].includes(effectiveCue)
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
    braking: (effectiveCue === 'complex-roads' && state.drive.leadBrake) || (effectiveCue === 'oms-urgent' && state.oms.response.active),
    omsMarker: ['oms-candidate', 'oms-prompt', 'oms-correlate', 'oms-decide'].includes(effectiveCue)
      ? 'care'
      : effectiveCue === 'oms-urgent'
        ? 'urgent'
        : ['oms-clear', 'oms-verify'].includes(effectiveCue)
          ? 'clear'
          : 'off',
    correlation: ['oms-correlate', 'oms-decide', 'oms-urgent'].includes(effectiveCue),
    traceArtifact: effectiveCue === 'moment-trace' || (effectiveCue === 'completed' && state.momentTrace.record !== null),
  };
}
