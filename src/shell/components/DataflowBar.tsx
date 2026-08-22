import type { CockpitState } from '../../core';

/** 人/物感知 → 情境理解 → Eva 行动 → 视觉确认（reduced-motion 下退化为静态图示） */
export default function DataflowBar({ snap }: { snap: CockpitState }) {
  const vActive = !!snap.driver.vision;
  const memoryActive = snap.context.memory.length > 0;
  const verified = snap.context.phase === 'verified';
  return (
    <div className="flow" role="img" aria-label={`数据流：人、物与工况感知 → 情境理解 → Eva 行动 → 结果确认，当前 Eva ${snap.evaMode}`}>
      <span className={`flow-node${vActive ? ' hot' : ''}`}>{vActive ? '👁 人 / 物 / 工况' : '🚗 工况感知'}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className={`flow-node memory${memoryActive ? ' hot' : ''}`}>情境记忆</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className="flow-node eva">Eva {snap.evaMode}</span>
      <span className="flow-arrow" aria-hidden="true">→</span>
      <span className={`flow-node verify${verified ? ' hot' : ''}`}>行动 / 确认</span>
      <span className="flow-stat" aria-hidden="true">
        协助 {snap.stats.contextAssist} · 确认 {snap.stats.contextVerified} · 风险处置 {snap.stats.risk}
      </span>
    </div>
  );
}
