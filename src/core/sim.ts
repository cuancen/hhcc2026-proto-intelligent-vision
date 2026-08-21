import { P } from './params';
import type { CockpitState, RoadKind } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createState(scenario: CockpitState['scenario']): CockpitState {
  return {
    t: 0,
    scenario,
    evaMode: '观察中',
    drive: {
      auto: false,
      speed: 0,
      targetSpeed: 0,
      road: 'city',
      rain: false,
      night: false,
      curve: 0,
      leadBrake: false,
      routeKm: 29.4,
      elapsedMin: 0,
      l2Degraded: false,
    },
    driver: {
      fatigue: 0,
      simFatigue: 8,
      emotion: 52,
      resting: false,
      attention: 100,
      vision: null,
    },
    cabin: {
      temp: 24,
      fan: 1,
      music: '轻音乐',
      seatMassage: false,
      ambient: '青碧',
      entertainmentBlocked: false,
    },
    chat: [],
    alerts: [],
    pending: null,
    stats: { proact: 0, risk: 0, rest: 0, cmd: 0, cabinAdj: 0, warnAlerts: 0, urgentAlerts: 0 },
  };
}

export function roadBase(road: RoadKind): number {
  return P.roadSpeed[road];
}

/** 道路目标速度 = 基准 × 修正连乘（雨/夜/弯道/L2 降级/低情绪） */
export function targetSpeedOf(s: CockpitState): number {
  let k = 1;
  if (s.drive.rain) k *= P.speedTrim.rain;
  if (s.drive.night) k *= P.speedTrim.night;
  k *= 1 - s.drive.curve * (1 - P.speedTrim.curve);
  if (s.drive.l2Degraded) k *= P.speedTrim.l2Degraded;
  if (s.driver.emotion <= P.emotionTh.low) k *= P.speedTrim.lowEmotion;
  if (s.driver.resting) return 0;
  if (!s.drive.auto) return s.drive.road === 'city' ? P.roadSpeed.city : s.drive.road === 'highway' ? P.roadSpeed.highway : P.roadSpeed.congested;
  return roadBase(s.drive.road) * k;
}

function fatigueRateOf(s: CockpitState): number {
  const { speed, road } = s.drive;
  const base = speed > 85 ? P.fatigueRate.fast : road === 'congested' ? P.fatigueRate.congested : P.fatigueRate.base;
  const mult = s.scenario === 'fatigue' ? P.fatigueScenarioMult : 1;
  return base * mult;
}

/** 复杂度因子：雨/夜/拥堵(+前车急刹) 计数 */
export function complexityOf(s: CockpitState): number {
  let n = 0;
  if (s.drive.rain) n++;
  if (s.drive.night) n++;
  if (s.drive.road === 'congested') n++;
  return n;
}

/** 视觉与仿真双通道融合的综合疲劳度 */
export function fuseFatigue(s: CockpitState): number {
  const vision = s.driver.vision;
  let visionFatigue = 0;
  if (vision && vision.present) {
    visionFatigue = P.perclosFatigueK * vision.perclos;
    visionFatigue = Math.max(visionFatigue, Math.min(P.lookAwayFatigueCap, vision.lookAwaySec * 6));
  }
  return clamp(Math.max(s.driver.simFatigue, visionFatigue), 0, 100);
}

export function attentionOf(s: CockpitState): number {
  const v = s.driver.vision;
  if (!v || !v.present) return v && !v.present ? 0 : s.driver.resting ? 40 : 75;
  let a = 100;
  a -= clamp(v.lookAwaySec, 0, 6) * 9;
  a -= clamp(v.perclos, 0, 0.5) * 80;
  return clamp(Math.round(a), 0, 100);
}

/**
 * 仿真动力学推进一步。dt 单位：仿真分钟。
 * 零 DOM：本函数只读写 CockpitState，不触碰任何浏览器对象。
 */
export function stepSim(s: CockpitState, dt: number) {
  s.t += dt;
  s.drive.elapsedMin += dt;

  // 目标速度与速度趋近（一阶惯性）
  s.drive.targetSpeed = Math.round(targetSpeedOf(s));
  const tgt = s.drive.road === 'congested' && s.drive.auto
    ? s.drive.targetSpeed + Math.sin(s.t / 2.5) * 5 // 拥堵走走停停
    : s.drive.targetSpeed - (s.drive.leadBrake ? 22 : 0);
  const approach = 1 - Math.exp(-dt / P.speedTau);
  s.drive.speed = clamp(s.drive.speed + (tgt - s.drive.speed) * approach, 0, 140);
  if (s.drive.leadBrake && s.drive.speed < 8) s.drive.leadBrake = false;

  // 里程
  s.drive.routeKm = Math.max(0, s.drive.routeKm - (s.drive.speed / 60) * dt);

  // 弯道（复杂场景往复摆动，其余缓慢衰减）
  if (s.scenario === 'complex' && s.t > 2) {
    s.drive.curve = clamp(0.45 + Math.sin(s.t / 3.1) * 0.5, 0, 1);
  } else if (s.drive.curve > 0) {
    s.drive.curve = Math.max(0, s.drive.curve - dt * 0.3);
  }

  // 疲劳：仿真通道
  if (s.driver.resting) {
    s.driver.simFatigue = Math.max(0, s.driver.simFatigue - P.restDecay * dt);
  } else {
    s.driver.simFatigue = clamp(s.driver.simFatigue + fatigueRateOf(s) * dt, 0, 100);
  }

  // 情绪随机游走：疲劳场景缓慢走低，复杂场景更低
  const drift = (Math.sin(s.t * 1.7) + Math.sin(s.t * 0.9)) * 0.6;
  let emoTgt = 52 + drift;
  if (s.scenario === 'fatigue') emoTgt = 44 + drift * 0.7;
  if (s.scenario === 'complex') emoTgt = 38 + drift * 0.7;
  if (s.driver.resting) emoTgt = 62;
  s.driver.emotion += (emoTgt - s.driver.emotion) * Math.min(1, dt * 0.4);

  // 融合指标
  s.driver.fatigue = fuseFatigue(s);
  s.driver.attention = attentionOf(s);
}
