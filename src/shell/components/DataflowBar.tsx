import type { CockpitState } from '../../core';

/** 感知 → Eva → 控制 三层数据流动画条（reduced-motion 下退化为静态图示） */
export default function DataflowBar({ snap }: { snap: CockpitState }) {
  const vActive = !!snap.driver.vision;
  return (
    <div className="flow" role="img" aria-label={`数据流：${vActive ? '视觉/工况感知' : '工况感知'} → Eva 决策 → 座舱与 L2 控制，当前 Eva ${snap.evaMode}`}>
      <span className={`flow-node${vActive ? ' hot' : ''}`}>{vActive ? '👁 视觉 + 工况感知' : '🚗 工况感知'}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className="flow-node eva">Eva {snap.evaMode}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className="flow-node">🧊 座舱 / L2 控制</span>
      <span className="flow-stat" aria-hidden="true">
        主动 {snap.stats.proact} · 调节 {snap.stats.cabinAdj} · 风险处置 {snap.stats.risk}
      </span>
    </div>
  );
}
