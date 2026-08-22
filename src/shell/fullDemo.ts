import type { CockpitActions, TraceDmsMode, VisionSample } from '../core';
import type { AutoDemoHandle, DemoCue, DemoStep, DemoTransportState } from './autoDemo';

type FullDemoAction =
  | 'commute-start'
  | 'commute-route'
  | 'fatigue-monitor'
  | 'fatigue-care'
  | 'fatigue-urgent'
  | 'fatigue-rest'
  | 'complex-start'
  | 'complex-brake'
  | 'complex-clear'
  | 'memory-start'
  | 'memory-assist'
  | 'memory-verify'
  | 'oms-start'
  | 'oms-candidate'
  | 'oms-correlate'
  | 'oms-decide'
  | 'oms-urgent'
  | 'oms-clear'
  | 'oms-verify'
  | 'oms-artifact'
  | 'complete';

export interface FullDemoStepDefinition {
  sec: number;
  cue: DemoCue;
  title: string;
  note: string;
  action: FullDemoAction;
  voice?: boolean;
}

export const FULL_DEMO_DURATION_SEC = 118;

/** 五个能力按完整闭环顺序串演；句间至少留出约 6 秒，避免播报互相截断。 */
export const FULL_DEMO_STEPS: readonly FullDemoStepDefinition[] = [
  { sec: 0.5, cue: 'commute', title: '01 · Daily Commute', note: 'Welcome back. Your usual route and cabin preferences are ready.', action: 'commute-start' },
  { sec: 6, cue: 'commute', title: 'Daily Commute · Personalized', note: 'Temperature, lighting, and audio settle into your preferred settings.', action: 'commute-route' },
  { sec: 12, cue: 'fatigue-monitoring', title: '02 · Fatigue Guard', note: 'On the highway, EVA combines local DMS evidence with driving workload.', action: 'fatigue-monitor' },
  { sec: 18, cue: 'fatigue-care', title: 'Fatigue Guard · Gentle care', note: 'Early fatigue signs bring cooler air and a calm suggestion to rest.', action: 'fatigue-care' },
  { sec: 24, cue: 'fatigue-urgent', title: 'Fatigue Guard · Urgent', note: 'Fatigue is now severe. Reaching a safe rest point becomes the priority.', action: 'fatigue-urgent' },
  { sec: 30, cue: 'fatigue-rest', title: 'Fatigue Guard · Rest', note: 'Rest mode is active. The cabin quiets down to support recovery.', action: 'fatigue-rest' },
  { sec: 36, cue: 'complex-roads', title: '03 · Complex Roads', note: 'Rain, darkness, and congestion now raise the driving workload together.', action: 'complex-start' },
  { sec: 42, cue: 'complex-roads', title: 'Complex Roads · Coordinated', note: 'A vehicle brakes ahead. Level two assistance responds cautiously under driver supervision.', action: 'complex-brake' },
  { sec: 48, cue: 'conditions-ease', title: 'Complex Roads · Clear', note: 'The road clears, and regular cabin services return without a sudden transition.', action: 'complex-clear' },
  { sec: 54, cue: 'cabin-memory', title: '04 · Cabin Memory', note: 'EVA remembers a parking card in the driver-side door pocket.', action: 'memory-start' },
  { sec: 60, cue: 'cabin-memory', title: 'Cabin Memory · Cause found', note: 'A down-left glance matches the search, so EVA explains where the card was last seen.', action: 'memory-assist' },
  { sec: 66, cue: 'cabin-memory', title: 'Cabin Memory · Verified', note: 'Your eyes return forward. The reading light turns off, and the loop closes.', action: 'memory-verify' },
  { sec: 72, cue: 'oms-cruise', title: '05 · OMS MomentTrace', note: 'The final scene links local DMS evidence with a clearly simulated OMS event.', action: 'oms-start' },
  { sec: 78, cue: 'oms-candidate', title: 'OMS · Rear-right movement', note: 'OMS detects movement at the rear-right window and starts timing it.', action: 'oms-candidate' },
  { sec: 84, cue: 'oms-correlate', title: 'DMS × OMS · Cause linked', note: 'The driver glance aligns with that passenger event, while fatigue evidence remains normal.', action: 'oms-correlate' },
  { sec: 90, cue: 'oms-decide', title: 'Decision · Not fatigue', note: 'Normal PERCLOS rules out fatigue.', action: 'oms-decide', voice: false },
  { sec: 94, cue: 'oms-urgent', title: 'Risk confirmed · 1.2 s', note: 'Rear-right passenger, move fully inside. EVA is reducing speed and extending distance.', action: 'oms-urgent' },
  { sec: 100, cue: 'oms-clear', title: 'OMS · Occupant recovered', note: 'The passenger is back inside. EVA now checks that driver attention has recovered.', action: 'oms-clear' },
  { sec: 106, cue: 'oms-verify', title: 'DMS · Eyes forward', note: 'Both signals show recovery. The temporary protection can now be released.', action: 'oms-verify' },
  { sec: 112, cue: 'moment-trace', title: 'MomentTrace · Closed loop', note: 'MomentTrace preserves the input, decision, action, verification, and source boundaries.', action: 'oms-artifact' },
  { sec: 118, cue: 'completed', title: 'Full Demo complete', note: 'Five EVA experiences complete.', action: 'complete', voice: false },
];

const vision = (lookAwaySec: number, yaw: number): VisionSample => ({
  present: true,
  perclos: 0.08,
  blinkPm: 16,
  lookAwaySec,
  yaw,
  pitch: 2,
  ear: 0.31,
  emotion: 'neutral',
  source: 'sim',
});

export function runFullDemo({
  act,
  traceDmsMode,
  setSpeed,
  setSimulationRunning = () => undefined,
  onOmsStart = () => undefined,
  onStep,
  onTransport,
  onComplete,
  now = () => Date.now(),
  intervalMs = 50,
}: {
  act: CockpitActions;
  traceDmsMode: TraceDmsMode;
  setSpeed: (value: number) => void;
  setSimulationRunning?: (running: boolean) => void;
  onOmsStart?: () => void;
  onStep?: (step: DemoStep) => void;
  onTransport?: (state: DemoTransportState) => void;
  onComplete?: () => void;
  now?: () => number;
  intervalMs?: number;
}): AutoDemoHandle {
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  let transport: DemoTransportState = 'ready';
  let elapsedMs = 0;
  let startedAt = 0;
  let nextIndex = 0;

  const clearTimer = () => {
    if (timer === null) return;
    globalThis.clearInterval(timer);
    timer = null;
  };
  const currentElapsedMs = () => elapsedMs + (transport === 'running' ? now() - startedAt : 0);
  const setTransport = (next: DemoTransportState) => {
    transport = next;
    setSimulationRunning(next === 'running');
    onTransport?.(next);
  };

  const applyAction = (action: FullDemoAction) => {
    if (action === 'commute-start') {
      act.scenario('commute', { announce: false });
      setSpeed(0.45);
    } else if (action === 'commute-route') {
      act.command('navigation');
    } else if (action === 'fatigue-monitor') {
      act.scenario('fatigue', { announce: false });
      act.setSimFatigue(48);
      setSpeed(0.5);
    } else if (action === 'fatigue-care') {
      act.setSimFatigue(62);
    } else if (action === 'fatigue-urgent') {
      act.setSimFatigue(88);
    } else if (action === 'fatigue-rest') {
      act.command('rest');
      setSpeed(0.22);
    } else if (action === 'complex-start') {
      act.scenario('complex', { announce: false });
      act.setRain(true);
      act.setNight(true);
      setSpeed(0.38);
    } else if (action === 'complex-brake') {
      act.injectLeadBrake();
    } else if (action === 'complex-clear') {
      act.setRain(false);
      act.setNight(false);
      setSpeed(0.42);
    } else if (action === 'memory-start') {
      act.scenario('commute', { announce: false });
      act.observeCabinObject({
        id: 'parking-card',
        label: 'Parking card',
        location: 'driver-side door pocket',
        owner: 'driver',
        importance: 'important',
        confidence: 0.94,
      });
      act.beginObjectSearch('parking-card');
      setSpeed(0.3);
    } else if (action === 'memory-assist') {
      act.setVision(vision(2.4, -28));
    } else if (action === 'memory-verify') {
      act.setVision(vision(0, 0));
    } else if (action === 'oms-start') {
      act.scenario('cabin-safety', { announce: false });
      act.beginMomentTrace(traceDmsMode);
      onOmsStart();
      setSpeed(0.15);
    } else if (action === 'oms-candidate') {
      act.observeOms({ behavior: 'head-outside-window', seat: 'rear-right', confidence: 0.78, durationSec: 0.4, source: 'simulated-oms', observedAt: 0 });
    } else if (action === 'oms-correlate') {
      act.setVision(vision(1.4, -28));
      act.setMomentTracePhase('correlate');
    } else if (action === 'oms-decide') {
      act.setMomentTracePhase('decide');
    } else if (action === 'oms-urgent') {
      act.observeOms({ behavior: 'body-outside-window', seat: 'rear-right', confidence: 0.96, durationSec: 1.2, source: 'simulated-oms', observedAt: 0 });
      act.setMomentTracePhase('act');
    } else if (action === 'oms-clear') {
      act.clearOms();
    } else if (action === 'oms-verify') {
      act.setVision(vision(0, 0));
      act.setMomentTracePhase('verify');
    } else if (action === 'oms-artifact') {
      act.confirmOmsClear();
      act.setMomentTracePhase('artifact');
    } else if (action === 'complete') {
      act.setMomentTracePhase('completed');
    }
  };

  const complete = () => {
    elapsedMs = FULL_DEMO_DURATION_SEC * 1000;
    clearTimer();
    setSpeed(1);
    setTransport('completed');
    onComplete?.();
  };

  const pump = () => {
    if (transport !== 'running') return;
    const definition = FULL_DEMO_STEPS[nextIndex];
    if (!definition || currentElapsedMs() < definition.sec * 1000) return;
    applyAction(definition.action);
    onStep?.({
      i: nextIndex + 1,
      total: FULL_DEMO_STEPS.length,
      cue: definition.cue,
      title: definition.title,
      note: definition.note,
      voice: definition.voice,
    });
    nextIndex += 1;
    if (definition.action === 'complete') complete();
  };

  const beginInterval = () => {
    clearTimer();
    timer = globalThis.setInterval(pump, intervalMs);
  };

  const restart = () => {
    clearTimer();
    elapsedMs = 0;
    nextIndex = 0;
    act.reset();
    act.scenario('commute', { announce: false });
    startedAt = now();
    setTransport('running');
    beginInterval();
    pump();
  };

  const handle: AutoDemoHandle = {
    pause() {
      if (transport !== 'running') return;
      elapsedMs = currentElapsedMs();
      clearTimer();
      setTransport('paused');
    },
    resume() {
      if (transport !== 'paused') return;
      startedAt = now();
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
    confirmSafety() {
      // Full Demo 在双传感器恢复后自动完成确认，保证无人值守演示不中断。
    },
    getState: () => transport,
    getTraceDmsMode: () => traceDmsMode,
  };

  restart();
  return handle;
}
