import type { CockpitActions } from '../core';

/** 演示讲解步骤：title=正在发生什么，note=给评委的解释（这一段想表达什么） */
export interface DemoStep {
  i: number;
  total: number;
  title: string;
  note: string;
}

/**
 * 自动演示剧本：约 60 秒走完三大场景（模拟信号自动开启）。
 * 每步带路演讲解文案，由 DemoBanner 横幅逐步展示给评委；
 * 速率 ×2 压缩仿真时间；随时可停，停下不清理现场（评委可接着手动探索） */
export const DEMO_STEPS: readonly { sec: number; title: string; note: string }[] = [
  { sec: 0.5, title: '场景一 · 日常通勤', note: '人脸识别问候 + 按习惯无感调节座舱——Eva 的主动服务' },
  { sec: 9, title: '场景二 · 疲劳守护', note: '高速 + L2：眨眼 / PERCLOS / 头姿与行车工况双通道监测' },
  { sec: 13, title: '轻度疲劳 62 → 温柔关怀', note: '越过 60 关怀线：自动通风、降温、轻音乐——分级干预不唠叨' },
  { sec: 19, title: '重度疲劳 88 → 紧急干预', note: '越过 85 紧急线：紧急告警 + 休息选择分支，决定权交给驾驶员' },
  { sec: 23, title: '选择「立即休息」', note: '休息模式一键接管座舱；若选择坚持，6 分钟后自动再次提醒' },
  { sec: 30, title: '场景三 · 复杂路况', note: '雨 + 夜 + 拥堵因子 ≥2：屏蔽娱乐、修正车速——舱驾协同' },
  { sec: 46, title: '路况缓解', note: '自动恢复娱乐与常规服务——有边界的智能' },
  { sec: 52, title: '语音指令', note: '自然语言理解：导航 / 冷热 / 音乐 / 按摩 / L2 开关' },
  { sec: 58, title: '演示结束', note: '欢迎点「开启摄像头监测」体验真实机器视觉（本地推理 · 不上传）' },
];

export interface AutoDemoDeps {
  act: CockpitActions;
  /** 视觉未启用时自动打开模拟信号（链路与真实模型一致） */
  ensureSimVision: () => void;
  setSpeed: (v: number) => void;
  /** 每步讲解（用于路演讲解横幅） */
  onStep?: (step: DemoStep) => void;
}

export interface AutoDemoHandle {
  stop(): void;
}

export function runAutoDemo({ act, ensureSimVision, setSpeed, onStep }: AutoDemoDeps): AutoDemoHandle {
  const timers: number[] = [];
  let stopped = false;
  const total = DEMO_STEPS.length;

  const at = (idx: number, fn: () => void) => {
    const { sec, title, note } = DEMO_STEPS[idx];
    timers.push(
      window.setTimeout(() => {
        if (stopped) return;
        onStep?.({ i: idx + 1, total, title, note });
        fn();
      }, sec * 1000),
    );
  };

  setSpeed(2);
  ensureSimVision();

  at(0, () => { act.scenario('commute'); });
  at(1, () => { act.scenario('fatigue'); });
  at(2, () => { act.setSimFatigue(62); });
  at(3, () => { act.setSimFatigue(88); });
  at(4, () => { act.reply('rest'); act.setSimFatigue(12); });
  at(5, () => { act.scenario('complex'); });
  at(6, () => { act.scenario('commute'); });
  at(7, () => { act.command('导航还有多久'); });
  at(8, () => { setSpeed(1); });

  return {
    stop() {
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
      setSpeed(1);
    },
  };
}
