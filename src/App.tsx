import { useState } from 'react';
import { useCockpit } from './shell/hooks/useCockpit';
import TopBar from './shell/components/TopBar';
import EvaAgent from './shell/components/EvaAgent';
import DriverPanel from './shell/components/DriverPanel';
import SceneView from './shell/components/SceneView';
import AdasPanel from './shell/components/AdasPanel';
import CabinPanel from './shell/components/CabinPanel';
import AlertCenter from './shell/components/AlertCenter';
import StatsPanel from './shell/components/StatsPanel';
import ControlBar from './shell/components/ControlBar';

export default function App() {
  const { snap, act, liveState, speed, setSpeed } = useCockpit();
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
          <section className="panel" aria-labelledby="dms-title">
            <h2 className="panel-title" id="dms-title"><span className="dot" aria-hidden="true" />机器视觉 · 驾驶员监测</h2>
            <p className="l2-note" style={{ margin: 0 }}>
              机器视觉模块（摄像头 → 面部关键点 → 眨眼 / PERCLOS / 头部姿态）将在下一步接入，
              并与仿真疲劳双通道融合。当前疲劳度仅由行车工况通道驱动。
            </p>
          </section>
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
