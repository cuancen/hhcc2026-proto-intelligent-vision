import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STEPS, runAutoDemo } from '../src/shell/autoDemo';
import { BOOT_SEQUENCE } from '../src/shell/components/BootSplash';
import { ENTRY_MAX_MS } from '../src/shell/components/EntryTransition';
import { deriveEvaExpression, deriveMood, MOOD_FRESH_MIN } from '../src/shell/evaFace';
import { createEvidencePlaybackGate } from '../src/shell/evidencePlayback';
import { ambientLevelOf, URGENT_FRESH_MIN } from '../src/shell/ambient';
import { buildBust, eyeShapeOf, MOOD_COLOR } from '../src/shell/evaAvatar';
import { createState } from '../src/core/sim';
import { createCockpit, SCENARIOS } from '../src/core';
import { createSimulationClock } from '../src/shell/simulationClock';
import { cameraCutKey, deriveTwinFrame, fitModelBounds, isTwinMotionActive } from '../src/shell/twin/twinState';
import { VEHICLE_CALIBRATION } from '../src/shell/twin/twinScene';
import { resolveWithin } from '../src/shell/preflight';
import { FULL_DEMO_STEPS, runFullDemo } from '../src/shell/fullDemo';
import { progressPhaseOf } from '../src/shell/components/CockpitHeader';
import { normalizeSpeechText } from '../src/shell/hooks/useTts';

afterEach(() => {
  vi.useRealTimers();
});

describe('开机自检动画', () => {
  it('自检清单覆盖核心子系统且不重复', () => {
    expect(BOOT_SEQUENCE.length).toBeGreaterThanOrEqual(4);
    expect(new Set(BOOT_SEQUENCE).size).toBe(BOOT_SEQUENCE.length);
    const all = BOOT_SEQUENCE.join('');
    expect(all).toMatch(/视觉|Vision/); // 新旧启动层都必须覆盖视觉能力
    expect(all).toContain('L2');
  });

  it('启动遮罩有硬性退场上限，不阻塞驾驶舱', () => {
    expect(ENTRY_MAX_MS).toBeLessThanOrEqual(1200);
  });
});

describe('Hybrid Live OMS MomentTrace 主演示', () => {
  const replayDeps = (api: ReturnType<typeof createCockpit>) => ({
    act: api.actions,
    traceDmsMode: 'replay-fallback' as const,
    getVision: () => null,
    activateReplayDms: () => undefined,
    setSpeed: () => undefined,
  });

  it('十个提示稳定、唯一，并按 35 秒主线严格递增', () => {
    expect(DEMO_STEPS.map((step) => step.sec)).toEqual([0.5, 4, 6, 10, 13, 15, 23, 29, 32, 35]);
    expect(DEMO_STEPS.map((step) => step.cue)).toEqual([
      'oms-cruise', 'oms-candidate', 'oms-prompt', 'oms-correlate', 'oms-decide',
      'oms-urgent', 'oms-clear', 'oms-verify', 'moment-trace', 'completed',
    ]);
    expect(new Set(DEMO_STEPS.map((step) => step.cue)).size).toBe(10);
    for (const step of DEMO_STEPS) {
      expect(step.title.trim()).not.toBe('');
      expect(step.note.trim().length).toBeGreaterThan(6);
    }
  });

  it('产品场景保留三项备用能力并新增 cabin-safety 内核场景', () => {
    expect(Object.keys(SCENARIOS)).toEqual(['commute', 'fatigue', 'complex', 'cabin-safety']);
    const all = DEMO_STEPS.map((step) => `${step.title} ${step.note}`).join(' ');
    expect(all).toContain('OMS');
    expect(all).toContain('DMS');
    expect(all).toContain('you remain in charge');
  });

  it('使用 0.15× 仿真倍率，停止时恢复默认倍率', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const speeds: number[] = [];
    const demo = runAutoDemo({ ...replayDeps(api), setSpeed: (speed) => speeds.push(speed) });
    expect(speeds.at(-1)).toBe(0.15);
    demo.stop();
    expect(speeds.at(-1)).toBe(1);
  });

  it('暂停不推进、继续不重复，重播完整复位', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    const transport: string[] = [];
    const demo = runAutoDemo({
      ...replayDeps(api),
      onStep: (step) => cues.push(step.cue),
      onTransport: (state) => transport.push(state),
    });
    vi.advanceTimersByTime(4_100);
    expect(cues).toEqual(['oms-cruise', 'oms-candidate']);
    expect(api.state.scenario).toBe('cabin-safety');
    demo.pause();
    vi.advanceTimersByTime(20_000);
    expect(cues).toHaveLength(2);
    demo.resume();
    vi.advanceTimersByTime(2_000);
    expect(cues.at(-1)).toBe('oms-prompt');
    demo.restart();
    expect(api.state.momentTrace.phase).toBe('perceive');
    expect(transport.at(-1)).toBe('running');
    vi.advanceTimersByTime(600);
    expect(cues.at(-1)).toBe('oms-cruise');
    demo.stop();
  });

  it('现场 DMS 条件等待超时后只降级 DMS，流程不中断', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const fallback = vi.fn();
    const demo = runAutoDemo({
      act: api.actions,
      traceDmsMode: 'live',
      getVision: () => ({ present: true, perclos: 0.03, blinkPm: 7, lookAwaySec: 0, yaw: 0, pitch: 0, ear: 0.3, emotion: 'neutral', source: 'model' }),
      activateReplayDms: fallback,
      setSpeed: () => undefined,
    });
    vi.advanceTimersByTime(16_100);
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(demo.getTraceDmsMode()).toBe('replay-fallback');
    expect(api.state.momentTrace.dmsMode).toBe('replay-fallback');
    expect(api.state.oms.active?.seat).toBe('rear-right');
    demo.stop();
  });

  it('完成 OMS 风险、双传感器恢复与驾驶员确认后冻结', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    let speed = 1;
    let simTimer: ReturnType<typeof setInterval> | null = null;
    const demo = runAutoDemo({
      ...replayDeps(api),
      setSpeed: (next) => { speed = next; },
      setSimulationRunning: (isRunning) => {
        if (simTimer) clearInterval(simTimer);
        simTimer = isRunning ? setInterval(() => api.step(0.2 * speed), 100) : null;
      },
    });
    vi.advanceTimersByTime(15_100);
    expect(api.state.oms.risk).toBe('urgent');
    expect(api.state.oms.response.speedCapKmh).toBe(52);
    vi.advanceTimersByTime(14_000);
    expect(api.state.oms.awaitingConfirmation).toBe(true);
    expect(api.state.momentTrace.record?.verification.omsClear).toBe(true);
    vi.advanceTimersByTime(3_100);
    expect(api.state.momentTrace.phase).toBe('verify');
    demo.confirmSafety();
    expect(api.state.momentTrace.phase).toBe('artifact');
    vi.advanceTimersByTime(3_100);
    expect(demo.getState()).toBe('completed');
    expect(api.state.momentTrace.record?.verification.driverConfirmed).toBe(true);
    expect(api.state.drive.routeKm).toBeGreaterThan(0);
    const frozen = api.state.t;
    vi.advanceTimersByTime(5_000);
    expect(api.state.t).toBe(frozen);
    demo.stop();
    if (simTimer) clearInterval(simTimer);
  });

  it('主线程长任务结束后冻结丢失时间，不把多个镜头挤在同一帧', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    let now = 0;
    const demo = runAutoDemo({
      ...replayDeps(api),
      onStep: (step) => cues.push(step.cue),
      now: () => now,
      intervalMs: 50,
    });
    now = 5_000;
    vi.advanceTimersByTime(50);
    expect(cues).toEqual([]);
    for (let index = 0; index < 10; index += 1) {
      now += 50;
      vi.advanceTimersByTime(50);
    }
    expect(cues).toEqual(['oms-cruise']);
    demo.stop();
  });
});

describe('五场景正式自动巡演', () => {
  it('按通勤、疲劳、复杂路况、舱内记忆、OMS 的顺序完整覆盖，播报之间保留安全间隔', () => {
    expect(FULL_DEMO_STEPS).toHaveLength(21);
    expect(FULL_DEMO_STEPS.map((step) => step.sec)).toEqual([
      0.5, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 94, 100, 106, 112, 118,
    ]);
    expect(FULL_DEMO_STEPS.filter((step) => /^0\d ·/.test(step.title)).map((step) => step.title)).toEqual([
      '01 · Daily Commute',
      '02 · Fatigue Guard',
      '03 · Complex Roads',
      '04 · Cabin Memory',
      '05 · OMS MomentTrace',
    ]);
    const voiced = FULL_DEMO_STEPS.filter((step) => step.voice !== false);
    for (let index = 1; index < voiced.length; index += 1) {
      expect(voiced[index].sec - voiced[index - 1].sec).toBeGreaterThanOrEqual(5.5);
    }
    expect(FULL_DEMO_STEPS.every((step) => step.note.length <= 130)).toBe(true);
  });

  it('五场景无人值守运行到底，OMS 双传感器恢复后自动确认并冻结', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    const sceneAtCue: string[] = [];
    let simSpeed = 1;
    let simTimer: ReturnType<typeof setInterval> | null = null;
    const demo = runFullDemo({
      act: api.actions,
      traceDmsMode: 'replay-fallback',
      setSpeed: (next) => { simSpeed = next; },
      setSimulationRunning: (isRunning) => {
        if (simTimer) clearInterval(simTimer);
        simTimer = isRunning ? setInterval(() => api.step(0.2 * simSpeed), 100) : null;
      },
      onStep: (step) => {
        cues.push(step.cue);
        sceneAtCue.push(api.state.scenario);
      },
    });

    vi.advanceTimersByTime(118_300);
    expect(cues).toHaveLength(FULL_DEMO_STEPS.length);
    expect(sceneAtCue[0]).toBe('commute');
    expect(sceneAtCue[2]).toBe('fatigue');
    expect(sceneAtCue[6]).toBe('complex');
    expect(sceneAtCue[9]).toBe('commute');
    expect(sceneAtCue[12]).toBe('cabin-safety');
    expect(api.state.momentTrace.phase).toBe('completed');
    expect(api.state.momentTrace.record?.verification.driverConfirmed).toBe(true);
    expect(api.state.drive.routeKm).toBeGreaterThan(0);
    expect(demo.getState()).toBe('completed');
    const frozen = api.state.t;
    vi.advanceTimersByTime(3_000);
    expect(api.state.t).toBe(frozen);
    demo.stop();
    if (simTimer) clearInterval(simTimer);
  });

  it('暂停不跨场景推进，继续后从原位置接续', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    const demo = runFullDemo({
      act: api.actions,
      traceDmsMode: 'replay-fallback',
      setSpeed: () => undefined,
      onStep: (step) => cues.push(step.cue),
    });
    vi.advanceTimersByTime(12_100);
    expect(cues).toEqual(['commute', 'commute', 'fatigue-monitoring']);
    demo.pause();
    vi.advanceTimersByTime(30_000);
    expect(cues).toHaveLength(3);
    demo.resume();
    vi.advanceTimersByTime(6_000);
    expect(cues.at(-1)).toBe('fatigue-care');
    demo.stop();
  });

  it('顶部五段进度在 Full Demo 中只随五个体验前进', () => {
    const step = (i: number) => ({ i, total: 21, cue: FULL_DEMO_STEPS[i - 1].cue, title: '', note: '' });
    expect(progressPhaseOf('full-demo', step(1), 'commute')).toBe(0);
    expect(progressPhaseOf('full-demo', step(3), 'fatigue-monitoring')).toBe(1);
    expect(progressPhaseOf('full-demo', step(7), 'complex-roads')).toBe(2);
    expect(progressPhaseOf('full-demo', step(10), 'cabin-memory')).toBe(3);
    expect(progressPhaseOf('full-demo', step(13), 'oms-cruise')).toBe(4);
  });

  it('浏览器临时语音会把技术缩写转换成更自然的读法', () => {
    expect(normalizeSpeechText('DMS × OMS checks PERCLOS while L2 stays active.')).toBe(
      'D M S × O M S checks per-clos while level two stays active.',
    );
  });
});

describe('仿真播放时钟', () => {
  it('准备与暂停时冻结，播放后才按固定节拍推进', () => {
    vi.useFakeTimers();
    const steps: number[] = [];
    const clock = createSimulationClock((dt) => steps.push(dt), { intervalMs: 100, dt: 0.2 });

    vi.advanceTimersByTime(500);
    expect(steps).toHaveLength(0);
    clock.play();
    vi.advanceTimersByTime(350);
    expect(steps).toHaveLength(3);
    expect(steps.every((dt) => dt === 0.2)).toBe(true);
    clock.pause();
    vi.advanceTimersByTime(500);
    expect(steps).toHaveLength(3);
    clock.dispose();
  });
});

describe('DMS 预检上限', () => {
  it('权限请求悬挂时按上限返回降级值', async () => {
    vi.useFakeTimers();
    const pending = new Promise<boolean>(() => undefined);
    const result = resolveWithin(pending, 4_000, false);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(result).resolves.toBe(false);
  });
});

describe('数字孪生镜头派生', () => {
  it('车辆校准固定为左舵：驾驶员前排左侧，OMS 风险乘员后排右侧', () => {
    expect(VEHICLE_CALIBRATION.handedness).toBe('left-hand-drive');
    expect(VEHICLE_CALIBRATION.driver[0]).toBeGreaterThan(0);
    expect(VEHICLE_CALIBRATION.driver[2]).toBeGreaterThan(VEHICLE_CALIBRATION.rearRight[2]);
    expect(VEHICLE_CALIBRATION.rearRight[0]).toBeLessThan(0);
    expect(VEHICLE_CALIBRATION.driver[0]).toBeLessThan(0.65);
    expect(VEHICLE_CALIBRATION.rearRight[0]).toBeGreaterThan(-0.65);
    expect(VEHICLE_CALIBRATION.driver[0] - VEHICLE_CALIBRATION.rearRight[0]).toBeGreaterThan(0.9);
    expect(VEHICLE_CALIBRATION.driver[2]).toBeLessThanOrEqual(0.5);
    expect(VEHICLE_CALIBRATION.driver[2] - VEHICLE_CALIBRATION.rearRight[2]).toBeGreaterThan(0.8);
    expect(VEHICLE_CALIBRATION.driver[2] - VEHICLE_CALIBRATION.rearRight[2]).toBeLessThan(1.2);
    expect(VEHICLE_CALIBRATION.rearRightWindow[0]).toBeLessThan(VEHICLE_CALIBRATION.rearRight[0]);
  });

  it('Live 同机位的车速变化不会被误判为新镜头', () => {
    const state = createState('cabin-safety');
    state.drive.speed = 38;
    const accelerating = deriveTwinFrame(state, 'oms-cruise', 'calm');
    state.drive.speed = 72;
    const cruising = deriveTwinFrame(state, 'oms-cruise', 'calm');

    expect(accelerating.motionIntensity).not.toBe(cruising.motionIntensity);
    expect(cameraCutKey(accelerating)).toBe(cameraCutKey(cruising));
    expect(deriveTwinFrame(state, 'oms-candidate', 'care').camera).toBe('rearRightReveal');
    expect(deriveTwinFrame(state, 'oms-prompt', 'care').camera).toBe('rearRightChase');
  });

  it('OMS 主线只在关联、风险和恢复节点切到对应稳定机位', () => {
    const state = createState('cabin-safety');
    state.drive.speed = 72;

    const correlate = deriveTwinFrame(state, 'oms-correlate', 'care');
    expect(correlate.camera).toBe('leftFrontHigh');
    expect(correlate.environment).toBe('cabin');
    expect(correlate.correlation).toBe(true);
    expect(correlate.bodyOpacity).toBeLessThan(0.5);

    state.oms.response.active = true;
    const urgent = deriveTwinFrame(state, 'oms-urgent', 'urgent');
    expect(urgent.camera).toBe('rearRightFocus');
    expect(urgent.accent).toBe('danger');
    expect(urgent.omsMarker).toBe('urgent');
    expect(urgent.braking).toBe(true);

    const recovered = deriveTwinFrame(state, 'oms-verify', 'calm');
    expect(recovered.camera).toBe('rearWide');
    expect(recovered.omsMarker).toBe('clear');

    const artifact = deriveTwinFrame(state, 'moment-trace', 'calm');
    expect(artifact.camera).toBe('rearWide');
    expect(artifact.motionIntensity).toBe(0);
    expect(artifact.traceArtifact).toBe(true);
  });

  it('车型缩放后仍以舞台原点为中心', () => {
    const fit = fitModelBounds([19.59, 8.4, 24.53], [0.62, 4.18, 1.19]);
    const finalCenter = [
      0.62 * fit.scale + fit.position[0],
      4.18 * fit.scale + fit.position[1],
      1.19 * fit.scale + fit.position[2],
    ];
    expect(finalCenter).toEqual([0, 0, 0]);
    expect(fit.groundY).toBeLessThan(-0.9);
  });

  it('三幕映射到不同镜头和青／橙／红语义状态', () => {
    const state = createState('commute');
    state.drive.speed = 80;
    const commute = deriveTwinFrame(state, 'commute', 'calm');
    expect(commute.camera).toBe('rearChase');
    expect(commute.accent).toBe('verify');
    expect(commute.bodyOpacity).toBe(1);
    expect(commute.environment).toBe('city');
    expect(commute.motionIntensity).toBeGreaterThan(0);

    const care = deriveTwinFrame(state, 'fatigue-care', 'warn');
    expect(care.camera).toBe('gaze');
    expect(care.accent).toBe('cause');
    expect(care.gaze).toBe('warning');
    expect(care.effect).toBe('care');
    expect(care.environment).toBe('highway');

    const fatigue = deriveTwinFrame(state, 'fatigue-monitoring', 'care');
    expect(fatigue.camera).toBe('driver');

    const urgent = deriveTwinFrame(state, 'fatigue-urgent', 'urgent');
    expect(urgent.camera).toBe('cause');
    expect(urgent.accent).toBe('danger');
    expect(urgent.gaze).toBe('urgent');
    expect(urgent.bodyOpacity).toBeLessThan(0.5);

    state.drive.leadBrake = true;
    const complex = deriveTwinFrame(state, 'complex-roads', 'warn');
    expect(complex.camera).toBe('rainChase');
    expect(complex.accent).toBe('danger');
    expect(complex.effect).toBe('weather');
    expect(complex.environment).toBe('rain-night');
    expect(complex.braking).toBe(true);

    expect(deriveTwinFrame(state, 'voice-command', 'care').camera).toBe('console');
  });

  it('休息、路况恢复和完成阶段回到青色安全语义', () => {
    const state = createState('fatigue');
    const rest = deriveTwinFrame(state, 'fatigue-rest', 'care');
    expect(rest.camera).toBe('cabin');
    expect(rest.accent).toBe('verify');
    expect(rest.effect).toBe('rest');
    const recovered = deriveTwinFrame(state, 'conditions-ease', 'calm');
    expect(recovered.camera).toBe('rearWide');
    expect(recovered.accent).toBe('verify');
    const completed = deriveTwinFrame(state, 'completed', 'calm');
    expect(completed.effect).toBe('complete');
    expect(completed.motionIntensity).toBe(0);
  });

  it('速度、播放、页面可见性和减弱动效共同控制环境运动', () => {
    const state = createState('commute');
    state.drive.speed = 80;
    const frame = deriveTwinFrame(state, 'commute', 'calm');
    expect(isTwinMotionActive(frame, true, false, true)).toBe(true);
    expect(isTwinMotionActive(frame, false, false, true)).toBe(false);
    expect(isTwinMotionActive(frame, true, true, true)).toBe(false);
    expect(isTwinMotionActive(frame, true, false, false)).toBe(false);
    state.drive.speed = 0;
    const stopped = deriveTwinFrame(state, 'commute', 'calm');
    expect(stopped.motionIntensity).toBe(0);
    expect(isTwinMotionActive(stopped, true, false, true)).toBe(false);
  });
});

describe('Eva 表情系统（情绪推导）', () => {
  it('五种模式基调映射四态情绪', () => {
    expect(deriveMood('Observing', null, 0)).toBe('calm');
    expect(deriveMood('Guarding', null, 0)).toBe('care');
    expect(deriveMood('Resting', null, 0)).toBe('care');
    expect(deriveMood('Cautious', null, 0)).toBe('warn');
    expect(deriveMood('Intervening', null, 0)).toBe('urgent');
  });

  it('新鲜消息语气可临时提升情绪，过期回落模式基调', () => {
    expect(deriveMood('Observing', { kind: 'care', t: 10 }, 10.2)).toBe('care');
    expect(deriveMood('Observing', { kind: 'care', t: 10 }, 10 + MOOD_FRESH_MIN + 0.01)).toBe('calm');
    expect(deriveMood('Observing', { kind: 'sys', t: 10 }, 10.1)).toBe('calm');
  });

  it('紧急干预待选择（pending）期间锁定 urgent，表情不回落', () => {
    expect(deriveMood('Resting', { kind: 'care', t: 10 }, 20, { pending: true })).toBe('urgent');
    expect(deriveMood('Observing', null, 0, { pending: true })).toBe('urgent');
  });

  it('情绪只升不降（安全优先：紧急语义不被温柔消息稀释）', () => {
    expect(deriveMood('Observing', { kind: 'urg', t: 5 }, 5.1)).toBe('urgent');
    expect(deriveMood('Cautious', { kind: 'care', t: 5 }, 5.1)).toBe('warn');
    expect(deriveMood('Guarding', { kind: 'warn', t: 5 }, 5.1)).toBe('warn');
  });

  it('七种功能表情均可由稳定剧情提示覆盖', () => {
    const expressions = new Set([
      deriveEvaExpression('commute', 'calm', 'neutral', 'running'),
      deriveEvaExpression('fatigue-monitoring', 'calm', 'neutral', 'running'),
      deriveEvaExpression('fatigue-care', 'calm', 'neutral', 'running'),
      deriveEvaExpression('fatigue-urgent', 'calm', 'neutral', 'running'),
      deriveEvaExpression('complex-roads', 'calm', 'neutral', 'running'),
      deriveEvaExpression('voice-command', 'calm', 'neutral', 'running'),
      deriveEvaExpression('completed', 'calm', 'neutral', 'completed'),
    ]);
    expect(expressions).toEqual(new Set(['calm', 'thinking', 'caring', 'urgent', 'cautious', 'listening', 'confirming']));
  });

  it('六类驾驶员情绪映射到功能表情', () => {
    expect(deriveEvaExpression(null, 'calm', 'neutral', 'running')).toBe('calm');
    expect(deriveEvaExpression(null, 'calm', 'happy', 'running')).toBe('confirming');
    expect(deriveEvaExpression(null, 'calm', 'sad', 'running')).toBe('caring');
    expect(deriveEvaExpression(null, 'calm', 'drowsy', 'running')).toBe('caring');
    expect(deriveEvaExpression(null, 'calm', 'angry', 'running')).toBe('cautious');
    expect(deriveEvaExpression(null, 'calm', 'surprised', 'running')).toBe('listening');
  });

  it('紧急安全状态高于剧情，剧情高于实时驾驶员情绪', () => {
    expect(deriveEvaExpression('voice-command', 'urgent', 'happy', 'running')).toBe('urgent');
    expect(deriveEvaExpression('voice-command', 'calm', 'angry', 'running')).toBe('listening');
    expect(deriveEvaExpression(null, 'calm', 'happy', 'completed')).toBe('confirming');
  });
});

describe('Evidence 播放闸门', () => {
  it('只恢复打开前正在运行的体验，原本暂停时不得误续播', () => {
    const gate = createEvidencePlaybackGate();
    expect(gate.open('running')).toBe(true);
    expect(gate.open('paused')).toBe(true);
    expect(gate.close()).toBe(true);
    expect(gate.close()).toBe(false);
    expect(gate.open('paused')).toBe(false);
    expect(gate.close()).toBe(false);
  });
});

describe('座舱氛围分级', () => {
  const base = () => {
    const s = createState('commute');
    s.alerts = [];
    return s;
  };

  it('无告警时为常态（ok）', () => {
    expect(ambientLevelOf(base())).toBe('ok');
  });

  it('新鲜紧急告警 → danger，过期后回落', () => {
    const s = base();
    s.alerts.push({ id: 1, t: s.t, level: 'urgent', text: '重度疲劳' });
    expect(ambientLevelOf(s)).toBe('danger');
    s.t += URGENT_FRESH_MIN + 0.01;
    expect(ambientLevelOf(s)).toBe('ok');
  });

  it('新鲜预警 / L2 降级 → warn', () => {
    const s1 = base();
    s1.alerts.push({ id: 1, t: s1.t, level: 'warn', text: '视线离开' });
    expect(ambientLevelOf(s1)).toBe('warn');

    const s2 = base();
    s2.drive.l2Degraded = true;
    expect(ambientLevelOf(s2)).toBe('warn');
  });

  it('紧急干预待选择（pending）→ danger，贯穿决策时刻', () => {
    const s = base();
    s.pending = { prompt: '需要休息吗？', options: [{ key: 'rest', label: '立即休息' }] };
    expect(ambientLevelOf(s)).toBe('danger');
  });
});

describe('EVA 数字人几何（纯函数）', () => {
  it('半身像线框结构完整：头/颈环 + 躯干弧 + 五官在前表面', () => {
    const b = buildBust();
    expect(b.loops.length).toBe(9); // 4 头纬环 + 3 经线 + 2 颈环
    expect(b.arcs.length).toBe(3); // 肩/胸/下胸前弧
    expect(b.eyes[0].z).toBeGreaterThan(0.3);
    expect(b.eyes[1].z).toBeGreaterThan(0.3);
    expect(b.mouth.z).toBeGreaterThan(0.3);
    expect(b.core.length).toBeGreaterThan(6);
    expect(b.height).toBeGreaterThan(2);
  });

  it('情绪调色板与眼睛形态四态齐备', () => {
    for (const m of ['calm', 'care', 'warn', 'urgent'] as const) {
      expect(MOOD_COLOR[m]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(eyeShapeOf(m)).toBeTruthy();
    }
    expect(eyeShapeOf('care')).toBe('arc');
    expect(eyeShapeOf('urgent')).toBe('max');
  });
});
