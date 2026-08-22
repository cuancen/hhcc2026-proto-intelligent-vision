import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMsg, CockpitState, ScenarioId, TraceDmsMode } from './core';
import Landing from './landing/Landing';
import { ambientLevelOf } from './shell/ambient';
import { runAutoDemo } from './shell/autoDemo';
import type { AutoDemoHandle, DemoCue, DemoStep, DemoTransportState } from './shell/autoDemo';
import CinemaControls from './shell/components/CinemaControls';
import type { ExperienceId } from './shell/components/CinemaControls';
import CockpitHeader from './shell/components/CockpitHeader';
import EntryTransition from './shell/components/EntryTransition';
import EvaNarration from './shell/components/EvaNarration';
import EvidenceDrawer from './shell/components/EvidenceDrawer';
import MomentTraceArtifact from './shell/components/MomentTraceArtifact';
import { deriveEvaExpression, deriveMood } from './shell/evaFace';
import { createEvidencePlaybackGate } from './shell/evidencePlayback';
import { runFullDemo } from './shell/fullDemo';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import { useUiPrefs } from './shell/hooks/useUiPrefs';
import TwinStage from './shell/twin/TwinStage';
import { deriveTwinFrame } from './shell/twin/twinState';

type ManualScenarioId = Exclude<ScenarioId, 'cabin-safety'>;

const SCENARIO_KEYS: Record<string, ManualScenarioId> = {
  '1': 'commute',
  '2': 'fatigue',
  '3': 'complex',
};

function routeOf(): 'landing' | 'cockpit' {
  return window.location.hash.startsWith('#/cockpit') ? 'cockpit' : 'landing';
}

function cueFromState(state: CockpitState): DemoCue | null {
  if (state.scenario === 'cabin-safety') {
    const cueByPhase: Partial<Record<CockpitState['momentTrace']['phase'], DemoCue>> = {
      perceive: 'oms-cruise',
      correlate: 'oms-correlate',
      decide: 'oms-decide',
      act: 'oms-urgent',
      verify: 'oms-verify',
      artifact: 'moment-trace',
      completed: 'completed',
    };
    return cueByPhase[state.momentTrace.phase] ?? 'oms-cruise';
  }
  if (state.scenario === 'commute') return 'commute';
  if (state.scenario === 'complex') return 'complex-roads';
  if (state.driver.resting) return 'fatigue-rest';
  if (state.driver.fatigue >= 85 || state.pending) return 'fatigue-urgent';
  if (state.driver.fatigue >= 60) return 'fatigue-care';
  return 'fatigue-monitoring';
}

function latestEvaMessage(state: CockpitState): ChatMsg | null {
  for (let index = state.chat.length - 1; index >= 0; index -= 1) {
    if (state.chat[index].role === 'eva') return state.chat[index];
  }
  return null;
}

export default function App() {
  const [route, setRoute] = useState<'landing' | 'cockpit'>(routeOf);
  const { snap, act, liveState, setSpeed, running, play, pause, refresh } = useCockpit();
  const dms = useDms(act, liveState);
  const prefs = useUiPrefs();
  const [entryDone, setEntryDone] = useState(false);
  const [twinReady, setTwinReady] = useState(false);
  const [transport, setTransport] = useState<DemoTransportState>('ready');
  const [demoStep, setDemoStep] = useState<DemoStep | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId>('full-demo');
  const [preparing, setPreparing] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const demoRef = useRef<AutoDemoHandle | null>(null);
  const dmsRef = useRef(dms);
  const launchIdRef = useRef(0);
  const handoffConsumedRef = useRef(false);
  const evidencePlaybackRef = useRef(createEvidencePlaybackGate());
  dmsRef.current = dms;

  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route !== 'cockpit') return;
    document.body.classList.add('cockpit-body');
    document.title = 'EVA Digital Twin — Smart Cockpit';
    return () => {
      launchIdRef.current += 1;
      document.body.classList.remove('cockpit-body');
      demoRef.current?.stop();
      demoRef.current = null;
      dmsRef.current.stopAll();
      evidencePlaybackRef.current.reset();
      setEvidenceOpen(false);
      pause();
    };
  }, [pause, route]);

  const startDemo = useCallback(async () => {
    const launchId = ++launchIdRef.current;
    setSelectedExperience('oms-trace');
    setDemoStep(null);
    demoRef.current?.stop();
    demoRef.current = null;
    pause();
    setTransport('ready');
    setPreparing(true);

    let traceDmsMode: TraceDmsMode = 'replay-fallback';
    try {
      const currentMode = dmsRef.current.getMode();
      const currentSample = dmsRef.current.getSample();
      if (currentMode === 'model' && currentSample?.present) traceDmsMode = 'live';
      else if (currentMode === 'video' && currentSample?.present) traceDmsMode = 'local-video';
      else dmsRef.current.startReplay();
      if (launchId !== launchIdRef.current) return;

      demoRef.current = runAutoDemo({
        act,
        traceDmsMode,
        getVision: dmsRef.current.getSample,
        activateReplayDms: dmsRef.current.startReplay,
        setSpeed,
        setSimulationRunning: (shouldRun) => { if (shouldRun) play(); else pause(); },
        onStep: setDemoStep,
        onTransport: setTransport,
      });
      refresh();
    } finally {
      if (launchId === launchIdRef.current) setPreparing(false);
    }
  }, [act, pause, play, refresh, setSpeed]);

  const startFullDemo = useCallback(() => {
    const launchId = ++launchIdRef.current;
    setSelectedExperience('full-demo');
    setDemoStep(null);
    demoRef.current?.stop();
    demoRef.current = null;
    pause();
    setTransport('ready');
    setPreparing(true);

    const currentMode = dmsRef.current.getMode();
    const currentSample = dmsRef.current.getSample();
    const traceDmsMode: TraceDmsMode = currentMode === 'model' && currentSample?.present
      ? 'live'
      : currentMode === 'video' && currentSample?.present
        ? 'local-video'
        : 'replay-fallback';
    if (launchId !== launchIdRef.current) return;
    if (traceDmsMode === 'replay-fallback') dmsRef.current.startReplay();

    demoRef.current = runFullDemo({
      act,
      traceDmsMode,
      setSpeed,
      setSimulationRunning: (shouldRun) => { if (shouldRun) play(); else pause(); },
      onStep: setDemoStep,
      onTransport: setTransport,
    });
    refresh();
    setPreparing(false);
  }, [act, pause, play, refresh, setSpeed]);

  const stopDemoHandle = useCallback(() => {
    launchIdRef.current += 1;
    demoRef.current?.stop();
    demoRef.current = null;
    setDemoStep(null);
    setPreparing(false);
  }, []);

  const runScenario = useCallback((id: ManualScenarioId) => {
    setSelectedExperience(id);
    stopDemoHandle();
    pause();
    act.reset();
    act.scenario(id);
    refresh();
    play();
    setTransport('running');
  }, [act, pause, play, refresh, stopDemoHandle]);

  const runCabinMemory = useCallback(() => {
    setSelectedExperience('cabin-memory');
    stopDemoHandle();
    pause();
    act.reset();
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
    if (dmsRef.current.getMode() === 'off') dmsRef.current.startSim();
    refresh();
    play();
    setTransport('running');
  }, [act, pause, play, refresh, stopDemoHandle]);

  const runExperience = useCallback((id: ExperienceId) => {
    if (id === 'full-demo') { startFullDemo(); return; }
    if (id === 'oms-trace') { void startDemo(); return; }
    if (id === 'cabin-memory') { runCabinMemory(); return; }
    runScenario(id);
  }, [runCabinMemory, runScenario, startDemo, startFullDemo]);

  const confirmSafety = useCallback(() => {
    if (!liveState().oms.awaitingConfirmation) return;
    if (demoRef.current) demoRef.current.confirmSafety();
    else act.confirmOmsClear();
    refresh();
  }, [act, liveState, refresh]);

  const primaryAction = useCallback(() => {
    if (preparing) return;
    const confirmationReady = snap.oms.awaitingConfirmation
      && selectedExperience === 'oms-trace'
      && (demoStep?.cue === 'oms-verify' || demoStep?.cue === 'moment-trace');
    if (confirmationReady && demoRef.current) {
      confirmSafety();
      return;
    }
    if (transport === 'ready') {
      runExperience(selectedExperience);
      return;
    }
    if (transport === 'running') {
      if (demoRef.current) demoRef.current.pause();
      else { pause(); setTransport('paused'); }
      return;
    }
    if (transport === 'paused') {
      if (demoRef.current) demoRef.current.resume();
      else { play(); setTransport('running'); }
      return;
    }
    runExperience(selectedExperience);
  }, [confirmSafety, demoStep?.cue, pause, play, preparing, runExperience, selectedExperience, snap.oms.awaitingConfirmation, transport]);

  const restart = useCallback(() => {
    if (selectedExperience === 'full-demo') startFullDemo();
    else if (selectedExperience === 'oms-trace') void startDemo();
    else if (selectedExperience === 'cabin-memory') runCabinMemory();
    else runScenario(selectedExperience);
  }, [runCabinMemory, runScenario, selectedExperience, startDemo, startFullDemo]);

  const openEvidence = useCallback(() => {
    const shouldPause = evidencePlaybackRef.current.open(transport);
    if (shouldPause) {
      if (demoRef.current) demoRef.current.pause();
      else { pause(); setTransport('paused'); }
    }
    setEvidenceOpen(true);
  }, [pause, transport]);

  const closeEvidence = useCallback(() => {
    setEvidenceOpen(false);
    if (!evidencePlaybackRef.current.close()) return;
    if (demoRef.current) demoRef.current.resume();
    else { play(); setTransport('running'); }
  }, [play]);

  useEffect(() => {
    if (route !== 'cockpit') return;
    const onKey = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) return;
      if (element?.isContentEditable || event.altKey || event.ctrlKey || event.metaKey) return;
      const scenario = SCENARIO_KEYS[event.key];
      if (scenario) runScenario(scenario);
      else if (event.key === 'd' || event.key === 'D') restart();
      else if (event.key === 'l' || event.key === 'L') { act.setAuto(!liveState().drive.auto); refresh(); }
      else if (event.code === 'Space') { event.preventDefault(); primaryAction(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, liveState, primaryAction, refresh, restart, route, runScenario]);

  useEffect(() => {
    if (route !== 'cockpit' || !entryDone || !twinReady || handoffConsumedRef.current) return;
    let shouldStart = false;
    try {
      shouldStart = window.sessionStorage.getItem('eva.autodemo') === '1';
      if (shouldStart) window.sessionStorage.removeItem('eva.autodemo');
    } catch { /* 浏览器隐私模式 */ }
    handoffConsumedRef.current = true;
    if (shouldStart) startFullDemo();
  }, [entryDone, route, startFullDemo, twinReady]);

  if (route === 'landing') return <Landing />;

  const latestEva = latestEvaMessage(snap);
  const mood = deriveMood(snap.evaMode, latestEva, snap.t, { pending: !!snap.pending });
  const cue = selectedExperience === 'cabin-memory'
    ? 'cabin-memory'
    : demoStep?.cue ?? (transport === 'ready' ? null : cueFromState(snap));
  const expression = deriveEvaExpression(
    demoStep?.cue ?? null,
    mood,
    dms.sample?.emotion ?? snap.driver.vision?.emotion ?? 'neutral',
    transport,
  );
  const twinFrame = deriveTwinFrame(snap, cue, mood);
  const canConfirmSafety = selectedExperience === 'oms-trace'
    && snap.oms.awaitingConfirmation
    && (demoStep?.cue === 'oms-verify' || demoStep?.cue === 'moment-trace');
  return (
    <div
      className="cinema-cockpit"
      data-ambient={ambientLevelOf(snap)}
      data-transport={transport}
      data-route-km={snap.drive.routeKm.toFixed(3)}
      data-sim-time={snap.t.toFixed(3)}
    >
      <a className="skip-link" href="#main">Skip to the digital twin stage</a>
      <main className="cinema-main" id="main">
        <TwinStage liveState={liveState} frame={twinFrame} running={running} onReady={() => setTwinReady(true)} />
        <div className="cinema-vignette" aria-hidden="true" />

        <CockpitHeader snap={snap} step={demoStep} cue={cue} expression={expression} transport={transport} experience={selectedExperience} onOpenEvidence={openEvidence} />

        <div className="twin-boundary" aria-label="Data source boundaries">
          <span><i aria-hidden="true" />{dms.mode === 'model' ? 'DMS · LIVE LOCAL' : dms.mode === 'video' ? 'DMS · LOCAL VIDEO' : dms.mode === 'replay' ? 'DMS · REPLAY FALLBACK' : dms.mode === 'sim' ? 'DMS · SIMULATED SIGNAL' : 'DMS · PREFLIGHT READY'}</span>
          <span>OMS · SIMULATED SEMANTIC EVENT</span>
        </div>

        {twinFrame.traceArtifact && snap.momentTrace.record && <MomentTraceArtifact record={snap.momentTrace.record} />}

        <div className="cinema-story-layer">
          <EvaNarration message={latestEva} step={demoStep} transport={transport} mood={mood} expression={expression} voiceOn={prefs.voice} experience={selectedExperience} />
          <CinemaControls
            transport={transport}
            experience={selectedExperience}
            preparing={preparing}
            canConfirm={canConfirmSafety}
            onPrimary={primaryAction}
            onRestart={restart}
            onExperience={runExperience}
          />
        </div>
      </main>

      <EvidenceDrawer
        open={evidenceOpen}
        onClose={closeEvidence}
        snap={snap}
        act={act}
        refresh={refresh}
        dms={dms}
        prefs={prefs}
        onConfirmSafety={confirmSafety}
      />

      {!entryDone && <EntryTransition onDone={() => setEntryDone(true)} />}
    </div>
  );
}
