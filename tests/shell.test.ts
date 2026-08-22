import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STEPS, runAutoDemo } from '../src/shell/autoDemo';
import { BOOT_SEQUENCE } from '../src/shell/components/BootSplash';
import { ENTRY_MAX_MS } from '../src/shell/components/EntryTransition';
import { deriveMood, MOOD_FRESH_MIN } from '../src/shell/evaFace';
import { ambientLevelOf, URGENT_FRESH_MIN } from '../src/shell/ambient';
import { brandColor, buildCabin, project, rotY } from '../src/landing/projection';
import { buildBust, eyeShapeOf, MOOD_COLOR } from '../src/shell/evaAvatar';
import { createState } from '../src/core/sim';
import { createCockpit } from '../src/core';
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
    expect(all).toContain('视觉'); // 核心亮点必须在列
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

  it('剧本覆盖看见、理解、行动、确认四阶段并透明标注模拟输入', () => {
    const all = DEMO_STEPS.map((s) => `${s.title}\n${s.note}`).join('\n');
    expect(all).toContain('看见');
    expect(all).toContain('理解');
    expect(all).toContain('行动');
    expect(all).toContain('确认');
    expect(all).toContain('模拟视觉事件');
  });

  it('十个镜头提示稳定、唯一，三维舞台不依赖步骤序号猜测', () => {
    expect(DEMO_STEPS).toHaveLength(10);
    expect(DEMO_STEPS.map((step) => step.cue)).toEqual([
      'boundary',
      'observe-cabin',
      'observe-phone',
      'search-intent',
      'gaze-away',
      'cause-linked',
      'assistance',
      'verified',
      'exit-filter',
      'completed',
    ]);
    expect(new Set(DEMO_STEPS.map((step) => step.cue)).size).toBe(10);
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
    expect(cues).toEqual(['boundary', 'observe-cabin']);
    expect(api.state.context.memory.map((item) => item.id)).toContain('parking-card');

    demo.pause();
    vi.advanceTimersByTime(20_000);
    expect(cues).toEqual(['boundary', 'observe-cabin']);

    demo.resume();
    vi.advanceTimersByTime(4_100);
    expect(cues).toEqual(['boundary', 'observe-cabin', 'observe-phone']);

    demo.restart();
    expect(api.state.context.memory).toHaveLength(0);
    expect(transport.at(-1)).toBe('running');
    vi.advanceTimersByTime(600);
    expect(cues.at(-1)).toBe('boundary');
    demo.stop();
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
    expect(cues).toEqual(['boundary']);
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

  it('原因、行动与确认阶段映射到不同镜头和语义颜色', () => {
    const state = createState('visionLoop');
    state.context.memory.push({
      id: 'parking-card', label: '停车卡', location: '左侧车门储物格', owner: '驾驶员',
      importance: 'normal', confidence: 0.94, source: 'simulated-event', lastSeenAt: 1, present: true,
    });

    const cause = deriveTwinFrame(state, 'cause-linked', 'warn');
    expect(cause.camera).toBe('cause');
    expect(cause.bodyOpacity).toBeLessThan(0.5);
    expect(cause.gaze).toBe('cause');
    expect(cause.accent).toBe('cause');

    state.cabin.readingLight = '主驾左侧';
    expect(deriveTwinFrame(state, 'cause-linked', 'warn').readingLight).toBe(false);
    const action = deriveTwinFrame(state, 'assistance', 'warn');
    expect(action.readingLight).toBe(true);
    expect(action.camera).toBe('assist');

    state.cabin.readingLight = '关闭';
    const verified = deriveTwinFrame(state, 'verified', 'care');
    expect(verified.camera).toBe('verify');
    expect(verified.accent).toBe('verify');
    expect(verified.gaze).toBe('forward');
  });
});

describe('Eva 表情系统（情绪推导）', () => {
  it('五种模式基调映射四态情绪', () => {
    expect(deriveMood('观察中', null, 0)).toBe('calm');
    expect(deriveMood('守护中', null, 0)).toBe('care');
    expect(deriveMood('休息引导中', null, 0)).toBe('care');
    expect(deriveMood('谨慎模式', null, 0)).toBe('warn');
    expect(deriveMood('干预中', null, 0)).toBe('urgent');
  });

  it('新鲜消息语气可临时提升情绪，过期回落模式基调', () => {
    expect(deriveMood('观察中', { kind: 'care', t: 10 }, 10.2)).toBe('care');
    expect(deriveMood('观察中', { kind: 'care', t: 10 }, 10 + MOOD_FRESH_MIN + 0.01)).toBe('calm');
    expect(deriveMood('观察中', { kind: 'sys', t: 10 }, 10.1)).toBe('calm');
  });

  it('紧急干预待选择（pending）期间锁定 urgent，表情不回落', () => {
    expect(deriveMood('休息引导中', { kind: 'care', t: 10 }, 20, { pending: true })).toBe('urgent');
    expect(deriveMood('观察中', null, 0, { pending: true })).toBe('urgent');
  });

  it('情绪只升不降（安全优先：紧急语义不被温柔消息稀释）', () => {
    expect(deriveMood('观察中', { kind: 'urg', t: 5 }, 5.1)).toBe('urgent');
    expect(deriveMood('谨慎模式', { kind: 'care', t: 5 }, 5.1)).toBe('warn');
    expect(deriveMood('守护中', { kind: 'warn', t: 5 }, 5.1)).toBe('warn');
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

describe('Landing 伪 3D 投影（纯函数）', () => {
  it('绕 Y 轴旋转 90°：+x 轴单位向量转到 -z', () => {
    const r = rotY({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBe(0);
    expect(r.z).toBeCloseTo(-1, 6);
  });

  it('透视投影：光轴上的点落在画布中心，近大远小', () => {
    const onAxis = project({ x: 0, y: 0, z: 0 }, 7, 3, 100, 50, 10);
    expect(onAxis.x).toBeCloseTo(100, 6);
    expect(onAxis.y).toBeCloseTo(50, 6);
    const near = project({ x: 1, y: 0, z: 4 }, 7, 3, 0, 0, 10);
    const far = project({ x: 1, y: 0, z: 0 }, 7, 3, 0, 0, 10);
    expect(Math.abs(near.x)).toBeGreaterThan(Math.abs(far.x));
  });

  it('品牌渐变端点：暗红 #a82c36 → 橙红 #ff7838', () => {
    expect(brandColor(0)).toBe('rgba(168, 44, 54, 1)');
    expect(brandColor(1)).toBe('rgba(255, 120, 56, 1)');
  });

  it('线框座舱结构完整：双侧轮廓/侧窗/轮环/扫描环 + 12 棱检测框 + 4 视线', () => {
    const m = buildCabin();
    // 2 侧轮廓 + 2 侧窗 + 4 轮环 + 1 感知扫描环
    expect(m.loops.length).toBe(9);
    expect(m.segments.length).toBeGreaterThanOrEqual(10); // 轮廓纵向连线
    expect(m.headBoxSegs.length).toBe(12);
    expect(m.gazes.length).toBe(4);
    expect(m.head.y).toBeGreaterThan(0.8); // 头部位于座舱高度
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
