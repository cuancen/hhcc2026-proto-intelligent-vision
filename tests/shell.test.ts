import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STEPS, runAutoDemo } from '../src/shell/autoDemo';
import { BOOT_SEQUENCE } from '../src/shell/components/BootSplash';
import { ENTRY_MAX_MS } from '../src/shell/components/EntryTransition';
import { deriveMood, MOOD_FRESH_MIN } from '../src/shell/evaFace';
import { ambientLevelOf, URGENT_FRESH_MIN } from '../src/shell/ambient';
import { buildBust, eyeShapeOf, MOOD_COLOR } from '../src/shell/evaAvatar';
import { createState } from '../src/core/sim';
import { createCockpit, SCENARIOS } from '../src/core';
import { createSimulationClock } from '../src/shell/simulationClock';
import { deriveTwinFrame, fitModelBounds } from '../src/shell/twin/twinState';

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

describe('自动演示剧本（路演讲解）', () => {
  it('步骤时间严格递增，防止讲解与事件错拍', () => {
    for (let k = 1; k < DEMO_STEPS.length; k++) {
      expect(DEMO_STEPS[k].sec).toBeGreaterThan(DEMO_STEPS[k - 1].sec);
    }
  });

  it('每一步都有标题与面向评委的讲解文案', () => {
    expect(DEMO_STEPS.length).toBeGreaterThanOrEqual(9);
    for (const s of DEMO_STEPS) {
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.note.trim().length).toBeGreaterThanOrEqual(6);
    }
  });

  it('覆盖通勤、疲劳与复杂路况三幕，并保留驾驶员责任边界', () => {
    const all = DEMO_STEPS.map((s) => `${s.title}\n${s.note}`).join('\n');
    expect(all).toContain('City Commute');
    expect(all).toContain('Fatigue Guard');
    expect(all).toContain('Complex Roads');
    expect(all).toContain('driver always in charge');
    expect(Object.keys(SCENARIOS)).toEqual(['commute', 'fatigue', 'complex']);
  });

  it('九个镜头提示稳定、唯一，三维舞台不依赖步骤序号猜测', () => {
    expect(DEMO_STEPS).toHaveLength(9);
    expect(DEMO_STEPS.map((step) => step.cue)).toEqual([
      'commute',
      'fatigue-monitoring',
      'fatigue-care',
      'fatigue-urgent',
      'fatigue-rest',
      'complex-roads',
      'conditions-ease',
      'voice-command',
      'completed',
    ]);
    expect(new Set(DEMO_STEPS.map((step) => step.cue)).size).toBe(9);
  });

  it('九步时间严格回到 Git 三幕基线', () => {
    expect(DEMO_STEPS.map((step) => step.sec)).toEqual([0.5, 9, 13, 19, 23, 30, 46, 52, 58]);
  });

  it('巡演使用 0.15× 仿真倍率，停止时恢复默认倍率', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const speeds: number[] = [];
    const demo = runAutoDemo({
      act: api.actions,
      ensureSimVision: () => undefined,
      setSpeed: (speed) => speeds.push(speed),
    });
    expect(speeds.at(-1)).toBe(0.15);
    demo.stop();
    expect(speeds.at(-1)).toBe(1);
  });

  it('暂停后不推进提示，继续不重复触发，重播清空旧进度', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    const transport: string[] = [];
    const demo = runAutoDemo({
      act: api.actions,
      ensureSimVision: () => undefined,
      setSpeed: () => undefined,
      setSimulationRunning: () => undefined,
      onStep: (step) => cues.push(step.cue),
      onTransport: (state) => transport.push(state),
    });

    vi.advanceTimersByTime(5_000);
    expect(cues).toEqual(['commute']);
    expect(api.state.scenario).toBe('commute');

    demo.pause();
    vi.advanceTimersByTime(20_000);
    expect(cues).toEqual(['commute']);

    demo.resume();
    vi.advanceTimersByTime(4_100);
    expect(cues).toEqual(['commute', 'fatigue-monitoring']);

    demo.restart();
    expect(api.state.scenario).toBe('commute');
    expect(transport.at(-1)).toBe('running');
    vi.advanceTimersByTime(600);
    expect(cues.at(-1)).toBe('commute');
    demo.stop();
  });

  it('完整执行 Git 三幕动作，完成后冻结且路线仍大于零', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    let speed = 1;
    let simTimer: ReturnType<typeof setInterval> | null = null;
    const demo = runAutoDemo({
      act: api.actions,
      ensureSimVision: () => undefined,
      setSpeed: (next) => { speed = next; },
      setSimulationRunning: (running) => {
        if (simTimer) clearInterval(simTimer);
        simTimer = running ? setInterval(() => api.step(0.2 * speed), 100) : null;
      },
    });

    vi.advanceTimersByTime(13_100);
    expect(api.state.scenario).toBe('fatigue');
    expect(api.state.driver.simFatigue).toBeGreaterThanOrEqual(62);
    vi.advanceTimersByTime(6_000);
    expect(api.state.driver.simFatigue).toBeGreaterThanOrEqual(88);
    vi.advanceTimersByTime(4_000);
    expect(api.state.driver.simFatigue).toBeLessThan(20);
    vi.advanceTimersByTime(7_000);
    expect(api.state.scenario).toBe('complex');
    vi.advanceTimersByTime(16_000);
    expect(api.state.scenario).toBe('commute');
    vi.advanceTimersByTime(14_100);
    expect(demo.getState()).toBe('completed');
    expect(api.state.drive.routeKm).toBeGreaterThan(0);
    const frozen = api.state.t;
    vi.advanceTimersByTime(5_000);
    expect(api.state.t).toBe(frozen);
    demo.stop();
    if (simTimer) clearInterval(simTimer);
  });

  it('主线程长任务结束后冻结丢失时间，不把多个电影镜头挤在同一帧', () => {
    vi.useFakeTimers();
    const api = createCockpit();
    const cues: string[] = [];
    let now = 0;
    const demo = runAutoDemo({
      act: api.actions,
      ensureSimVision: () => undefined,
      setSpeed: () => undefined,
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
    expect(cues).toEqual(['commute']);
    demo.stop();
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

describe('数字孪生镜头派生', () => {
  it('车型缩放后仍以舞台原点为中心', () => {
    const fit = fitModelBounds([19.59, 8.4, 24.53], [0.62, 4.18, 1.19]);
    const finalCenter = [
      0.62 * fit.scale + fit.position[0],
      4.18 * fit.scale + fit.position[1],
      1.19 * fit.scale + fit.position[2],
    ];
    expect(finalCenter).toEqual([0, 0, 0]);
  });

  it('三幕映射到不同镜头和青／橙／红语义状态', () => {
    const state = createState('commute');
    const commute = deriveTwinFrame(state, 'commute', 'calm');
    expect(commute.camera).toBe('rearChase');
    expect(commute.accent).toBe('verify');
    expect(commute.bodyOpacity).toBe(1);

    const care = deriveTwinFrame(state, 'fatigue-care', 'warn');
    expect(care.camera).toBe('gaze');
    expect(care.accent).toBe('cause');
    expect(care.gaze).toBe('warning');
    expect(care.effect).toBe('care');

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
    expect(deriveTwinFrame(state, 'completed', 'calm').effect).toBe('complete');
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
