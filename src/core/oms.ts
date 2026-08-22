import { P } from './params';
import type {
  MomentTraceState,
  OmsBehavior,
  OmsObservation,
  OmsRisk,
  OmsState,
} from './types';

export const OMS_BEHAVIORS = [
  'unknown',
  'standing-on-seat',
  'standing',
  'lying',
  'sleeping',
  'tablet',
  'laptop',
  'phone',
  'calling',
  'reading',
  'makeup',
  'odorous-food',
  'eating',
  'drinking',
  'smoking',
  'head-outside-window',
  'body-outside-window',
  'hand-outside-window',
  'holding-pet',
  'fighting',
  'crying',
  'talking',
  'yawning',
] as const satisfies readonly OmsBehavior[];

const OUTSIDE = new Set<OmsBehavior>([
  'head-outside-window',
  'body-outside-window',
  'hand-outside-window',
]);

const ALWAYS_URGENT = new Set<OmsBehavior>([
  'standing-on-seat',
  'standing',
  'smoking',
  'fighting',
]);

const DRIVER_WARNING = new Set<OmsBehavior>([
  'tablet',
  'laptop',
  'phone',
  'calling',
  'reading',
  'makeup',
  'eating',
  'drinking',
  'holding-pet',
  'crying',
  'yawning',
]);

export interface OmsRiskContext {
  speed: number;
  roadComplexity: number;
}

/** 可审计的 OMS 风险规则；不依赖 DOM、模型或剧情序号。 */
export function classifyOmsRisk(observation: OmsObservation, context: OmsRiskContext): OmsRisk {
  if (observation.behavior === 'unknown' || observation.confidence < P.oms.minConfidence) return 'none';

  if (OUTSIDE.has(observation.behavior)) {
    return observation.durationSec >= P.oms.outsideUrgentSec ? 'urgent' : 'warning';
  }
  if (ALWAYS_URGENT.has(observation.behavior)) return 'urgent';
  if (observation.seat === 'driver' && ['lying', 'sleeping'].includes(observation.behavior)) return 'urgent';

  let risk: OmsRisk = observation.seat === 'driver' && DRIVER_WARNING.has(observation.behavior)
    ? 'warning'
    : 'care';
  if (risk === 'warning' && (context.speed >= P.oms.highwayEscalateKmh || context.roadComplexity >= 2)) risk = 'urgent';
  return risk;
}

export function createOmsState(): OmsState {
  return {
    active: null,
    risk: 'none',
    stale: false,
    lastUpdatedAt: null,
    awaitingConfirmation: false,
    response: { active: false, speedCapKmh: null, followingGap: 'normal' },
    history: [],
  };
}

export function createMomentTraceState(): MomentTraceState {
  return { phase: 'ready', dmsMode: 'replay-fallback', record: null };
}
