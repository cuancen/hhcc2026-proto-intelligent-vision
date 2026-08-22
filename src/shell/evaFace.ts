import type { ChatMsg, CockpitState, EmotionId } from '../core';
import type { EvaExpression } from '../shared/evaExpression';
import type { DemoCue, DemoTransportState } from './autoDemo';

export type { EvaExpression } from '../shared/evaExpression';

/** Eva 情绪四态：驱动表情（眼睛形态 / 嘴型 / 光环色） */
export type EvaMood = 'calm' | 'care' | 'warn' | 'urgent';

const MOOD_RANK: Record<EvaMood, number> = { calm: 0, care: 1, warn: 2, urgent: 3 };

const MODE_MOOD: Record<CockpitState['evaMode'], EvaMood> = {
  Observing: 'calm',
  Guarding: 'care',
  Resting: 'care',
  Cautious: 'warn',
  Intervening: 'urgent',
};

const KIND_MOOD: Partial<Record<ChatMsg['kind'], EvaMood>> = {
  care: 'care',
  warn: 'warn',
  urg: 'urgent',
};

/** 新消息语气的表情保鲜期（仿真分钟）：过期回落到模式基调 */
export const MOOD_FRESH_MIN = 1.5;

/**
 * 情绪推导：模式基调 × 新消息语气，取更高级别（只升不降，安全优先）。
 * 紧急干预待选择（pending）期间锁定 urgent——决策时刻表情不回落。
 * sys 消息为系统播报，不参与覆盖；无消息或消息过期时仅用模式基调。
 */
export function deriveMood(
  evaMode: CockpitState['evaMode'],
  lastEva: Pick<ChatMsg, 'kind' | 't'> | null,
  now: number,
  opts?: { pending?: boolean },
): EvaMood {
  if (opts?.pending) return 'urgent';
  const base = MODE_MOOD[evaMode] ?? 'calm';
  if (!lastEva || now - lastEva.t > MOOD_FRESH_MIN) return base;
  const fromKind = KIND_MOOD[lastEva.kind];
  if (!fromKind || MOOD_RANK[fromKind] <= MOOD_RANK[base]) return base;
  return fromKind;
}

const CUE_EXPRESSION: Partial<Record<DemoCue, EvaExpression>> = {
  commute: 'calm',
  'fatigue-monitoring': 'thinking',
  'fatigue-care': 'caring',
  'fatigue-urgent': 'urgent',
  'fatigue-rest': 'confirming',
  'complex-roads': 'cautious',
  'conditions-ease': 'confirming',
  'voice-command': 'listening',
  completed: 'confirming',
};

const DRIVER_EXPRESSION: Record<EmotionId, EvaExpression> = {
  neutral: 'calm',
  happy: 'confirming',
  sad: 'caring',
  angry: 'cautious',
  surprised: 'listening',
  drowsy: 'caring',
};

/**
 * EVA 视觉表情优先级：安全锁定 → 自动剧情 → 模式语气 → 实时驾驶员表情。
 * cue 只传自动巡演步骤；手动场景传 null，确保 DMS 表情可以直接反馈。
 */
export function deriveEvaExpression(
  cue: DemoCue | null,
  mood: EvaMood,
  driverEmotion: EmotionId,
  transport: DemoTransportState,
): EvaExpression {
  if (mood === 'urgent' || cue === 'fatigue-urgent') return 'urgent';
  const fromCue = cue ? CUE_EXPRESSION[cue] : undefined;
  if (fromCue) return fromCue;
  if (transport === 'completed') return 'confirming';
  if (mood === 'warn') return 'cautious';
  if (mood === 'care') return 'caring';
  return DRIVER_EXPRESSION[driverEmotion] ?? 'calm';
}
