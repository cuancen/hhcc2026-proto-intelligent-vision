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
  { sec: 0.5, cue: 'boundary', title: '输入透明', note: '驾驶员 DMS 可真实运行；物品位置为模拟视觉事件' },
  { sec: 4, cue: 'observe-cabin', title: '看见 · 关键物品进入记忆', note: '只保留物品、位置与重要度，不保存原始画面' },
  { sec: 9, cue: 'observe-phone', title: '位置随事件更新', note: '手机最后出现在无线充电板' },
  { sec: 16, cue: 'search-intent', title: '驾驶员开始找卡', note: 'EVA 等待视线证据，不急于下结论' },
  { sec: 19, cue: 'gaze-away', title: '视线持续向左下偏离', note: 'DMS 捕捉头姿与视线离开' },
  { sec: 22, cue: 'cause-linked', title: '理解 · 找到分心原因', note: '视线方向与停车卡位置形成关联' },
  { sec: 25, cue: 'assistance', title: '行动 · 直接解决问题', note: '播报位置并打开主驾左侧阅读灯' },
  { sec: 30, cue: 'verified', title: '确认 · 视线已经回正', note: 'DMS 确认风险解除，阅读灯关闭' },
  { sec: 46, cue: 'exit-filter', title: '只提醒重要物品', note: '电脑包与手机被点亮，普通水杯保持静默' },
  { sec: 57, cue: 'completed', title: '闭环完成', note: '看见原因，行动解决，再确认结果' },
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
      act.observeCabinObject({ id: 'parking-card', label: '停车卡', location: '左侧车门储物格', owner: '驾驶员', importance: 'normal', confidence: 0.94 });
      act.observeCabinObject({ id: 'laptop-bag', label: '电脑包', location: '右后座', owner: '驾驶员', importance: 'important', confidence: 0.91 });
      act.observeCabinObject({ id: 'water-bottle', label: '水杯', location: '杯架', owner: '驾驶员', importance: 'normal', confidence: 0.98 });
    },
    () => act.observeCabinObject({ id: 'phone', label: '手机', location: '无线充电板', owner: '驾驶员', importance: 'important', confidence: 0.96 }),
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
