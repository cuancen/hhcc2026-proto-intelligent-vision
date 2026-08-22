import type { CockpitActions } from '../core';

export type DemoCue =
  | 'commute'
  | 'fatigue-monitoring'
  | 'fatigue-care'
  | 'fatigue-urgent'
  | 'fatigue-rest'
  | 'complex-roads'
  | 'conditions-ease'
  | 'voice-command'
  | 'completed';

export type DemoTransportState = 'ready' | 'running' | 'paused' | 'completed';

/** 演示讲解步骤：cue 稳定驱动三维镜头，标题与注释只承担叙事。 */
export interface DemoStep {
  i: number;
  total: number;
  cue: DemoCue;
  title: string;
  note: string;
}

export interface DemoStepDefinition {
  sec: number;
  cue: DemoCue;
  title: string;
  note: string;
}

export const DEMO_DURATION_SEC = 60;

/** Git 基线三幕自动演示：每个节点只触发一次，同时驱动领域动作和电影镜头。 */
export const DEMO_STEPS: readonly DemoStepDefinition[] = [
  { sec: 0.5, cue: 'commute', title: 'Scene 1 · City Commute', note: 'Face-ID greeting and preference-based cabin setup show EVA’s proactive service.' },
  { sec: 9, cue: 'fatigue-monitoring', title: 'Scene 2 · Fatigue Guard', note: 'Highway and L2 assistance combine blink, PERCLOS and head pose with driving workload.' },
  { sec: 13, cue: 'fatigue-care', title: 'Mild fatigue 62 · Gentle care', note: 'Crossing the 60 care line adjusts ventilation, temperature and audio without nagging.' },
  { sec: 19, cue: 'fatigue-urgent', title: 'Severe fatigue 88 · Urgent intervention', note: 'Crossing the 85 urgent line raises an alert and leaves the rest decision to the driver.' },
  { sec: 23, cue: 'fatigue-rest', title: 'Driver chooses Rest now', note: 'Rest mode coordinates the cabin while EVA guides the driver toward a safe break.' },
  { sec: 30, cue: 'complex-roads', title: 'Scene 3 · Complex Roads', note: 'Rain, night and congestion coordinate cautious cabin and L2 responses.' },
  { sec: 46, cue: 'conditions-ease', title: 'Conditions ease', note: 'Entertainment and regular cabin services return when the road context becomes safe again.' },
  { sec: 52, cue: 'voice-command', title: 'Natural voice command', note: 'The same cockpit kernel answers navigation, temperature, music, massage and L2 requests.' },
  { sec: 58, cue: 'completed', title: 'Demo complete', note: 'Three scenes, one on-device perception and assistance system, with the driver always in charge.' },
];

export interface AutoDemoDeps {
  act: CockpitActions;
  ensureSimVision: () => void;
  setSpeed: (v: number) => void;
  setSimulationRunning?: (running: boolean) => void;
  onStep?: (step: DemoStep) => void;
  onTransport?: (state: DemoTransportState) => void;
  onComplete?: () => void;
  now?: () => number;
  intervalMs?: number;
}

export interface AutoDemoHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  stop(): void;
  getState(): DemoTransportState;
}

export function runAutoDemo({
  act,
  ensureSimVision,
  setSpeed,
  setSimulationRunning = () => undefined,
  onStep,
  onTransport,
  onComplete,
  now = () => Date.now(),
  intervalMs = 50,
}: AutoDemoDeps): AutoDemoHandle {
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  let transport: DemoTransportState = 'ready';
  let elapsedMs = 0;
  let startedAt = 0;
  let lastPumpAt: number | null = null;
  const fired = new Set<number>();
  const total = DEMO_STEPS.length;

  const clearTimer = () => {
    if (timer === null) return;
    globalThis.clearInterval(timer);
    timer = null;
  };

  const setTransport = (next: DemoTransportState) => {
    transport = next;
    setSimulationRunning(next === 'running');
    onTransport?.(next);
  };

  const actions: ReadonlyArray<() => void> = [
    () => undefined,
    () => act.scenario('fatigue'),
    () => act.setSimFatigue(62),
    () => act.setSimFatigue(88),
    () => { act.reply('rest'); act.setSimFatigue(12); },
    () => act.scenario('complex'),
    () => act.scenario('commute'),
    () => act.command('How much longer is the route?'),
    () => undefined,
  ];

  const currentElapsedMs = () => elapsedMs + (transport === 'running' ? now() - startedAt : 0);

  const complete = () => {
    elapsedMs = DEMO_DURATION_SEC * 1000;
    clearTimer();
    setSpeed(1);
    setTransport('completed');
    onComplete?.();
  };

  const pump = () => {
    if (transport !== 'running') return;
    const tickAt = now();
    if (lastPumpAt !== null) {
      const gap = tickAt - lastPumpAt;
      // 只剔除模型解码/标签页恢复级别的长阻塞；低性能设备的普通慢帧仍按真实时间前进。
      const stallThreshold = Math.max(4_000, intervalMs * 20);
      if (gap > stallThreshold) {
        // 模型解码、后台恢复等长任务期间没有可见画面；把这段时间从电影时间轴中剔除，避免多个镜头同帧跳过。
        startedAt += gap - intervalMs;
      }
    }
    lastPumpAt = tickAt;
    const elapsedSec = (elapsedMs + tickAt - startedAt) / 1000;
    const index = DEMO_STEPS.findIndex((definition, candidate) => !fired.has(candidate) && definition.sec <= elapsedSec);
    if (index >= 0) {
      const definition = DEMO_STEPS[index];
      fired.add(index);
      onStep?.({
        i: index + 1,
        total,
        cue: definition.cue,
        title: definition.title,
        note: definition.note,
      });
      actions[index]?.();
    }
    if (elapsedSec >= DEMO_DURATION_SEC && fired.size === total) complete();
  };

  const beginInterval = () => {
    clearTimer();
    timer = globalThis.setInterval(pump, intervalMs);
  };

  const restart = () => {
    clearTimer();
    elapsedMs = 0;
    fired.clear();
    // 0.15× 让复杂路况内部的 4.2 仿真分钟事件在 16 秒幕长内完成，同时避免路线归零。
    setSpeed(0.15);
    act.reset();
    // reset() 默认保留当前手动场景；自动巡演必须始终从通勤基线重播。
    act.scenario('commute');
    ensureSimVision();
    startedAt = now();
    lastPumpAt = startedAt;
    setTransport('running');
    beginInterval();
    pump();
  };

  const handle: AutoDemoHandle = {
    pause() {
      if (transport !== 'running') return;
      elapsedMs = currentElapsedMs();
      clearTimer();
      lastPumpAt = null;
      setTransport('paused');
    },
    resume() {
      if (transport !== 'paused') return;
      startedAt = now();
      lastPumpAt = startedAt;
      setTransport('running');
      beginInterval();
      pump();
    },
    restart,
    stop() {
      clearTimer();
      setSpeed(1);
      setTransport('ready');
    },
    getState() {
      return transport;
    },
  };

  restart();
  return handle;
}
