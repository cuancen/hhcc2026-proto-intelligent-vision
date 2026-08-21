import type { CockpitActions, CockpitState } from '../../core';

const ROAD_LABEL: Record<CockpitState['drive']['road'], string> = {
  city: '城市道路',
  highway: '高速',
  congested: '拥堵',
};

/** L2 辅助驾驶面板：明确“辅助”定位与驾驶员监管责任 */
export default function AdasPanel({ snap, act }: { snap: CockpitState; act: CockpitActions }) {
  const d = snap.drive;
  return (
    <section className="panel" aria-labelledby="adas-title">
      <h2 className="panel-title" id="adas-title"><span className="dot" aria-hidden="true" />L2 辅助驾驶</h2>

      <div className={`adas-row${d.auto ? ' on' : ''}`}>
        <span>自适应巡航 ACC</span>
        <span className="st">{d.auto ? `目标 ${d.targetSpeed} km/h` : '待机'}</span>
      </div>
      <div className={`adas-row${d.auto && !d.l2Degraded ? ' on' : ''}${d.l2Degraded ? ' degraded' : ''}`}>
        <span>车道居中 LKA</span>
        <span className="st">{!d.auto ? '待机' : d.l2Degraded ? '降级' : '工作中'}</span>
      </div>
      <div className={`adas-row${d.l2Degraded ? ' degraded' : d.auto ? ' on' : ''}`}>
        <span>跟车时距</span>
        <span className="st">{d.l2Degraded ? '已拉大（分神防护）' : d.auto ? '1.5s' : '—'}</span>
      </div>
      <div className="adas-row">
        <span>路况 · {ROAD_LABEL[d.road]}</span>
        <span className="st">
          {[d.rain && '雨', d.night && '夜', d.curve > 0.35 && '弯道'].filter(Boolean).join(' · ') || '良好'}
        </span>
      </div>

      <button
        type="button"
        className={`btn${d.auto ? ' active' : ''}`}
        style={{ width: '100%', marginTop: 4 }}
        aria-pressed={d.auto}
        onClick={() => act.setAuto(!d.auto)}
      >
        {d.auto ? '退出 L2 辅助驾驶' : '开启 L2 辅助驾驶'}
      </button>

      <p className="l2-note">
        L2 = 组合辅助驾驶：系统在车道内辅助转向与加减速，<b>驾驶员始终是驾驶责任的主体</b>，
        请保持对路况的观察，随时准备接管。Eva 的视觉守护在 L2 与人工驾驶下均持续工作。
      </p>
    </section>
  );
}
