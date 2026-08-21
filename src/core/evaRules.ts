import { P } from './params';
import type { AlertLevel, CockpitState, PendingChoice } from './types';
import { complexityOf, fuseFatigue } from './sim';

export interface EvaCtx {
  s: CockpitState;
  /** 规则冷却表：rule -> 下次可触发的仿真分钟 */
  cd: Record<string, number>;
  /** 场景脚本队列：[触发时刻, 回调] */
  q: [number, () => void][];
  ids: { chat: number; alert: number };
  flags: { complexActive: boolean; musicBeforeBlock: CockpitState['cabin']['music'] };
}

export function createCtx(s: CockpitState): EvaCtx {
  return { s, cd: {}, q: [], ids: { chat: 1, alert: 1 }, flags: { complexActive: false, musicBeforeBlock: '轻音乐' } };
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

/* ------------------------------------------------------------------ */
/* 场景脚本                                                            */
/* ------------------------------------------------------------------ */

const fmtEta = (s: CockpitState) => Math.round((s.drive.routeKm / 45) * 60 + 8);

export function applyScenario(ctx: EvaCtx, id: CockpitState['scenario']) {
  const s = ctx.s;
  // 复位场景相关状态（保留对话与统计）
  s.scenario = id;
  s.drive.rain = false;
  s.drive.night = false;
  s.drive.curve = 0;
  s.drive.leadBrake = false;
  s.drive.l2Degraded = false;
  s.cabin.entertainmentBlocked = false;
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
      say(ctx, 'care', '早上好！欢迎上车，已通过人脸识别确认是您。今天路况整体畅通。');
      s.stats.proact++;
    });
    at(0.7, () => {
      adjust(ctx, () => { s.cabin.temp = 22.5; s.cabin.ambient = '青碧'; s.cabin.music = '轻音乐'; s.cabin.fan = 1; });
      say(ctx, 'care', '已按您的习惯调节座舱：22.5℃、青碧氛围灯、轻音乐。');
      s.stats.proact++;
    });
    at(1.4, () => {
      say(ctx, 'care', `已沿常用路线规划导航，全程 ${s.drive.routeKm.toFixed(1)} 公里，预计 ${fmtEta(s)} 分钟到达。`);
      s.stats.proact++;
    });
  }

  if (id === 'fatigue') {
    s.drive.road = 'highway';
    s.drive.auto = true;
    s.drive.routeKm = 96;
    s.driver.simFatigue = Math.max(s.driver.simFatigue, 42);
    at(0.3, () => {
      say(ctx, 'sys', '长途高速工况：Eva 已加强视觉监测（眨眼频率 / PERCLOS 闭眼占比 / 头部姿态）。L2 辅助驾驶中，请您保持监管。');
    });
  }

  if (id === 'complex') {
    s.drive.road = 'highway';
    s.drive.auto = true;
    s.drive.routeKm = 29.4;
    at(0.3, () => {
      s.drive.rain = true;
      say(ctx, 'sys', '雨感信号：雨刷已自动开启，能见度下降，已同步修正目标车速。');
      s.stats.proact++;
    });
    at(1.2, () => {
      s.drive.road = 'congested';
      alert(ctx, 'warn', '前方拥堵，已汇入缓行车流。');
    });
    at(2.2, () => {
      s.drive.night = true;
      say(ctx, 'sys', '进入夜雨工况，大灯与仪表已切换夜间主题。');
    });
    at(4.2, () => {
      s.drive.leadBrake = true;
      alert(ctx, 'warn', '前车急刹，L2 已提前减速。');
    });
  }
}

/* ------------------------------------------------------------------ */
/* 指令解析                                                            */
/* ------------------------------------------------------------------ */

export function handleCommand(ctx: EvaCtx, raw: string): boolean {
  const s = ctx.s;
  const text = raw.trim();
  if (!text) return false;
  s.stats.cmd++;
  driverSay(ctx, text);

  const has = (...kw: string[]) => kw.some((k) => text.includes(k));

  if (has('困', '累', '瞌睡', '犯乏')) {
    s.driver.simFatigue = Math.max(s.driver.simFatigue, 63);
    adjust(ctx, () => { s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan; s.cabin.temp = Math.max(20, s.cabin.temp - 1.5); s.cabin.music = '动感'; });
    say(ctx, 'care', '收到，已为您加强通风、调低温度并切换动感音乐提神。若仍然困倦，建议在前方服务区休息，我可以帮您规划。');
    s.stats.proact++;
    return true;
  }
  if (has('热')) {
    adjust(ctx, () => { s.cabin.temp = Math.max(18, s.cabin.temp - 1.5); });
    say(ctx, 'care', `好的，已调低至 ${s.cabin.temp.toFixed(1)}℃。`);
    return true;
  }
  if (has('冷')) {
    adjust(ctx, () => { s.cabin.temp = Math.min(30, s.cabin.temp + 1.5); });
    say(ctx, 'care', `好的，已调高至 ${s.cabin.temp.toFixed(1)}℃。`);
    return true;
  }
  if (has('静音', '关掉音乐', '关闭音乐', '别放了')) {
    adjust(ctx, () => { s.cabin.music = '关闭'; });
    say(ctx, 'care', '音乐已关闭。');
    return true;
  }
  if (has('音乐', '歌', '来点')) {
    const cycle: CockpitState['cabin']['music'][] = ['轻音乐', '动感', '新闻'];
    const next = cycle[(cycle.indexOf(s.cabin.music) + 1) % cycle.length];
    adjust(ctx, () => { s.cabin.music = next; });
    say(ctx, 'care', `已切换到${next}。`);
    return true;
  }
  if (has('按摩')) {
    adjust(ctx, () => { s.cabin.seatMassage = !s.cabin.seatMassage; });
    say(ctx, 'care', `座椅按摩已${s.cabin.seatMassage ? '开启' : '关闭'}。`);
    return true;
  }
  if (has('导航', '路线', '多久', '还有多远')) {
    say(ctx, 'care', s.drive.routeKm > 0
      ? `剩余 ${s.drive.routeKm.toFixed(1)} 公里，按当前车速预计 ${fmtEta(s)} 分钟到达。`
      : '我们已到达目的地附近。');
    return true;
  }
  if (has('休息', '服务区', '停车')) {
    startRest(ctx, '好的，已为您寻找前方 8 公里处的服务区并进入休息模式。');
    return true;
  }
  if (has('开启辅助', '打开辅助', '开启l2', '打开l2')) {
    setAuto(ctx, true);
    return true;
  }
  if (has('关闭辅助', '退出辅助', '关闭l2', '退出l2')) {
    setAuto(ctx, false);
    return true;
  }
  say(ctx, 'sys', '抱歉，我还在学习中。目前支持：冷热调节、音乐、座椅按摩、导航、休息引导与 L2 辅助开关。');
  return false;
}

export function startRest(ctx: EvaCtx, msg: string) {
  const s = ctx.s;
  s.driver.resting = true;
  s.stats.rest = 1;
  adjust(ctx, () => {
    s.cabin.music = '关闭';
    s.cabin.seatMassage = true;
    s.cabin.ambient = '暖橙';
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
    say(ctx, 'sys', 'L2 辅助驾驶已开启：自适应巡航 + 车道居中。请您始终监管路况，双手不要长时间离开方向盘，可随时接管。');
    if (fuseFatigue(s) >= P.fatigueTh.care) {
      say(ctx, 'warn', '提示：当前已监测到疲劳迹象，建议谨慎使用辅助驾驶，必要时进入服务区休息。');
    }
  } else {
    say(ctx, 'sys', '已切换为人工驾驶，Eva 转为副驾守护模式，随时为您预警路况。');
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
    startRest(ctx, '好的，已锁定前方 8 公里服务区，现在为您进入休息模式：座椅放倒、氛围灯调暖、音乐关闭。');
    s.stats.risk++;
  } else if (key === 'hold') {
    say(ctx, 'warn', `明白。${P.reEscalateAfter} 分钟后若仍监测到重度疲劳，我会再次提醒您。请保持车窗通风。`);
    // 拒绝休息：把“重度疲劳”规则的下一次可触发时刻压到 reEscalateAfter 分钟后，实现到点再升级
    ctx.cd.fat2 = s.t + P.reEscalateAfter;
  }
}

/* ------------------------------------------------------------------ */
/* 规则引擎主循环                                                      */
/* ------------------------------------------------------------------ */

function evaModeOf(s: CockpitState, complexActive: boolean): CockpitState['evaMode'] {
  if (s.drive.l2Degraded) return '干预中';
  if (s.driver.resting || s.pending) return '休息引导中';
  if (complexActive) return '谨慎模式';
  if (s.driver.fatigue >= P.fatigueTh.care) return '守护中';
  return '观察中';
}

export function runRules(ctx: EvaCtx, dt: number) {
  const s = ctx.s;
  void dt;

  // 1) 场景脚本队列
  while (ctx.q.length && ctx.q[0][0] <= s.t) {
    ctx.q.shift()![1]();
  }

  const v = s.driver.vision;

  // 2) 分神守护：视觉通道视线离开分级 → L2 降级
  if (v && v.present) {
    if (v.lookAwaySec >= P.lookAwayTh.escSec) {
      if (!s.drive.l2Degraded) {
        s.drive.l2Degraded = true;
        alert(ctx, 'urgent', '持续视线离开路面，L2 已降级：降低目标车速并拉大跟车时距，请立即观察前方。');
        say(ctx, 'urg', '我检测到您已持续视线离开超过 4 秒，已主动降低车速、拉大跟车距离。请立即回看路面。');
      }
    } else if (s.drive.l2Degraded && v.lookAwaySec < 0.5) {
      s.drive.l2Degraded = false;
      alert(ctx, 'info', '注意力恢复，L2 恢复常规策略。');
    }
    if (v.lookAwaySec >= P.lookAwayTh.warnSec && v.lookAwaySec < P.lookAwayTh.escSec) {
      gate(ctx, 'look', P.cd.lookWarn, () => {
        alert(ctx, 'warn', '检测到视线离开前方，请注意路面。');
      });
    }
  }

  if (v && !v.present) {
    gate(ctx, 'absent', 10, () => {
      alert(ctx, 'warn', '视觉范围内未检测到驾驶员，请确认坐姿。');
    });
  }

  // 3) 疲劳守护：双阈值（60 温柔关怀 / 85 紧急干预 + 用户选择分支）
  if (!s.driver.resting) {
    if (s.driver.fatigue >= P.fatigueTh.urgent && !s.pending) {
      gate(ctx, 'fat2', P.cd.urgent, () => {
        say(ctx, 'urg', '您已处于重度疲劳状态（PERCLOS 显著升高），继续驾驶风险很高。');
        alert(ctx, 'urgent', '重度疲劳：建议立即进入服务区休息。');
        pushPending(ctx, {
          prompt: '需要我现在为您规划前方服务区并进入休息模式吗？',
          options: [
            { key: 'rest', label: '立即休息' },
            { key: 'hold', label: '再坚持一会儿' },
          ],
        });
      });
    } else if (s.driver.fatigue >= P.fatigueTh.care) {
      gate(ctx, 'fat1', P.cd.care, () => {
        const pc = v && v.present ? `（PERCLOS ${(v.perclos * 100).toFixed(0)}%）` : '';
        adjust(ctx, () => {
          s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan;
          s.cabin.temp = Math.max(20, s.cabin.temp - 1.5);
          if (!ctx.flags.complexActive) s.cabin.music = s.cabin.music === '关闭' ? '轻音乐' : s.cabin.music;
        });
        say(ctx, 'care', `注意到您眨眼变频繁、眼睑下垂${pc}，已为您加强通风、调低温度${ctx.flags.complexActive ? '' : '、切换轻音乐'}。建议开窗或到服务区稍作休息。`);
        s.stats.proact++;
      });
    }
  }

  // 休息模式自动退出（与上方 !resting 分支互斥执行）
  if (s.driver.resting && s.driver.simFatigue < 15 && s.t >= (ctx.cd.restDone ?? 0)) {
    ctx.cd.restDone = s.t + 30;
    s.driver.resting = false;
    adjust(ctx, () => { s.cabin.seatMassage = false; s.cabin.ambient = '青碧'; });
    say(ctx, 'care', '监测到您的状态已明显恢复，随时可以继续行程。');
  }

  // 4) 复杂路况：因子 ≥2 屏蔽娱乐、谨慎模式；缓解后自动恢复
  const cx = complexityOf(s);
  if (cx >= P.complexityBlock && !ctx.flags.complexActive) {
    ctx.flags.complexActive = true;
    ctx.flags.musicBeforeBlock = s.cabin.music;
    s.cabin.entertainmentBlocked = true;
    if (s.cabin.music !== '关闭') adjust(ctx, () => { s.cabin.music = '关闭'; });
    say(ctx, 'warn', '当前雨夜拥堵、路况复杂：已屏蔽娱乐内容、强化安全播报，进入谨慎模式。');
    s.stats.proact++;
  } else if (cx < P.complexityBlock && ctx.flags.complexActive) {
    ctx.flags.complexActive = false;
    s.cabin.entertainmentBlocked = false;
    adjust(ctx, () => { s.cabin.music = ctx.flags.musicBeforeBlock === '关闭' ? '轻音乐' : ctx.flags.musicBeforeBlock; });
    say(ctx, 'care', '路况已缓解，娱乐与常规座舱服务已恢复。');
  }

  // 5) 情绪四联动
  if (s.driver.emotion <= P.emotionTh.low) {
    gate(ctx, 'emoLow', P.cd.emotion, () => {
      adjust(ctx, () => { s.cabin.ambient = '暖橙'; s.cabin.music = '轻音乐'; s.cabin.seatMassage = true; });
      say(ctx, 'care', '检测到情绪偏低：氛围灯已调暖、播放舒缓音乐、开启轻柔按摩，希望能让您放松一些。');
      s.stats.proact++;
    });
  } else if (s.driver.emotion >= P.emotionTh.high) {
    gate(ctx, 'emoHigh', P.cd.emotion, () => {
      adjust(ctx, () => { s.cabin.music = '轻音乐'; s.cabin.fan = Math.min(3, s.cabin.fan + 1) as typeof s.cabin.fan; });
      say(ctx, 'care', '您看起来情绪高涨：已切换舒缓曲目并微调通风，保持平稳驾驶状态。');
      s.stats.proact++;
    });
  }

  // 6) L2 监管提醒（L2 定位：责任始终在驾驶员）
  if (s.drive.auto && (s.driver.fatigue >= 50 || (v?.present && v.perclos >= P.perclosTh.warn))) {
    gate(ctx, 'l2Remind', P.cd.l2Remind, () => {
      alert(ctx, 'info', 'L2 提醒：辅助驾驶期间请保持对路况的关注。');
    });
  }

  s.evaMode = evaModeOf(s, ctx.flags.complexActive);
}
