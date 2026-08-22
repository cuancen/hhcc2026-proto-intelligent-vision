import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMsg, CockpitState, ScenarioId } from './core';
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
import { deriveEvaExpression, deriveMood } from './shell/evaFace';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import { useUiPrefs } from './shell/hooks/useUiPrefs';
import TwinStage from './shell/twin/TwinStage';
import { deriveTwinFrame } from './shell/twin/twinState';

const SCENARIO_KEYS: Record<string, ScenarioId> = {
  '1': 'commute',
  '2': 'fatigue',
  '3': 'complex',
};

function routeOf(): 'landing' | 'cockpit' {
  return window.location.hash.startsWith('#/cockpit') ? 'cockpit' : 'landing';
}

function cueFromState(state: CockpitState): DemoCue | null {
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
  const [selectedExperience, setSelectedExperience] = useState<ExperienceId>('auto-tour');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const demoRef = useRef<AutoDemoHandle | null>(null);
  const dmsRef = useRef(dms);
  const handoffConsumedRef = useRef(false);
  const evidenceResumeRef = useRef(false);
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
      document.body.classList.remove('cockpit-body');
      demoRef.current?.stop();
      demoRef.current = null;
      pause();
    };
  }, [pause, route]);

  const startDemo = useCallback(() => {
    setSelectedExperience('auto-tour');
    setDemoStep(null);
    if (demoRef.current) {
      demoRef.current.restart();
      return;
    }
    demoRef.current = runAutoDemo({
      act,
      ensureSimVision: () => {
        if (dmsRef.current.mode === 'off') dmsRef.current.startSim();
      },
      setSpeed,
      setSimulationRunning: (shouldRun) => { if (shouldRun) play(); else pause(); },
      onStep: setDemoStep,
      onTransport: setTransport,
    });
  }, [act, pause, play, setSpeed]);

  const stopDemoHandle = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    setDemoStep(null);
  }, []);

  const runScenario = useCallback((id: ScenarioId) => {
    setSelectedExperience(id);
    stopDemoHandle();
    pause();
    act.reset();
    act.scenario(id);
    refresh();
    play();
    setTransport('running');
  }, [act, pause, play, refresh, stopDemoHandle]);

  const runExperience = useCallback((id: ExperienceId) => {
    if (id === 'auto-tour') startDemo();
    else runScenario(id);
  }, [runScenario, startDemo]);

  const primaryAction = useCallback(() => {
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
  }, [pause, play, runExperience, selectedExperience, transport]);

  const restart = useCallback(() => {
    if (selectedExperience === 'auto-tour') startDemo();
    else runScenario(selectedExperience);
  }, [runScenario, selectedExperience, startDemo]);

  const openEvidence = useCallback(() => {
    evidenceResumeRef.current = transport === 'running';
    if (evidenceResumeRef.current) {
      if (demoRef.current) demoRef.current.pause();
      else { pause(); setTransport('paused'); }
    }
    setEvidenceOpen(true);
  }, [pause, transport]);

  const closeEvidence = useCallback(() => {
    setEvidenceOpen(false);
    if (!evidenceResumeRef.current) return;
    evidenceResumeRef.current = false;
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
    if (shouldStart) startDemo();
  }, [entryDone, route, startDemo, twinReady]);

  if (route === 'landing') return <Landing />;

  const latestEva = latestEvaMessage(snap);
  const mood = deriveMood(snap.evaMode, latestEva, snap.t, { pending: !!snap.pending });
  const cue = demoStep?.cue ?? (transport === 'ready' ? null : cueFromState(snap));
  const expression = deriveEvaExpression(
    demoStep?.cue ?? null,
    mood,
    dms.sample?.emotion ?? snap.driver.vision?.emotion ?? 'neutral',
    transport,
  );
  const twinFrame = deriveTwinFrame(snap, cue, mood);
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

        <CockpitHeader snap={snap} step={demoStep} cue={cue} expression={expression} transport={transport} onOpenEvidence={openEvidence} />

        <div className="twin-boundary" aria-label="Data source boundaries">
          <span><i aria-hidden="true" />DMS {dms.mode === 'model' ? 'CAMERA · LOCAL' : dms.mode === 'sim' ? 'SIMULATED SIGNAL' : 'CAMERA READY'}</span>
          <span>DRIVING ENVIRONMENT · SIMULATED</span>
        </div>

        <div className="cinema-story-layer">
          <EvaNarration message={latestEva} step={demoStep} transport={transport} mood={mood} expression={expression} voiceOn={prefs.voice} />
          <CinemaControls
            transport={transport}
            experience={selectedExperience}
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
      />

      {!entryDone && <EntryTransition onDone={() => setEntryDone(true)} />}
    </div>
  );
}
