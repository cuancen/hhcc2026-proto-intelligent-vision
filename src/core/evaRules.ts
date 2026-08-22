import { P } from './params';
import type {
  AlertLevel,
  CabinObjectId,
  CabinObjectObservation,
  CockpitState,
  ContextStage,
  EmotionId,
  MomentTracePhase,
  OmsObservation,
  PendingChoice,
  TraceDmsMode,
} from './types';
import { complexityOf, fuseFatigue } from './sim';
import { classifyOmsRisk, createMomentTraceState, createOmsState } from './oms';

export interface EvaCtx {
  s: CockpitState;
  /** 规则冷却表：rule -> 下次可触发的仿真分钟 */
  cd: Record<string, number>;
  /** 场景脚本队列：[触发时刻, 回调] */
  q: [number, () => void][];
  ids: { chat: number; alert: number; context: number; oms: number };
  flags: {
    complexActive: boolean;
    musicBeforeBlock: CockpitState['cabin']['music'];
    /** 视觉情绪追踪：当前稳定情绪 / 起始时刻 / 已主动关怀过的情绪（防唠叨） */
    visEmo: { cur: EmotionId; since: number; chatted: EmotionId };
  };
}

export function createCtx(s: CockpitState): EvaCtx {
  return {
    s,
    cd: {},
    q: [],
    ids: { chat: 1, alert: 1, context: 1, oms: 1 },
    flags: {
      complexActive: false,
      musicBeforeBlock: 'Soft',
      visEmo: { cur: 'neutral', since: 0, chatted: 'neutral' },
    },
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function say(ctx: EvaCtx, kind: 'care' | 'warn' | 'urg' | 'sys', text: string) {
  ctx.s.chat.push({ id: ctx.ids.chat++, t: round1(ctx.s.t), role: 'eva', kind, text });
  if (ctx.s.chat.length > 200) ctx.s.chat.splice(0, ctx.s.chat.length - 200);
}

export function driverSay(ctx: EvaCtx, text: string) {
  ctx.s.chat.push({ id: ctx.ids.chat++, t: round1(ctx.s.t), role: 'driver', kind: 'sys', text });
  if (ctx.s.chat.length > 200) ctx.s.chat.splice(0, ctx.s.chat.length - 200);
}

export function alert(ctx: EvaCtx, level: AlertLevel, text: string) {
  ctx.s.alerts.push({ id: ctx.ids.alert++, t: round1(ctx.s.t), level, text });
  if (ctx.s.alerts.length > 100) ctx.s.alerts.splice(0, ctx.s.alerts.length - 100);
  if (level === 'warn') ctx.s.stats.warnAlerts++;
  if (level === 'urgent') { ctx.s.stats.urgentAlerts++; ctx.s.stats.risk++; }
}

function contextEvent(ctx: EvaCtx, stage: ContextStage, text: string) {
  ctx.s.context.events.push({ id: ctx.ids.context++, t: round1(ctx.s.t), stage, text });
  if (ctx.s.context.events.length > 40) ctx.s.context.events.splice(0, ctx.s.context.events.length - 40);
}

export function adjust(ctx: EvaCtx, fn: () => void) {
  fn();
  ctx.s.stats.cabinAdj++;
}

/** 冷却闸门：冷却期内不重复触发 */
function gate(ctx: EvaCtx, key: string, coolMin: number, fire: () => void) {
  if (ctx.s.t >= (ctx.cd[key] ?? 0)) {
    fire();
    ctx.cd[key] = ctx.s.t + coolMin;
  }
}

export function pushPending(ctx: EvaCtx, pending: PendingChoice) {
  ctx.s.pending = pending;
}

/** Accepts a transparently labeled semantic object event; no raw frame enters the core. */
export function observeCabinObject(ctx: EvaCtx, observation: CabinObjectObservation) {
  const item = {
    ...observation,
    confidence: Math.min(1, Math.max(0, observation.confidence)),
    source: 'simulated-event' as const,
    lastSeenAt: round1(ctx.s.t),
    present: true,
  };
  const index = ctx.s.context.memory.findIndex((entry) => entry.id === observation.id);
  if (index >= 0) ctx.s.context.memory[index] = item;
  else ctx.s.context.memory.push(item);
  if (['idle', 'verified', 'exit-reminded'].includes(ctx.s.context.phase)) ctx.s.context.phase = 'observed';
  ctx.s.context.resolved = false;
  contextEvent(ctx, 'See', `Simulated vision event: ${item.label} at ${item.location} (${Math.round(item.confidence * 100)}% confidence)`);
}

export function beginObjectSearch(ctx: EvaCtx, id: CabinObjectId) {
  ctx.s.context.phase = 'searching';
  ctx.s.context.targetId = id;
  ctx.s.context.cause = null;
  ctx.s.context.assistance = null;
  ctx.s.context.resolved = false;
  ctx.s.cabin.readingLight = 'Off';
}

export function requestExitCheck(ctx: EvaCtx) {
  ctx.s.context.phase = 'exit-check';
  ctx.s.context.targetId = null;
  ctx.s.context.cause = null;
  ctx.s.context.assistance = null;
  ctx.s.context.resolved = false;
}

export function beginMomentTrace(ctx: EvaCtx, dmsMode: TraceDmsMode) {
  const s = ctx.s;
  s.momentTrace = {
    phase: 'perceive',
    dmsMode,
    record: {
      createdAt: round1(s.t),
      sources: {
        dms: dmsMode === 'live' ? 'live-local' : dmsMode,
        oms: 'simulated-oms',
      },
      input: { dms: s.driver.vision ? structuredClone(s.driver.vision) : null, oms: null },
      decision: '',
      actions: [],
      verification: { omsClear: false, dmsForward: false, driverConfirmed: false },
    },
  };
}

export function setMomentTraceDmsMode(ctx: EvaCtx, mode: TraceDmsMode) {
  ctx.s.momentTrace.dmsMode = mode;
  if (ctx.s.momentTrace.record) {
    ctx.s.momentTrace.record.sources.dms = mode === 'live' ? 'live-local' : mode;
  }
}

export function setMomentTracePhase(ctx: EvaCtx, phase: MomentTracePhase) {
  const s = ctx.s;
  s.momentTrace.phase = phase;
  const record = s.momentTrace.record;
  if (!record) return;
  if (['correlate', 'decide', 'act'].includes(phase)) {
    record.input.dms = s.driver.vision ? structuredClone(s.driver.vision) : null;
    record.input.oms = s.oms.active ? structuredClone(s.oms.active) : record.input.oms;
  }
  if (phase === 'decide') {
    record.decision = 'The driver is responding to a rear-right occupant risk, not fatigue or unexplained distraction.';
  }
  if (phase === 'act') {
    record.actions = s.drive.auto
      ? ['Targeted rear-right warning', 'L2 speed reduction', 'Extended following gap', 'Driver confirmation required']
      : ['Targeted rear-right warning', 'Driver confirmation required'];
  }
  if (phase === 'verify') {
    record.verification.omsClear = s.oms.active === null;
    const vision = s.driver.vision;
    record.verification.dmsForward = !!vision?.present
      && vision.lookAwaySec < 0.1
      && Math.abs(vision.yaw) <= 22
      && Math.abs(vision.pitch) <= 18;
  }
  if (phase === 'artifact' && !record.verification.driverConfirmed) {
    record.verification.driverConfirmed = !s.oms.awaitingConfirmation;
  }
  if (phase === 'artifact') s.stats.momentTraces += 1;
}

/** 接受透明标注的 OMS 语义事件，并把风险分类与 L2 策略写回同一领域状态。 */
export function observeOms(ctx: EvaCtx, observation: OmsObservation) {
  const s = ctx.s;
  const normalized: OmsObservation = {
    ...observation,
    confidence: Math.min(1, Math.max(0, observation.confidence)),
    durationSec: Math.max(0, observation.durationSec),
    source: 'simulated-oms',
    observedAt: round1(s.t),
  };
  const risk = classifyOmsRisk(normalized, { speed: s.drive.speed, roadComplexity: complexityOf(s) });
  s.oms.active = normalized;
  s.oms.risk = risk;
  s.oms.stale = false;
  s.oms.lastUpdatedAt = s.t;
  s.oms.awaitingConfirmation = false;
  s.oms.history.push({ ...normalized, id: ctx.ids.oms++, risk });
  if (s.oms.history.length > P.oms.historyLimit) s.oms.history.splice(0, s.oms.history.length - P.oms.historyLimit);
  s.stats.omsEvents += 1;
  if (s.momentTrace.record) s.momentTrace.record.input.oms = structuredClone(normalized);

  if (risk === 'urgent') {
    s.stats.omsUrgent += 1;
    if (s.drive.auto) {
      s.oms.response.active = true;
      s.oms.response.speedCapKmh = Math.max(P.oms.minimumSpeedCapKmh, Math.round(s.drive.speed - P.oms.speedReductionKmh));
      s.oms.response.followingGap = 'extended';
      s.drive.l2Degraded = true;
      alert(ctx, 'urgent', 'Rear-right occupant outside the window — protective L2 speed and headway strategy active.');
      say(ctx, 'urg', 'Rear-right passenger, please move fully inside. I am reducing speed and extending the following distance while the driver keeps supervising the road.');
    } else {
      alert(ctx, 'urgent', 'Rear-right occupant outside the window — driver action required.');
      say(ctx, 'urg', 'Rear-right passenger, please move fully inside. Driver, reduce speed when safe and keep full control of the vehicle.');
    }
  } else if (risk === 'warning') {
    alert(ctx, 'warn', 'Possible rear-right occupant window risk — monitoring duration before escalation.');
    say(ctx, 'warn', 'I have detected movement toward the rear-right window. Please check that area while continuing to supervise the road.');
  }
}

export function clearOms(ctx: EvaCtx) {
  const s = ctx.s;
  const requiresDriverConfirmation = s.oms.risk === 'urgent' || s.oms.response.active;
  s.oms.active = null;
  s.oms.risk = 'none';
  s.oms.stale = false;
  s.oms.lastUpdatedAt = null;
  // 车辆是否执行 L2 动作不改变闭环要求：紧急 OMS 事件恢复后仍需驾驶员明确确认。
  s.oms.awaitingConfirmation = requiresDriverConfirmation;
  if (s.momentTrace.record) s.momentTrace.record.verification.omsClear = true;
  alert(ctx, 'info', 'OMS confirms the rear-right occupant is fully inside the cabin.');
  say(ctx, 'care', 'The rear-right passenger is back inside. I am checking that your attention is forward before releasing the protective strategy.');
}

export function confirmOmsClear(ctx: EvaCtx) {
  const s = ctx.s;
  if (!s.oms.awaitingConfirmation && !s.oms.response.active) return;
  s.oms.awaitingConfirmation = false;
  s.oms.response = { active: false, speedCapKmh: null, followingGap: 'normal' };
  s.drive.l2Degraded = false;
  if (s.momentTrace.record) s.momentTrace.record.verification.driverConfirmed = true;
  alert(ctx, 'info', 'Driver confirmed safe — protective strategy released.');
  say(ctx, 'care', 'Safety confirmed. Both OMS and DMS show recovery, so the temporary protection is now released.');
}

/* ------------------------------------------------------------------ */
/* 场景脚本                                                            */
/* ------------------------------------------------------------------ */

const fmtEta = (s: CockpitState) => Math.round((s.drive.routeKm / 45) * 60 + 8);

export function applyScenario(ctx: EvaCtx, id: CockpitState['scenario'], options: { announce?: boolean } = {}) {
  const s = ctx.s;
  const announce = options.announce !== false;
  // 复位场景相关状态（保留对话与统计）
  s.scenario = id;
  s.drive.rain = false;
  s.drive.night = false;
  s.drive.curve = 0;
  s.drive.leadBrake = false;
  s.drive.l2Degraded = false;
  s.cabin.entertainmentBlocked = false;
  s.cabin.readingLight = 'Off';
  s.oms = createOmsState();
  s.momentTrace = createMomentTraceState();
  ctx.flags.complexActive = false;
  ctx.q = [];
  // 脚本时刻基于当前 t 顺延，避免中途切换场景时多条播报挤在同一拍
  const at = (delay: number, fn: () => void) => ctx.q.push([s.t + delay, fn]);

  if (id === 'commute') {
    s.drive.road = 'city';
    s.drive.auto = false;
    s.drive.routeKm = 12.6;
    s.driver.simFatigue = Math.min(s.driver.simFatigue, 18);
    at(0.2, () => {
      if (announce) say(ctx, 'care', 'Good morning. Welcome back. Traffic is clear and your usual route is ready.');
      s.stats.proact++;
    });
    at(0.8, () => {
      adjust(ctx, () => { s.cabin.temp = 22.5; s.cabin.ambient = 'Teal'; s.cabin.music = 'Soft'; s.cabin.fan = 1; });
      if (announce) say(ctx, 'care', 'Your cabin is set: 22.5 degrees, teal light, and soft music.');
      s.stats.proact++;
    });
    at(1.6, () => {
      if (announce) say(ctx, 'care', `Your usual route is planned. It will take about ${fmtEta(s)} minutes to arrive.`);
      s.stats.proact++;
    });
  }

  if (id === 'fatigue') {
    s.drive.road = 'highway';
    s.drive.auto = true;
    s.drive.routeKm = 96;
    s.driver.simFatigue = Math.max(s.driver.simFatigue, 42);
    at(0.3, () => {
      if (announce) say(ctx, 'sys', 'Highway monitoring is active. I am watching blink rate, PERCLOS, and head pose while you remain in control.');
    });
  }

  if (id === 'complex') {
    s.drive.road = 'highway';
    s.drive.auto = true;
    s.drive.routeKm = 29.4;
    at(0.3, () => {
      s.drive.rain = true;
      if (announce) say(ctx, 'sys', 'Rain detected. Wipers are on, and the target speed is easing down.');
      s.stats.proact++;
    });
    at(1.2, () => {
      s.drive.road = 'congested';
      alert(ctx, 'warn', 'Congestion ahead — merging into slow traffic.');
    });
    at(1.9, () => {
      s.drive.night = true;
    });
    at(2.4, () => {
      s.drive.leadBrake = true;
      alert(ctx, 'warn', 'Lead vehicle braking hard — L2 slowed down in advance.');
    });
  }

  if (id === 'cabin-safety') {
    s.drive.road = 'highway';
    s.drive.auto = true;
    s.drive.speed = 72;
    s.drive.targetSpeed = 72;
    s.drive.routeKm = 38.4;
    s.driver.simFatigue = Math.min(s.driver.simFatigue, 18);
    s.driver.resting = false;
    at(0.2, () => {
      if (announce) say(ctx, 'sys', 'OMS MomentTrace is ready. DMS stays local, OMS events are simulated, and the driver remains responsible.');
    });
  }
}

/* ------------------------------------------------------------------ */
/* 指令解析                                                            */
/* ------------------------------------------------------------------ */

export function handleCommand(ctx: EvaCtx, raw: string): boolean {
  const s = ctx.s;
  const text = raw.trim().toLowerCase();
  if (!text) return false;
  s.stats.cmd++;
  driverSay(ctx, raw.trim());

  const has = (...kw: string[]) => kw.some((k) => text.includes(k));

  if (has('sleepy', 'tired', 'drowsy', 'dozing', 'fatigued')) {
    s.driver.simFatigue = Math.max(s.driver.simFatigue, 63);
    adjust(ctx, () => { s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan; s.cabin.temp = Math.max(20, s.cabin.temp - 1.5); s.cabin.music = 'Upbeat'; });
    say(ctx, 'care', 'Got it — boosting ventilation, lowering the temperature and switching to upbeat music to keep you fresh. If you still feel drowsy, I suggest a rest at the next service area; I can plan it for you.');
    s.stats.proact++;
    return true;
  }
  if (has('hot', 'too warm')) {
    adjust(ctx, () => { s.cabin.temp = Math.max(18, s.cabin.temp - 1.5); });
    say(ctx, 'care', `Sure — temperature lowered to ${s.cabin.temp.toFixed(1)}°C.`);
    return true;
  }
  if (has('cold', 'chilly')) {
    adjust(ctx, () => { s.cabin.temp = Math.min(30, s.cabin.temp + 1.5); });
    say(ctx, 'care', `Sure — temperature raised to ${s.cabin.temp.toFixed(1)}°C.`);
    return true;
  }
  if (has('mute', 'music off', 'stop the music', 'no music')) {
    adjust(ctx, () => { s.cabin.music = 'Off'; });
    say(ctx, 'care', 'Music off.');
    return true;
  }
  if (has('music', 'song', 'play something')) {
    const cycle: CockpitState['cabin']['music'][] = ['Soft', 'Upbeat', 'News'];
    const next = cycle[(cycle.indexOf(s.cabin.music) + 1) % cycle.length];
    adjust(ctx, () => { s.cabin.music = next; });
    say(ctx, 'care', `Switched to ${next}.`);
    return true;
  }
  if (has('massage')) {
    adjust(ctx, () => { s.cabin.seatMassage = !s.cabin.seatMassage; });
    say(ctx, 'care', `Seat massage ${s.cabin.seatMassage ? 'on' : 'off'}.`);
    return true;
  }
  if (has('nav', 'navigation', 'route', 'eta', 'how long', 'how far')) {
    say(ctx, 'care', s.drive.routeKm > 0
      ? `${s.drive.routeKm.toFixed(1)} km remaining — about ${fmtEta(s)} minutes to arrive at current speed.`
      : 'We are close to the destination.');
    return true;
  }
  if (has('rest', 'break', 'service area', 'pull over')) {
    startRest(ctx, 'Sure — found a service area 8 km ahead and entering rest mode for you.');
    return true;
  }
  if (has('enable l2', 'turn on l2', 'start l2', 'activate l2', 'l2 on')) {
    setAuto(ctx, true);
    return true;
  }
  if (has('disable l2', 'turn off l2', 'exit l2', 'stop l2', 'l2 off')) {
    setAuto(ctx, false);
    return true;
  }
  say(ctx, 'sys', "Sorry, I'm still learning. I can currently help with: temperature, music, seat massage, navigation, rest guidance and the L2 assist toggle.");
  return false;
}

export function startRest(ctx: EvaCtx, msg: string) {
  const s = ctx.s;
  // 直接通过指令进入休息（未走 pending 分支）时，清除可能滞留的紧急选择框
  s.pending = null;
  s.driver.resting = true;
  s.stats.rest = 1;
  adjust(ctx, () => {
    s.cabin.music = 'Off';
    s.cabin.seatMassage = true;
    s.cabin.ambient = 'Warm Amber';
    s.cabin.temp = 23.5;
    s.cabin.fan = 2;
  });
  say(ctx, 'care', msg);
  s.stats.proact++;
  ctx.cd.restDone = 0;
}

export function setAuto(ctx: EvaCtx, on: boolean) {
  const s = ctx.s;
  s.drive.auto = on;
  if (on) {
    say(ctx, 'sys', 'L2 assisted driving on: adaptive cruise + lane centering. Please keep supervising the road at all times, keep your hands available, and take over anytime.');
    if (fuseFatigue(s) >= P.fatigueTh.care) {
      say(ctx, 'warn', 'Heads-up: fatigue signs already detected. Use assisted driving with care, or take a rest at a service area if needed.');
    }
  } else {
    say(ctx, 'sys', 'Switched to manual driving. Eva moves to co-pilot guard mode and keeps warning you about the road.');
  }
}

export function handleReply(ctx: EvaCtx, key: string) {
  const s = ctx.s;
  if (!s.pending) return;
  const opt = s.pending.options.find((o) => o.key === key);
  s.pending = null;
  if (!opt) return;
  driverSay(ctx, opt.label);

  if (key === 'rest') {
    startRest(ctx, 'Locking in the service area 8 km ahead — entering rest mode now: seat reclined, warm ambient light, music off.');
    s.stats.risk++;
  } else if (key === 'hold') {
    say(ctx, 'warn', `Understood. If severe fatigue is still detected in ${P.reEscalateAfter} minutes, I will remind you again. Please keep the windows ventilated.`);
    // 拒绝休息：把“重度疲劳”规则的下一次可触发时刻压到 reEscalateAfter 分钟后，实现到点再升级
    ctx.cd.fat2 = s.t + P.reEscalateAfter;
  }
}

/* ------------------------------------------------------------------ */
/* 规则引擎主循环                                                      */
/* ------------------------------------------------------------------ */

function evaModeOf(s: CockpitState, complexActive: boolean): CockpitState['evaMode'] {
  if (s.oms.risk === 'urgent' || s.oms.response.active) return 'Intervening';
  if (s.oms.risk === 'warning') return 'Cautious';
  if (s.drive.l2Degraded) return 'Intervening';
  if (s.context.phase === 'assisting') return 'Intervening';
  if (s.context.phase === 'searching') return 'Guarding';
  if (s.driver.resting || s.pending) return 'Resting';
  if (complexActive) return 'Cautious';
  if (s.driver.fatigue >= P.fatigueTh.care) return 'Guarding';
  return 'Observing';
}

export function runRules(ctx: EvaCtx, dt: number) {
  const s = ctx.s;
  void dt;

  // 1) 场景脚本队列
  while (ctx.q.length && ctx.q[0][0] <= s.t) {
    ctx.q.shift()![1]();
  }

  const v = s.driver.vision;

  if (s.oms.active && s.oms.lastUpdatedAt !== null && s.t - s.oms.lastUpdatedAt >= P.oms.staleMin) {
    s.oms.stale = true;
  }

  // 2) Context loop: link eyes-off-road evidence to semantic memory, act on the cause, then verify recovery.
  const target = s.context.targetId
    ? s.context.memory.find((item) => item.id === s.context.targetId && item.present)
    : undefined;
  const traceOwnsLookAway = s.scenario === 'cabin-safety'
    && ['correlate', 'decide', 'act', 'verify'].includes(s.momentTrace.phase);
  let contextOwnsLookAway = (s.context.phase === 'assisting' && !!target) || traceOwnsLookAway;

  if (v?.present && s.context.phase === 'searching' && target && v.lookAwaySec >= P.lookAwayTh.warnSec) {
    contextOwnsLookAway = true;
    s.context.phase = 'assisting';
    s.context.cause = `The driver is looking for the ${target.label.toLowerCase()}`;
    s.context.assistance = `Give its location · Open the driver-side reading light`;
    adjust(ctx, () => { s.cabin.readingLight = 'Driver left'; });
    contextEvent(ctx, 'Understand', `Down-left gaze aligns with the search for the ${target.label.toLowerCase()}`);
    contextEvent(ctx, 'Act', `Give the ${target.label.toLowerCase()} location and illuminate the driver-side storage area`);
    alert(ctx, 'warn', `Distraction cause identified: searching for the ${target.label.toLowerCase()}. Location assistance is active.`);
    say(ctx, 'warn', `I can see you are looking for the ${target.label.toLowerCase()}. It was last seen ${target.location}. I have opened the driver-side reading light — keep supervising the road and be ready to take over.`);
    s.stats.contextAssist++;
    s.stats.proact++;
  }

  if (v?.present && s.context.phase === 'assisting' && v.lookAwaySec < 0.5) {
    s.context.phase = 'verified';
    s.context.resolved = true;
    s.context.assistance = 'Eyes forward · Risk cleared';
    adjust(ctx, () => { s.cabin.readingLight = 'Off'; });
    contextEvent(ctx, 'Verify', 'DMS confirms the driver is looking forward again; the distraction loop is closed');
    alert(ctx, 'info', 'Visual verification: eyes are back on road and the distraction risk is cleared.');
    say(ctx, 'care', 'Your eyes are back on the road. I have verified the risk is cleared and turned off the reading light. Keep supervising while L2 assistance is active.');
    s.stats.contextVerified++;
  }

  if (s.context.phase === 'exit-check') {
    const important = s.context.memory.filter((item) => item.present && item.importance === 'important');
    s.context.phase = 'exit-reminded';
    if (important.length) {
      const summary = important.map((item) => `${item.label} remains ${item.location}`).join('; ');
      s.context.assistance = `Exit reminder · ${important.length} important item${important.length > 1 ? 's' : ''}`;
      contextEvent(ctx, 'Remind', `Exit check surfaces important items only: ${summary}`);
      say(ctx, 'warn', `Before you leave: ${summary}. Ordinary items stay silent; only what matters triggers a reminder.`);
      s.stats.proact++;
    } else {
      s.context.assistance = 'Exit check complete · No important item left behind';
      contextEvent(ctx, 'Verify', 'Exit check complete; no important item was left behind');
      say(ctx, 'care', 'Exit check complete. No important item needs a reminder.');
    }
  }

  // 3) Eyes-off-road guard: generic escalation remains active outside a known context loop.
  if (v && v.present && !traceOwnsLookAway) {
    if (v.lookAwaySec >= P.lookAwayTh.escSec) {
      if (!s.drive.l2Degraded) {
        s.drive.l2Degraded = true;
        alert(ctx, 'urgent', 'Sustained eyes off the road — L2 degraded: lower target speed and longer headway. Look ahead immediately.');
        say(ctx, 'urg', 'Your eyes have been off the road for over 4 seconds — I have reduced speed and extended the following distance. Please look back at the road now.');
      }
    } else if (s.drive.l2Degraded && !s.oms.response.active && !s.oms.awaitingConfirmation && v.lookAwaySec < 0.5) {
      s.drive.l2Degraded = false;
      alert(ctx, 'info', 'Attention recovered — L2 restored to normal strategy.');
    }
    if (!contextOwnsLookAway && v.lookAwaySec >= P.lookAwayTh.warnSec && v.lookAwaySec < P.lookAwayTh.escSec) {
      gate(ctx, 'look', P.cd.lookWarn, () => {
        alert(ctx, 'warn', 'Eyes leaving the road ahead — please watch the road.');
      });
    }
  }

  if (v && !v.present) {
    gate(ctx, 'absent', 10, () => {
      alert(ctx, 'warn', 'No driver detected in view — please check your seating position.');
    });
  }

  // 2.5) 视觉情绪主动关怀：非 neutral 情绪稳定 ≥stableMin → 询问/开导/建议 + 座舱联动
  //      同一情绪只关怀一次（chatted），跨情绪话题冷却（chatCd）防唠叨
  const ve: EmotionId | null = v && v.present ? v.emotion : null;
  if (!ve || ve === 'neutral') {
    ctx.flags.visEmo.cur = 'neutral';
    ctx.flags.visEmo.since = s.t;
  } else {
    if (ctx.flags.visEmo.cur !== ve) {
      ctx.flags.visEmo.cur = ve;
      ctx.flags.visEmo.since = s.t;
    }
    if (ve !== ctx.flags.visEmo.chatted && s.t - ctx.flags.visEmo.since >= P.visionEmotion.stableMin) {
      gate(ctx, `emoChat-${ve}`, P.visionEmotion.chatCd, () => {
        if (ve === 'sad') {
          // 悲伤：开导 + 暖光轻音乐
          adjust(ctx, () => { s.cabin.ambient = 'Warm Amber'; s.cabin.music = 'Soft'; });
          say(ctx, 'care', 'You look a little down. I have warmed the ambient light and put on soft music — I am here anytime you want to talk.');
          s.stats.proact++;
        } else if (ve === 'happy') {
          // 开心：主动问好事，共享情绪（不调节座舱）
          say(ctx, 'care', 'You seem to be in a really good mood — did something nice happen? I would love to hear about it.');
        } else if (ve === 'angry') {
          // 愤怒（多为拥堵路怒）：安抚建议 + 切舒缓音乐；L2 兜底跟车
          const congested = s.drive.road === 'congested' || ctx.flags.complexActive;
          adjust(ctx, () => { if (s.cabin.music !== 'Off' && s.cabin.music !== 'Soft') s.cabin.music = 'Soft'; });
          say(ctx, 'care', congested
            ? 'Heavy traffic can be really frustrating. L2 is holding the following distance for you — take a slow deep breath; I have switched to calmer music.'
            : 'I sense some tension. Warm light and calmer music are on — safety first, we will get through this together.');
          s.stats.proact++;
        } else if (ve === 'drowsy') {
          // 困倦（情绪维度）：建议休息（与疲劳守护互补，话术不重复升级）
          say(ctx, 'care', 'Your eyes look drowsy — consider a short break at the next service area; I can plan one for you.');
        } else if (ve === 'surprised') {
          // 惊讶：轻确认，不打扰
          say(ctx, 'care', 'Everything alright? I am keeping an eye on the road together with you.');
        }
        ctx.flags.visEmo.chatted = ve;
      });
    }
  }

  // 3) 疲劳守护：双阈值（60 温柔关怀 / 85 紧急干预 + 用户选择分支）
  if (!s.driver.resting) {
    if (s.driver.fatigue >= P.fatigueTh.urgent && !s.pending) {
      gate(ctx, 'fat2', P.cd.urgent, () => {
        say(ctx, 'urg', 'You are severely fatigued (PERCLOS markedly elevated) — continuing to drive is high risk.');
        alert(ctx, 'urgent', 'Severe fatigue: entering a service area to rest is strongly advised.');
        pushPending(ctx, {
          prompt: 'Shall I plan a service area ahead and enter rest mode for you now?',
          options: [
            { key: 'rest', label: 'Rest now' },
            { key: 'hold', label: 'Keep driving' },
          ],
        });
      });
    } else if (s.driver.fatigue >= P.fatigueTh.care && !s.pending) {
      gate(ctx, 'fat1', P.cd.care, () => {
        const pc = v && v.present ? ` (PERCLOS ${(v.perclos * 100).toFixed(0)}%)` : '';
        adjust(ctx, () => {
          s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan;
          s.cabin.temp = Math.max(20, s.cabin.temp - 1.5);
          if (!ctx.flags.complexActive) s.cabin.music = s.cabin.music === 'Off' ? 'Soft' : s.cabin.music;
        });
        say(ctx, 'care', `Noticing more frequent blinks and drooping eyelids${pc} — ventilation boosted and temperature lowered${ctx.flags.complexActive ? '' : ', soft music on'}. Consider opening a window or resting at a service area.`);
        s.stats.proact++;
      });
    }
  }

  // 休息模式自动退出（与上方 !resting 分支互斥执行）
  if (s.driver.resting && s.driver.simFatigue < 15 && s.t >= (ctx.cd.restDone ?? 0)) {
    ctx.cd.restDone = s.t + 30;
    s.driver.resting = false;
    adjust(ctx, () => { s.cabin.seatMassage = false; s.cabin.ambient = 'Teal'; });
    say(ctx, 'care', 'Your condition has clearly recovered — ready to continue the trip whenever you are.');
  }

  // 4) 复杂路况：因子 ≥2 屏蔽娱乐、谨慎模式；缓解后自动恢复
  const cx = complexityOf(s);
  if (cx >= P.complexityBlock && !ctx.flags.complexActive) {
    ctx.flags.complexActive = true;
    ctx.flags.musicBeforeBlock = s.cabin.music;
    s.cabin.entertainmentBlocked = true;
    if (s.cabin.music !== 'Off') adjust(ctx, () => { s.cabin.music = 'Off'; });
    say(ctx, 'warn', 'Rainy night in congestion — complex conditions: entertainment blocked, safety announcements prioritized, cautious mode on.');
    s.stats.proact++;
  } else if (cx < P.complexityBlock && ctx.flags.complexActive) {
    ctx.flags.complexActive = false;
    s.cabin.entertainmentBlocked = false;
    adjust(ctx, () => { s.cabin.music = ctx.flags.musicBeforeBlock === 'Off' ? 'Soft' : ctx.flags.musicBeforeBlock; });
    say(ctx, 'care', 'Road conditions have eased — entertainment and regular cabin services restored.');
  }

  // 5) 情绪四联动
  if (s.driver.emotion <= P.emotionTh.low) {
    gate(ctx, 'emoLow', P.cd.emotion, () => {
      adjust(ctx, () => { s.cabin.ambient = 'Warm Amber'; s.cabin.music = 'Soft'; s.cabin.seatMassage = true; });
      say(ctx, 'care', 'Sensing low mood: ambient light warmed up, soothing music on, gentle massage started — hope it helps you relax.');
      s.stats.proact++;
    });
  } else if (s.driver.emotion >= P.emotionTh.high) {
    gate(ctx, 'emoHigh', P.cd.emotion, () => {
      adjust(ctx, () => { s.cabin.music = 'Soft'; s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan; });
      say(ctx, 'care', 'You seem excited: switched to calmer tracks and fine-tuned ventilation to keep driving steady.');
      s.stats.proact++;
    });
  }

  // 6) L2 监管提醒（L2 定位：责任始终在驾驶员）
  if (s.drive.auto && (s.driver.fatigue >= 50 || (v?.present && v.perclos >= P.perclosTh.warn))) {
    gate(ctx, 'l2Remind', P.cd.l2Remind, () => {
      alert(ctx, 'info', 'L2 reminder: please keep watching the road while assisted driving is active.');
    });
  }

  s.evaMode = evaModeOf(s, ctx.flags.complexActive);
}
