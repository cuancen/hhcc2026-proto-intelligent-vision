/**
 * 集中参数表 —— 所有业务阈值唯一出处。
 * 修改任何阈值必须：① 跑 `npm test` 回归 ② 同步 docs/PIPELINE.md 参数表 ③ 过一遍三场景。
 * 注：本产品定位为 **L2 辅助驾驶**（驾驶员始终承担监管责任），不涉及 L3 及以上自动驾驶表述。
 */
export const P = {
  /** 道路基准速度 km/h */
  roadSpeed: { city: 55, highway: 105, congested: 24 } as const,

  /** 速度修正系数（连乘） */
  speedTrim: { rain: 0.85, night: 0.92, curve: 0.94, l2Degraded: 0.85, lowEmotion: 0.96 } as const,

  /** 仿真疲劳累积速率（每仿真分钟） */
  fatigueRate: { base: 0.08, congested: 0.22, fast: 0.42 } as const,
  /** 疲劳场景加速倍率 / 休息恢复速率（每仿真分钟） */
  fatigueScenarioMult: 1.6,
  restDecay: 2.6,

  /** 疲劳分级阈值（0-100） */
  fatigueTh: { care: 60, urgent: 85 } as const,
  /** 拒绝休息后再升级间隔（仿真分钟） */
  reEscalateAfter: 6,

  /** 视觉 PERCLOS（单位时间闭眼占比）分级 */
  perclosTh: { warn: 0.25, high: 0.35 } as const,
  /** PERCLOS → 疲劳度折算系数（0.35 → 65，越过 care 阈值） */
  perclosFatigueK: 185,
  /** 视线离开分级（秒）与折算疲劳上限 */
  lookAwayTh: { warnSec: 2, escSec: 4 } as const,
  lookAwayFatigueCap: 40,

  /** 复杂路况因子 ≥ 该值屏蔽娱乐 */
  complexityBlock: 2,

  /** 情绪阈值（0-100，50 平静） */
  emotionTh: { low: 32, high: 68 } as const,

  /** 视觉情绪稳定判定与同一情绪话题冷却，避免瞬时误判和重复打扰。 */
  visionEmotion: { stableMin: 0.3, chatCd: 5 } as const,

  /** 各规则冷却（仿真分钟） */
  cd: { care: 8, urgent: 15, emotion: 10, lookWarn: 1.5, complex: 6, l2Remind: 5 } as const,

  /** 速度趋近时间常数（仿真分钟） */
  speedTau: 0.9,
} as const;

export const SCENARIOS = {
  commute: { label: 'Daily Commute', desc: 'Boarding greeting · identity · usual route · personalized cabin' },
  fatigue: { label: 'Fatigue Guard', desc: 'Vision PERCLOS + simulated workload fatigue → graded intervention' },
  complex: { label: 'Complex Roads', desc: 'Rainy night + congestion + curves → coordinated cautious mode' },
} as const;

export type ScenarioId = keyof typeof SCENARIOS;
