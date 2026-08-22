import type { CabinObjectId, CockpitState } from '../../core';
import type { DemoCue } from '../autoDemo';
import type { EvaMood } from '../evaFace';

export type TwinCameraPreset = 'hero' | 'cabin' | 'console' | 'driver' | 'gaze' | 'cause' | 'assist' | 'verify' | 'exit';
export type TwinAccent = 'neutral' | 'cause' | 'verify' | 'danger';
export type TwinGaze = 'off' | 'away' | 'cause' | 'forward';
export type TwinEvaPose = 'idle' | 'listen' | 'think' | 'act' | 'confirm' | 'alert';

export interface TwinHotspot {
  id: CabinObjectId;
  label: string;
  location: string;
  emphasis: 'normal' | 'target' | 'important' | 'verified';
}

export interface TwinFrame {
  camera: TwinCameraPreset;
  bodyOpacity: number;
  accent: TwinAccent;
  gaze: TwinGaze;
  readingLight: boolean;
  evaPose: TwinEvaPose;
  hotspots: TwinHotspot[];
}

export interface ModelFit {
  scale: number;
  position: readonly [number, number, number];
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
  };
}

const CAMERA_BY_CUE: Record<DemoCue, TwinCameraPreset> = {
  boundary: 'hero',
  'observe-cabin': 'cabin',
  'observe-phone': 'console',
  'search-intent': 'driver',
  'gaze-away': 'gaze',
  'cause-linked': 'cause',
  assistance: 'assist',
  verified: 'verify',
  'exit-filter': 'exit',
  completed: 'hero',
};

const OPACITY_BY_CUE: Record<DemoCue, number> = {
  boundary: 0.94,
  'observe-cabin': 0.3,
  'observe-phone': 0.28,
  'search-intent': 0.32,
  'gaze-away': 0.26,
  'cause-linked': 0.2,
  assistance: 0.18,
  verified: 0.36,
  'exit-filter': 0.26,
  completed: 0.9,
};

function poseOf(cue: DemoCue | null, mood: EvaMood): TwinEvaPose {
  if (cue === 'cause-linked') return 'think';
  if (cue === 'assistance') return 'act';
  if (cue === 'verified' || cue === 'completed') return 'confirm';
  if (mood === 'urgent') return 'alert';
  if (cue && cue !== 'boundary') return 'listen';
  return 'idle';
}

/** 将领域状态与稳定剧情提示压缩为 Three.js 可消费的一帧描述。 */
export function deriveTwinFrame(state: CockpitState, cue: DemoCue | null, mood: EvaMood): TwinFrame {
  const effectiveCue = cue ?? 'boundary';
  const targetId = state.context.targetId;
  const exit = effectiveCue === 'exit-filter';
  const verified = effectiveCue === 'verified' || effectiveCue === 'completed';
  const hotspots = state.context.memory
    .filter((item) => item.present)
    .map<TwinHotspot>((item) => ({
      id: item.id,
      label: item.label,
      location: item.location,
      emphasis: verified && item.id === targetId
        ? 'verified'
        : exit && item.importance === 'important'
          ? 'important'
          : item.id === targetId || (['cause-linked', 'assistance'].includes(effectiveCue) && item.id === 'parking-card')
            ? 'target'
            : 'normal',
    }));

  const accent: TwinAccent = verified
    ? 'verify'
    : ['cause-linked', 'assistance'].includes(effectiveCue)
      ? 'cause'
      : mood === 'urgent'
        ? 'danger'
        : 'neutral';

  const gaze: TwinGaze = ['search-intent', 'gaze-away'].includes(effectiveCue)
    ? 'away'
    : effectiveCue === 'cause-linked' || effectiveCue === 'assistance'
      ? 'cause'
      : verified
        ? 'forward'
        : 'off';

  return {
    camera: CAMERA_BY_CUE[effectiveCue],
    bodyOpacity: OPACITY_BY_CUE[effectiveCue],
    accent,
    gaze,
    readingLight: effectiveCue === 'assistance' || (cue === null && state.cabin.readingLight !== '关闭'),
    evaPose: poseOf(cue, mood),
    hotspots,
  };
}
