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
  { sec: 0.5, title: 'Scene 1 · City Commute', note: 'Face-ID greeting + preference-based ambient setup — Eva’s proactive service' },
  { sec: 9, title: 'Scene 2 · Fatigue Guard', note: 'Highway + L2: blink / PERCLOS / head pose fused with driving workload' },
  { sec: 13, title: 'Mild fatigue 62 → gentle care', note: 'Crossing the 60 care line: auto ventilation, cooling, soft music — graded, not naggy' },
  { sec: 19, title: 'Severe fatigue 88 → urgent intervention', note: 'Crossing the 85 urgent line: alert + rest-choice branch, decision stays with the driver' },
  { sec: 23, title: 'Choosing “Rest now”', note: 'Rest mode takes over the cabin; refusing waits 6 minutes, then reminds again' },
  { sec: 30, title: 'Scene 3 · Complex Roads', note: 'Rain + night + congestion factor ≥2: entertainment blocked, speed trimmed — cabin-drive synergy' },
  { sec: 46, title: 'Conditions ease', note: 'Entertainment and regular services auto-restored — bounded intelligence' },
  { sec: 52, title: 'Voice command', note: 'Natural language: navigation / temperature / music / massage / L2 toggle' },
  { sec: 58, title: 'Demo complete', note: 'Try “Start camera monitoring” for real on-device machine vision (local inference, zero upload)' },
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
  at(7, () => { act.command('How much longer is the route?'); });
  at(8, () => { setSpeed(1); });

  return {
    stop() {
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
      setSpeed(1);
    },
  };
}
