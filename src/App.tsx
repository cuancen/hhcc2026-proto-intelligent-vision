import { useState } from 'react';
import { useCockpit } from './shell/hooks/useCockpit';
import { useDms } from './shell/hooks/useDms';
import TopBar from './shell/components/TopBar';
import EvaAgent from './shell/components/EvaAgent';
import DriverPanel from './shell/components/DriverPanel';
import SceneView from './shell/components/SceneView';
import DmsPanel from './shell/components/DmsPanel';
import AdasPanel from './shell/components/AdasPanel';
import CabinPanel from './shell/components/CabinPanel';
import AlertCenter from './shell/components/AlertCenter';
import StatsPanel from './shell/components/StatsPanel';
import ControlBar from './shell/components/ControlBar';

export default function App() {
  const { snap, act, liveState, speed, setSpeed } = useCockpit();
  const dms = useDms(act, liveState);
  const [autoDemoRunning, setAutoDemoRunning] = useState(false);

  return (
    <div className="cockpit">
      <TopBar snap={snap} />

      <div className="cockpit-main">
        <div className="col col-left">
          <EvaAgent snap={snap} act={act} />
          <DriverPanel snap={snap} />
        </div>

        <div className="col col-center">
          <SceneView liveState={liveState} />
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
      </div>

      <ControlBar
        snap={snap}
        act={act}
        speed={speed}
        setSpeed={setSpeed}
        autoDemoRunning={autoDemoRunning}
        onToggleAutoDemo={() => setAutoDemoRunning(false)}
      />
    </div>
  );
}
