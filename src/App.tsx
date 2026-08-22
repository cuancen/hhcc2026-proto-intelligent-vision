import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMsg, CockpitState, ScenarioId } from './core';
import Landing from './landing/Landing';
import { ambientLevelOf } from './shell/ambient';
import { runAutoDemo } from './shell/autoDemo';
import type { AutoDemoHandle, DemoCue, DemoStep, DemoTransportState } from './shell/autoDemo';
import CinemaControls from './shell/components/CinemaControls';
import CockpitHeader from './shell/components/CockpitHeader';
import EntryTransition from './shell/components/EntryTransition';
import EvaNarration from './shell/components/EvaNarration';
import EvidenceDrawer from './shell/components/EvidenceDrawer';
import StoryRail from './shell/components/StoryRail';
import { deriveMood } from './shell/evaFace';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import { useUiPrefs } from './shell/hooks/useUiPrefs';
import TwinStage from './shell/twin/TwinStage';
import { deriveTwinFrame } from './shell/twin/twinState';

const SCENARIO_KEYS: Record<string, ScenarioId> = {
  '1': 'commute',
  '2': 'fatigue',
  '3': 'complex',
  '4': 'visionLoop',
};

function routeOf(): 'landing' | 'cockpit' {
  return window.location.hash.startsWith('#/cockpit') ? 'cockpit' : 'landing';
}

function cueFromState(state: CockpitState): DemoCue | null {
  switch (state.context.phase) {
    case 'observed': return 'observe-cabin';
    case 'searching': return 'gaze-away';
    case 'assisting': return 'assistance';
    case 'verified': return 'verified';
    case 'exit-check': return 'exit-filter';
    case 'exit-reminded': return 'completed';
    default: return null;
  }
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
  const [selectedScenario, setSelectedScenario] = useState<ScenarioId>('visionLoop');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const demoRef = useRef<AutoDemoHandle | null>(null);
  const dmsRef = useRef(dms);
  const handoffConsumedRef = useRef(false);
  dmsRef.current = dms;

  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (route !== 'cockpit') return;
    document.body.classList.add('cockpit-body');
    document.title = 'EVA Digital Twin — 视觉情境闭环';
    return () => {
      document.body.classList.remove('cockpit-body');
      demoRef.current?.stop();
      demoRef.current = null;
      pause();
    };
  }, [pause, route]);

  const startDemo = useCallback(() => {
    setSelectedScenario('visionLoop');
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
    setSelectedScenario(id);
    if (id === 'visionLoop') {
      startDemo();
      return;
    }
    stopDemoHandle();
    pause();
    act.reset();
    act.scenario(id);
    refresh();
    play();
    setTransport('running');
  }, [act, pause, play, refresh, startDemo, stopDemoHandle]);

  const primaryAction = useCallback(() => {
    if (transport === 'ready') {
      runScenario(selectedScenario);
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
    runScenario(selectedScenario);
  }, [pause, play, runScenario, selectedScenario, transport]);

  const restart = useCallback(() => {
    if (selectedScenario === 'visionLoop') startDemo();
    else runScenario(selectedScenario);
  }, [runScenario, selectedScenario, startDemo]);

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
  const twinFrame = deriveTwinFrame(snap, cue, mood);
  const eventStages = snap.context.events.map((event) => event.stage);

  return (
    <div
      className="cinema-cockpit"
      data-ambient={ambientLevelOf(snap)}
      data-transport={transport}
      data-route-km={snap.drive.routeKm.toFixed(3)}
      data-sim-time={snap.t.toFixed(3)}
    >
      <a className="skip-link" href="#main">跳到数字孪生主舞台</a>
      <main className="cinema-main" id="main">
        <TwinStage liveState={liveState} frame={twinFrame} running={running} onReady={() => setTwinReady(true)} />
        <div className="cinema-vignette" aria-hidden="true" />

        <CockpitHeader snap={snap} step={demoStep} transport={transport} onOpenEvidence={() => setEvidenceOpen(true)} />

        <div className="twin-boundary" aria-label="数据来源边界">
          <span><i aria-hidden="true" />DMS {dms.mode === 'model' ? '真实 · 本地' : dms.mode === 'sim' ? '模拟信号' : '可接入真实摄像头'}</span>
          <span>物品事件 · 模拟</span>
        </div>

        <div className="cinema-story-layer">
          <EvaNarration message={latestEva} step={demoStep} transport={transport} mood={mood} voiceOn={prefs.voice} />
          <StoryRail cue={cue} eventStages={eventStages} transport={transport} />
          <CinemaControls
            transport={transport}
            scenario={selectedScenario}
            onPrimary={primaryAction}
            onRestart={restart}
            onScenario={runScenario}
          />
        </div>
      </main>

      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
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
