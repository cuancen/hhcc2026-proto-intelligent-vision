import type { CockpitState } from '../../core';

/** AI OS 系统指标：主动服务 / 风险处置 / 座舱调节 / 满意度代理指标 */
export default function StatsPanel({ snap }: { snap: CockpitState }) {
  const s = snap.stats;
  const satisfaction = Math.max(60, Math.min(99, 88 + s.proact - s.urgentAlerts * 3)).toFixed(0);
  return (
    <section className="panel" aria-labelledby="stats-title">
      <h2 className="panel-title" id="stats-title"><span className="dot" aria-hidden="true" />AI OS Metrics</h2>
      <div className="stats-grid">
        <div className="stat"><b>{s.proact}</b><span>Proactive services</span></div>
        <div className="stat"><b>{s.risk}</b><span>Risk handled</span></div>
        <div className="stat"><b>{s.cmd}</b><span>Voice commands</span></div>
        <div className="stat"><b>{s.cabinAdj}</b><span>Cabin adjustments</span></div>
        <div className="stat"><b>{s.warnAlerts}</b><span>Warnings</span></div>
        <div className="stat"><b>{satisfaction}%</b><span>Satisfaction proxy</span></div>
      </div>
    </section>
  );
}
