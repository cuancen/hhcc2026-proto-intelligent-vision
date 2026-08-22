import type { CockpitState } from '../../core';

/** 感知 → Eva → 控制 三层数据流动画条（reduced-motion 下退化为静态图示） */
export default function DataflowBar({ snap }: { snap: CockpitState }) {
  const vActive = !!snap.driver.vision;
  return (
    <div className="flow" role="img" aria-label={`Data flow: ${vActive ? 'vision + workload sensing' : 'workload sensing'} → Eva decision → cabin & L2 control; Eva is currently ${snap.evaMode}`}>
      <span className={`flow-node${vActive ? ' hot' : ''}`}>{vActive ? '👁 Vision + workload' : '🚗 Workload sensing'}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className="flow-node eva">Eva · {snap.evaMode}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className="flow-node">🧊 Cabin / L2 control</span>
      <span className="flow-stat" aria-hidden="true">
        proactive {snap.stats.proact} · adjusted {snap.stats.cabinAdj} · risk handled {snap.stats.risk}
      </span>
    </div>
  );
}
