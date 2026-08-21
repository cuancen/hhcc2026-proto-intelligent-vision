import { useCallback, useEffect, useRef, useState } from 'react';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import { runAutoDemo } from './shell/autoDemo';
import type { AutoDemoHandle } from './shell/autoDemo';
import TopBar from './shell/components/TopBar';
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

export default function App() {
  const { snap, act, liveState, speed, setSpeed } = useCockpit();
  const dms = useDms(act, liveState);
  const [autoDemoRunning, setAutoDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState('');
  const demoRef = useRef<AutoDemoHandle | null>(null);
  const dmsRef = useRef(dms);
  dmsRef.current = dms;

  const stopDemo = useCallback(() => {
    demoRef.current?.stop();
    demoRef.current = null;
    setAutoDemoRunning(false);
    setDemoStep('');
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

  // 键盘快捷键：1/2/3 场景 · D 自动演示 · L L2 开关（输入框内不触发）
  useEffect(() => {
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
  }, [act, toggleDemo, liveState]);

  return (
    <div className="cockpit">
      <TopBar snap={snap} />

      <main className="cockpit-main" id="main">
        <div className="col col-left">
          <EvaAgent snap={snap} act={act} />
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
        demoStep={demoStep}
      />
    </div>
  );
}
