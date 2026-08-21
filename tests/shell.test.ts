import { describe, expect, it } from 'vitest';
import { DEMO_STEPS } from '../src/shell/autoDemo';
import { BOOT_SEQUENCE } from '../src/shell/components/BootSplash';

describe('开机自检动画', () => {
  it('自检清单覆盖核心子系统且不重复', () => {
    expect(BOOT_SEQUENCE.length).toBeGreaterThanOrEqual(4);
    expect(new Set(BOOT_SEQUENCE).size).toBe(BOOT_SEQUENCE.length);
    const all = BOOT_SEQUENCE.join('');
    expect(all).toContain('视觉'); // 核心亮点必须在列
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
    expect(all).toContain('通勤');
    expect(all).toContain('疲劳');
    expect(all).toContain('复杂');
    expect(all).toContain('休息');
  });
});
