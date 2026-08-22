import type { CockpitState } from '../../core';
import Gauge from './Gauge';

/** 驾驶员状态：疲劳（双通道融合）/ 注意力 / 情绪 */
export default function DriverPanel({ snap }: { snap: CockpitState }) {
  const v = snap.driver.vision;
  return (
    <section className="panel" aria-labelledby="driver-title">
      <h2 className="panel-title" id="driver-title"><span className="dot" aria-hidden="true" />Driver State</h2>
      <div className="gauges">
        <Gauge label="Fatigue" value={snap.driver.fatigue} unit="%" warnAt={60} dangerAt={85} />
        <Gauge label="Attention" value={snap.driver.attention} unit="%" warnAt={45} dangerAt={65} invert />
        <Gauge label="Mood" value={snap.driver.emotion} warnAt={68} dangerAt={80} />
      </div>
      <p className="l2-note" style={{ marginBottom: 0 }}>
        Fatigue = driving-workload accumulation fused with machine-vision PERCLOS
        {v ? ` (current vision source: ${v.source === 'model' ? 'camera model' : 'simulated signal'})` : ' (vision channel not connected)'}.
      </p>
    </section>
  );
}
