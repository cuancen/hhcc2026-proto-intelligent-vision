import type { CockpitState } from '../../core';

/** AI OS 系统指标：主动服务 / 风险处置 / 座舱调节 / 满意度代理指标 */
export default function StatsPanel({ snap }: { snap: CockpitState }) {
  const s = snap.stats;
  const satisfaction = Math.max(60, Math.min(99, 88 + s.proact - s.urgentAlerts * 3)).toFixed(0);
  return (
    <section className="panel" aria-labelledby="stats-title">
      <h2 className="panel-title" id="stats-title"><span className="dot" aria-hidden="true" />AI OS 指标</h2>
      <div className="stats-grid">
        <div className="stat"><b>{s.proact}</b><span>主动服务</span></div>
        <div className="stat"><b>{s.risk}</b><span>风险处置</span></div>
        <div className="stat"><b>{s.cmd}</b><span>语音指令</span></div>
        <div className="stat"><b>{s.cabinAdj}</b><span>座舱调节</span></div>
        <div className="stat"><b>{s.warnAlerts}</b><span>预警次数</span></div>
        <div className="stat"><b>{satisfaction}%</b><span>满意度代理</span></div>
      </div>
    </section>
  );
}
