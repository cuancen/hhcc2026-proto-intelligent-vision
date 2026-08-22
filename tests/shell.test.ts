import { describe, expect, it } from 'vitest';
import { DEMO_STEPS } from '../src/shell/autoDemo';
import { BOOT_SEQUENCE } from '../src/shell/components/BootSplash';
import { deriveMood, MOOD_FRESH_MIN } from '../src/shell/evaFace';
import { ambientLevelOf, URGENT_FRESH_MIN } from '../src/shell/ambient';
import { brandColor, buildCabin, project, rotY } from '../src/landing/projection';
import { buildBust, eyeShapeOf, MOOD_COLOR } from '../src/shell/evaAvatar';
import { createState } from '../src/core/sim';

describe('开机自检动画', () => {
  it('自检清单覆盖核心子系统且不重复', () => {
    expect(BOOT_SEQUENCE.length).toBeGreaterThanOrEqual(4);
    expect(new Set(BOOT_SEQUENCE).size).toBe(BOOT_SEQUENCE.length);
    const all = BOOT_SEQUENCE.join('');
    expect(all).toContain('Vision'); // 核心亮点必须在列
    expect(all).toContain('L2');
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

  it('剧本覆盖三场景与休息分支', () => {
    const all = DEMO_STEPS.map((s) => `${s.title}\n${s.note}`).join('\n');
    expect(all).toContain('Commute');
    expect(all).toContain('Fatigue');
    expect(all).toContain('Complex');
    expect(all).toContain('Rest');
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
