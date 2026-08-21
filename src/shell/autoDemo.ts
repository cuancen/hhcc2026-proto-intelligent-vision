import type { CockpitActions } from '../core';

export interface AutoDemoDeps {
  act: CockpitActions;
  /** 视觉未启用时自动打开模拟信号（链路与真实模型一致） */
  ensureSimVision: () => void;
  setSpeed: (v: number) => void;
  /** 每步播报（可选，用于 UI 状态展示） */
  onStep?: (label: string) => void;
}

export interface AutoDemoHandle {
  stop(): void;
}

/**
 * 自动演示剧本：约 60 秒走完三大场景（模拟信号自动开启）。
 * 速率 ×2 压缩仿真时间；随时可停，停下不清理现场（评委可接着手动探索）。
 */
export function runAutoDemo({ act, ensureSimVision, setSpeed, onStep }: AutoDemoDeps): AutoDemoHandle {
  const timers: number[] = [];
  let stopped = false;

  const at = (sec: number, label: string, fn: () => void) => {
    timers.push(
      window.setTimeout(() => {
        if (stopped) return;
        onStep?.(label);
        fn();
      }, sec * 1000),
    );
  };

  setSpeed(2);
  ensureSimVision();

  at(0.5, '场景一 · 日常通勤：上车问候与无感智能', () => {
    act.scenario('commute');
  });
  at(9, '场景二 · 疲劳守护：视觉与工况双通道', () => {
    act.scenario('fatigue');
  });
  at(13, '轻度疲劳（62）→ 温柔关怀', () => {
    act.setSimFatigue(62);
  });
  at(19, '重度疲劳（88）→ 紧急干预与休息分支', () => {
    act.setSimFatigue(88);
  });
  at(23, '用户选择：立即休息 → 休息模式', () => {
    act.reply('rest');
    act.setSimFatigue(12); // 加速恢复演示
  });
  at(30, '场景三 · 复杂路况：雨夜拥堵弯道 + 前车急刹', () => {
    act.scenario('complex');
  });
  at(46, '路况缓解 → 恢复日常', () => {
    act.scenario('commute');
  });
  at(52, '语音指令演示', () => {
    act.command('导航还有多久');
  });
  at(58, '演示结束', () => {
    setSpeed(1);
  });

  return {
    stop() {
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
      setSpeed(1);
    },
  };
}
