import type { CockpitActions, CockpitState } from '../../core';

const ROAD_LABEL: Record<CockpitState['drive']['road'], string> = {
  city: 'City',
  highway: 'Highway',
  congested: 'Congested',
};

/** L2 辅助驾驶面板：明确“辅助”定位与驾驶员监管责任 */
export default function AdasPanel({ snap, act }: { snap: CockpitState; act: CockpitActions }) {
  const d = snap.drive;
  return (
    <section className="panel" aria-labelledby="adas-title">
      <h2 className="panel-title" id="adas-title"><span className="dot" aria-hidden="true" />L2 Assisted Driving</h2>

      <div className={`adas-row${d.auto ? ' on' : ''}`}>
        <span>Adaptive cruise ACC</span>
        <span className="st">{d.auto ? `Target ${d.targetSpeed} km/h` : 'Standby'}</span>
      </div>
      <div className={`adas-row${d.auto && !d.l2Degraded ? ' on' : ''}${d.l2Degraded ? ' degraded' : ''}`}>
        <span>Lane centering LKA</span>
        <span className="st">{!d.auto ? 'Standby' : d.l2Degraded ? 'Degraded' : 'Active'}</span>
      </div>
      <div className={`adas-row${d.l2Degraded ? ' degraded' : d.auto ? ' on' : ''}`}>
        <span>Headway</span>
        <span className="st">{d.l2Degraded ? 'Extended (distraction guard)' : d.auto ? '1.5 s' : '—'}</span>
      </div>
      <div className="adas-row">
        <span>Road · {ROAD_LABEL[d.road]}</span>
        <span className="st">
          {[d.rain && 'rain', d.night && 'night', d.curve > 0.35 && 'curves'].filter(Boolean).join(' · ') || 'clear'}
        </span>
      </div>

      <button
        type="button"
        className={`btn${d.auto ? ' active' : ''}`}
        style={{ width: '100%', marginTop: 4 }}
        aria-pressed={d.auto}
        onClick={() => act.setAuto(!d.auto)}
      >
        {d.auto ? 'Exit L2 assisted driving' : 'Enable L2 assisted driving'}
      </button>

      <p className="l2-note">
        L2 = combined assistance: the system helps steer and keep speed within the lane, but <b>the driver remains
        the responsible party at all times</b> — keep watching the road and be ready to take over. Eva's vision
        guard keeps working under both L2 and manual driving.
      </p>
    </section>
  );
}
