import type { CockpitState } from '../../core';

const AMBIENT_HEX: Record<string, string> = {
  青碧: '#2dd4bf',
  暖橙: '#fb923c',
};

/** 座舱环境：Eva 的调节会高亮显示；复杂路况下娱乐被屏蔽 */
export default function CabinPanel({ snap }: { snap: CockpitState }) {
  const c = snap.cabin;
  return (
    <section className="panel" aria-labelledby="cabin-title">
      <h2 className="panel-title" id="cabin-title"><span className="dot" aria-hidden="true" />座舱环境</h2>
      <div className="cabin-grid">
        <div className="cabin-item">
          <span className="k">温度</span><b>{c.temp.toFixed(1)}℃</b>
        </div>
        <div className="cabin-item">
          <span className="k">风量</span><b>{['关', '1 档', '2 档', '3 档'][c.fan]}</b>
        </div>
        <div className={`cabin-item${c.entertainmentBlocked ? ' blocked' : ''}`}>
          <span className="k">音乐</span>
          <b>{c.entertainmentBlocked ? '已屏蔽' : c.music}</b>
        </div>
        <div className="cabin-item">
          <span className="k">座椅按摩</span><b>{c.seatMassage ? '开' : '关'}</b>
        </div>
        <div className="cabin-item highlight" style={{ borderColor: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>
          <span className="k">氛围灯</span>
          <b style={{ color: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>{c.ambient}</b>
        </div>
        <div className="cabin-item">
          <span className="k">累计调节</span><b>{snap.stats.cabinAdj} 次</b>
        </div>
      </div>
    </section>
  );
}
