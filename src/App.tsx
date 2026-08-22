import { useCallback, useEffect, useRef, useState } from 'react';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import { useUiPrefs } from './shell/hooks/useUiPrefs';
import { runAutoDemo } from './shell/autoDemo';
import type { AutoDemoHandle, DemoStep } from './shell/autoDemo';
import { ambientLevelOf } from './shell/ambient';
import Landing from './landing/Landing';
import TopBar from './shell/components/TopBar';
import DemoBanner from './shell/components/DemoBanner';
import BootSplash from './shell/components/BootSplash';
import EvaAgent from './shell/components/EvaAgent';
import DriverPanel from './shell/components/DriverPanel';
import SceneView from './shell/components/SceneView';
import DmsPanel from './shell/components/DmsPanel';
import DataflowBar from './shell/components/DataflowBar';
import AdasPanel from './shell/components/AdasPanel';
import CabinPanel from './shell/components/CabinPanel';
import AlertCenter from './shell/components/AlertCenter';
import StatsPanel from './shell/components/StatsPanel';
import ControlBar from './shell/components/ControlBar';
import type { ScenarioId } from './core';

const SCENARIO_KEYS: Record<string, ScenarioId> = {
  '1': 'commute',
  '2': 'fatigue',
  '3': 'complex',
};

/** hash 路由（零路由库依赖）：#/cockpit 进座舱，其余（含默认）显示品牌首页 */
function routeOf(): 'landing' | 'cockpit' {
  return window.location.hash.startsWith('#/cockpit') ? 'cockpit' : 'landing';
}

export default function App() {
  const [route, setRoute] = useState<'landing' | 'cockpit'>(routeOf);
  const { snap, act, liveState, speed, setSpeed } = useCockpit();
  const dms = useDms(act, liveState);
  const prefs = useUiPrefs();
  const [booted, setBooted] = useState(false);
  const [autoDemoRunning, setAutoDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState<DemoStep | null>(null);
  const demoRef = useRef<AutoDemoHandle | null>(null);
  const dmsRef = useRef(dms);
  dmsRef.current = dms;

  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const stopDemo = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    setAutoDemoRunning(false);
    setDemoStep(null);
  }, []);

  const toggleDemo = useCallback(() => {
    if (demoRef.current) {
      stopDemo();
      return;
    }
    setAutoDemoRunning(true);
    demoRef.current = runAutoDemo({
      act,
      ensureSimVision: () => {
        if (dmsRef.current.mode === 'off') dmsRef.current.startSim();
      },
      setSpeed,
      onStep: setDemoStep,
    });
    window.setTimeout(() => stopDemo(), 64_000);
  }, [act, setSpeed, stopDemo]);

  // 键盘快捷键：1/2/3 场景 · D 自动演示 · L L2 开关（输入框内不触发；仅座舱路由生效）
  useEffect(() => {
    if (route !== 'cockpit') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const sc = SCENARIO_KEYS[e.key];
      if (sc) act.scenario(sc);
      else if (e.key === 'd' || e.key === 'D') toggleDemo();
      else if (e.key === 'l' || e.key === 'L') act.setAuto(!liveState().drive.auto);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, act, toggleDemo, liveState]);

  // Landing「Run Live Demo」接力：进入座舱且开机动画结束后自动开演
  useEffect(() => {
    if (route !== 'cockpit' || !booted) return;
    let flag = false;
    try {
      flag = window.sessionStorage.getItem('eva.autodemo') === '1';
      if (flag) window.sessionStorage.removeItem('eva.autodemo');
    } catch { /* 隐私模式 */ }
    if (flag) toggleDemo();
  }, [route, booted, toggleDemo]);

  if (route === 'landing') return <Landing />;

  return (
    <div className="cockpit" data-ambient={ambientLevelOf(snap)}>
      {!booted && <BootSplash onDone={() => setBooted(true)} />}
      <a className="skip-link" href="#main">Skip to main content</a>
      <TopBar
        snap={snap}
        fontScale={prefs.scale}
        onZoom={prefs.zoom}
        highContrast={prefs.highContrast}
        onToggleContrast={prefs.toggleHighContrast}
        voiceOn={prefs.voice}
        onToggleVoice={prefs.toggleVoice}
      />

      <DemoBanner step={demoStep} running={autoDemoRunning} onStop={stopDemo} />

      <main className="cockpit-main" id="main">
        <div className="col col-left">
          <EvaAgent snap={snap} act={act} voiceOn={prefs.voice} />
          <DriverPanel snap={snap} />
        </div>

        <div className="col col-center">
          <SceneView liveState={liveState} />
          <DataflowBar snap={snap} />
          <DmsPanel
            mode={dms.mode}
            status={dms.status}
            sample={dms.sample}
            videoRef={dms.videoRef}
            canvasRef={dms.canvasRef}
            onStartModel={() => void dms.startModel()}
            onStartSim={dms.startSim}
            onStop={dms.stopAll}
          />
        </div>

        <div className="col col-right">
          <AdasPanel snap={snap} act={act} />
          <CabinPanel snap={snap} />
          <AlertCenter snap={snap} />
          <StatsPanel snap={snap} />
        </div>
      </main>

      <ControlBar
        snap={snap}
        act={act}
        speed={speed}
        setSpeed={setSpeed}
        autoDemoRunning={autoDemoRunning}
        onToggleAutoDemo={toggleDemo}
      />
    </div>
  );
}
