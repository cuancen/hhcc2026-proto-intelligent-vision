import { P } from '../core';
import type { CockpitActions, TraceDmsMode, VisionSample } from '../core';

export type DemoCue =
  | 'oms-cruise'
  | 'oms-candidate'
  | 'oms-prompt'
  | 'oms-correlate'
  | 'oms-decide'
  | 'oms-urgent'
  | 'oms-clear'
  | 'oms-verify'
  | 'moment-trace'
  | 'commute'
  | 'fatigue-monitoring'
  | 'fatigue-care'
  | 'fatigue-urgent'
  | 'fatigue-rest'
  | 'complex-roads'
  | 'conditions-ease'
  | 'voice-command'
  | 'cabin-memory'
  | 'completed';

export type DemoTransportState = 'ready' | 'running' | 'paused' | 'completed';

export interface DemoStep {
  i: number;
  total: number;
  cue: DemoCue;
  title: string;
  note: string;
  voice?: boolean;
}

type StepGate = 'away' | 'forward' | 'confirmation';

export interface DemoStepDefinition {
  sec: number;
  cue: DemoCue;
  title: string;
  note: string;
  voice?: boolean;
  gate?: StepGate;
  maxWaitSec?: number;
}

export const DEMO_DURATION_SEC = 35;

/** OMS MomentTrace 主线：理想时长 35 秒；主动选择的端侧输入可参与条件推进。 */
export const DEMO_STEPS: readonly DemoStepDefinition[] = [
  { sec: 0.5, cue: 'oms-cruise', title: 'OMS MomentTrace · Cabin in motion', note: 'MomentTrace is ready. DMS stays local, OMS is simulated, and you remain in charge.' },
  { sec: 4, cue: 'oms-candidate', title: 'OMS · Rear-right movement', note: 'Rear-right movement detected.' },
  { sec: 6, cue: 'oms-prompt', title: 'EVA · Check rear right', note: 'Check the rear-right seat, while keeping the road supervised.' },
  { sec: 10, cue: 'oms-correlate', title: 'DMS × OMS · Cause linked', note: 'Your glance matches the rear-right event, while fatigue evidence stays normal.', gate: 'away', maxWaitSec: 6 },
  { sec: 13, cue: 'oms-decide', title: 'Decision · Not fatigue', note: 'PERCLOS is normal. This response is not fatigue.', voice: false },
  { sec: 15, cue: 'oms-urgent', title: 'Risk confirmed · 1.2 s', note: 'Rear-right passenger, move fully inside. I am reducing speed.' },
  { sec: 23, cue: 'oms-clear', title: 'OMS · Occupant recovered', note: 'Passenger inside. I am checking that your attention is forward.' },
  { sec: 29, cue: 'oms-verify', title: 'DMS · Eyes forward', note: 'Eyes forward. Please confirm that the cabin is safe.', gate: 'forward', maxWaitSec: 6 },
  { sec: 32, cue: 'moment-trace', title: 'MomentTrace · Closed loop', note: 'Closed loop recorded, with every source clearly identified.', gate: 'confirmation' },
  { sec: 35, cue: 'completed', title: 'MomentTrace complete', note: 'MomentTrace complete.', voice: false },
];

export interface AutoDemoDeps {
  act: CockpitActions;
  traceDmsMode: TraceDmsMode;
  getVision: () => VisionSample | null;
  activateReplayDms: () => void;
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
  confirmSafety(): void;
  getState(): DemoTransportState;
  getTraceDmsMode(): TraceDmsMode;
}

const isAwayEvidence = (sample: VisionSample | null) => !!sample?.present
  && sample.lookAwaySec >= 1.2
  && (Math.abs(sample.yaw) > 22 || Math.abs(sample.pitch) > 18)
  && sample.perclos < P.perclosTh.warn;

const isForwardEvidence = (sample: VisionSample | null) => !!sample?.present
  && sample.lookAwaySec < 0.1
  && Math.abs(sample.yaw) <= 22
  && Math.abs(sample.pitch) <= 18;

export function runAutoDemo({
  act,
  traceDmsMode: initialTraceDmsMode,
  getVision,
  activateReplayDms,
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
  let traceDmsMode = initialTraceDmsMode;
  let elapsedMs = 0;
  let startedAt = 0;
  let lastPumpAt: number | null = null;
  let scheduleShiftMs = 0;
  let nextIndex = 0;
  let forwardSince: number | null = null;
  let safetyConfirmed = false;

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

  const currentElapsedMs = () => elapsedMs + (transport === 'running' ? now() - startedAt : 0);

  const switchToReplay = () => {
    if (traceDmsMode === 'replay-fallback') return;
    traceDmsMode = 'replay-fallback';
    activateReplayDms();
    act.setMomentTraceDmsMode('replay-fallback');
  };

  const stepAction = (cue: DemoCue) => {
    if (cue === 'oms-correlate') act.setMomentTracePhase('correlate');
    if (cue === 'oms-decide') act.setMomentTracePhase('decide');
    if (cue === 'oms-candidate') {
      act.observeOms({ behavior: 'head-outside-window', seat: 'rear-right', confidence: 0.78, durationSec: 0.4, source: 'simulated-oms', observedAt: 0 });
    }
    if (cue === 'oms-urgent') {
      act.observeOms({ behavior: 'body-outside-window', seat: 'rear-right', confidence: 0.96, durationSec: 1.2, source: 'simulated-oms', observedAt: 0 });
      act.setMomentTracePhase('act');
    }
    if (cue === 'oms-clear') act.clearOms();
    if (cue === 'oms-verify') act.setMomentTracePhase('verify');
    if (cue === 'moment-trace') act.setMomentTracePhase('artifact');
    if (cue === 'completed') act.setMomentTracePhase('completed');
  };

  const complete = () => {
    elapsedMs = Math.max(elapsedMs, DEMO_DURATION_SEC * 1000 + scheduleShiftMs);
    clearTimer();
    setSpeed(1);
    setTransport('completed');
    onComplete?.();
  };

  const gateOpen = (definition: DemoStepDefinition, tickAt: number, dueMs: number) => {
    if (!definition.gate) return true;
    if (definition.gate === 'confirmation') return safetyConfirmed;

    const sample = getVision();
    if (traceDmsMode === 'replay-fallback') return true;
    if (definition.gate === 'away' && isAwayEvidence(sample)) return true;
    if (definition.gate === 'forward') {
      if (isForwardEvidence(sample)) {
        if (forwardSince === null) forwardSince = tickAt;
        if (tickAt - forwardSince >= 1_500) return true;
      } else {
        forwardSince = null;
      }
    }

    const maxWaitMs = (definition.maxWaitSec ?? 0) * 1000;
    if (maxWaitMs > 0 && currentElapsedMs() >= dueMs + maxWaitMs) {
      switchToReplay();
      return true;
    }
    return false;
  };

  const pump = () => {
    if (transport !== 'running') return;
    const tickAt = now();
    if (lastPumpAt !== null) {
      const gap = tickAt - lastPumpAt;
      const stallThreshold = Math.max(4_000, intervalMs * 20);
      if (gap > stallThreshold) startedAt += gap - intervalMs;
    }
    lastPumpAt = tickAt;

    const definition = DEMO_STEPS[nextIndex];
    if (!definition) return;
    const elapsed = currentElapsedMs();
    const dueMs = definition.sec * 1000 + scheduleShiftMs;
    if (elapsed < dueMs || !gateOpen(definition, tickAt, dueMs)) return;

    if (definition.gate && elapsed > dueMs) scheduleShiftMs += elapsed - dueMs;
    onStep?.({ i: nextIndex + 1, total: DEMO_STEPS.length, cue: definition.cue, title: definition.title, note: definition.note, voice: definition.voice });
    stepAction(definition.cue);
    nextIndex += 1;
    if (definition.cue === 'completed') complete();
  };

  const beginInterval = () => {
    clearTimer();
    timer = globalThis.setInterval(pump, intervalMs);
  };

  const restart = () => {
    clearTimer();
    elapsedMs = 0;
    scheduleShiftMs = 0;
    nextIndex = 0;
    forwardSince = null;
    safetyConfirmed = false;
    setSpeed(0.15);
    act.reset();
    act.scenario('cabin-safety');
    act.beginMomentTrace(traceDmsMode);
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
    confirmSafety() {
      if (safetyConfirmed) return;
      act.confirmOmsClear();
      safetyConfirmed = true;
      pump();
    },
    getState() {
      return transport;
    },
    getTraceDmsMode() {
      return traceDmsMode;
    },
  };

  restart();
  return handle;
}
