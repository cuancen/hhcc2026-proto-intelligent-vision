import type { CockpitActions } from '../core';

export type DemoCue =
  | 'boundary'
  | 'observe-cabin'
  | 'observe-phone'
  | 'search-intent'
  | 'gaze-away'
  | 'cause-linked'
  | 'assistance'
  | 'verified'
  | 'exit-filter'
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

/** 60 秒 EVA Vision Loop：每个节点只触发一次，同时驱动领域动作和电影镜头。 */
export const DEMO_STEPS: readonly DemoStepDefinition[] = [
  { sec: 0.5, cue: 'boundary', title: 'Transparent inputs', note: 'Driver DMS can run live; object locations are simulated vision events.' },
  { sec: 4, cue: 'observe-cabin', title: 'See · Objects enter memory', note: 'Only object, location and importance are retained — never the raw frame.' },
  { sec: 9, cue: 'observe-phone', title: 'Location updates over time', note: 'The phone was last seen on the wireless charging pad.' },
  { sec: 16, cue: 'search-intent', title: 'The driver starts looking for a card', note: 'EVA waits for gaze evidence before drawing a conclusion.' },
  { sec: 19, cue: 'gaze-away', title: 'Gaze remains down and left', note: 'DMS captures head pose and sustained eyes-off-road time.' },
  { sec: 22, cue: 'cause-linked', title: 'Understand · Find the cause', note: 'The gaze vector now connects to the parking card location.' },
  { sec: 25, cue: 'assistance', title: 'Act · Resolve the problem', note: 'EVA gives the location and opens the driver-side reading light.' },
  { sec: 30, cue: 'verified', title: 'Verify · Eyes are back on road', note: 'DMS confirms the risk is cleared and the reading light turns off.' },
  { sec: 46, cue: 'exit-filter', title: 'Remind only what matters', note: 'Laptop bag and phone light up; the ordinary water bottle stays silent.' },
  { sec: 57, cue: 'completed', title: 'Loop complete', note: 'See the cause, act on it, then verify the outcome.' },
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
    () => {
      act.observeCabinObject({ id: 'parking-card', label: 'Parking card', location: 'in the left door pocket', owner: 'Driver', importance: 'normal', confidence: 0.94 });
      act.observeCabinObject({ id: 'laptop-bag', label: 'Laptop bag', location: 'on the right rear seat', owner: 'Driver', importance: 'important', confidence: 0.91 });
      act.observeCabinObject({ id: 'water-bottle', label: 'Water bottle', location: 'in the cup holder', owner: 'Driver', importance: 'normal', confidence: 0.98 });
    },
    () => act.observeCabinObject({ id: 'phone', label: 'Phone', location: 'on the wireless charging pad', owner: 'Driver', importance: 'important', confidence: 0.96 }),
    () => act.beginObjectSearch('parking-card'),
    () => undefined,
    () => undefined,
    () => undefined,
    () => undefined,
    () => act.requestExitCheck(),
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
    // 电影时间轴独立于仿真时间；0.1× 保证 60 秒故事结束时仍保留有效路线。
    setSpeed(0.1);
    act.reset();
    act.scenario('visionLoop');
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
