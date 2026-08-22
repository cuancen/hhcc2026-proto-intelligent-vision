import type { CockpitActions, CockpitState, EmotionId, VisionSample } from '../../core';
import type { DmsStatus } from '../../vision/dms';
import type { DmsMode } from '../hooks/useDms';

const EMOTION_LABEL: Record<EmotionId, string> = {
  neutral: 'Neutral',
  happy: 'Positive',
  sad: 'Low',
  angry: 'Tense',
  surprised: 'Surprised',
  drowsy: 'Drowsy',
};

function RailMetric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'danger' }) {
  return <div className="rail-metric" data-tone={tone}><span>{label}</span><b>{value}</b></div>;
}

export default function SystemsRail({
  snap,
  act,
  refresh,
  dms,
}: {
  snap: CockpitState;
  act: CockpitActions;
  refresh: () => void;
  dms: {
    mode: DmsMode;
    status: DmsStatus;
    sample: VisionSample | null;
    startModel: () => Promise<void>;
    startSim: () => void;
    stopAll: () => void;
  };
}) {
  const sample = dms.sample ?? snap.driver.vision;
  const perclos = sample ? Math.round(sample.perclos * 100) : null;
  const lookAway = sample?.lookAwaySec ?? null;
  const emotion = sample?.emotion ?? 'neutral';
  const source = dms.mode === 'model' ? 'CAMERA · LOCAL' : dms.mode === 'sim' ? 'SIMULATED SIGNAL' : 'READY';

  const toggleL2 = () => {
    act.setAuto(!snap.drive.auto);
    refresh();
  };

  return (
    <>
      <aside className="systems-rail systems-rail-left" aria-label="Driver and EVA live status">
        <div className="rail-heading"><span>DRIVER / AGENT</span><i data-live={sample?.present ? 'true' : 'false'} /></div>
        <div className="rail-agent">
          <span className="rail-eyes" aria-hidden="true"><i /><i /></span>
          <div><small>EVA STATE</small><b>{snap.evaMode}</b></div>
        </div>
        <div className="rail-grid">
          <RailMetric label="ATTENTION" value={`${Math.round(snap.driver.attention)}%`} tone={snap.driver.attention < 55 ? 'danger' : snap.driver.attention < 75 ? 'warn' : 'normal'} />
          <RailMetric label="FATIGUE" value={`${Math.round(snap.driver.fatigue)}%`} tone={snap.driver.fatigue >= 85 ? 'danger' : snap.driver.fatigue >= 60 ? 'warn' : 'normal'} />
          <RailMetric label="FACE STATE" value={EMOTION_LABEL[emotion]} tone={['angry', 'drowsy'].includes(emotion) ? 'warn' : 'normal'} />
        </div>
        <p className="rail-footnote">On-device inference. No camera frame is uploaded.</p>
      </aside>

      <aside className="systems-rail systems-rail-right" aria-label="Perception, L2 and cabin controls">
        <div className="rail-heading"><span>LIVE SYSTEMS</span><i data-live={dms.mode !== 'off'} /></div>
        <section className="rail-section">
          <div className="rail-section-title"><span>PERCEPTION</span><b>{source}</b></div>
          <div className="rail-grid two">
            <RailMetric label="PERCLOS" value={perclos === null ? '—' : `${perclos}%`} tone={perclos !== null && perclos >= 35 ? 'danger' : perclos !== null && perclos >= 25 ? 'warn' : 'normal'} />
            <RailMetric label="EYES OFF" value={lookAway === null ? '—' : `${lookAway.toFixed(1)}s`} tone={lookAway !== null && lookAway >= 4 ? 'danger' : lookAway !== null && lookAway >= 2 ? 'warn' : 'normal'} />
          </div>
          <div className="rail-actions" aria-label="DMS input source">
            <button type="button" aria-pressed={dms.mode === 'model'} onClick={() => void dms.startModel()}>CAM</button>
            <button type="button" aria-pressed={dms.mode === 'sim'} onClick={dms.startSim}>SIM</button>
            <button type="button" aria-pressed={dms.mode === 'off'} onClick={dms.stopAll}>OFF</button>
          </div>
          {dms.status.kind === 'error' && <small className="rail-error">Camera unavailable. Simulation remains available.</small>}
        </section>
        <section className="rail-section">
          <div className="rail-section-title"><span>L2 ASSISTANCE</span><b data-tone={snap.drive.l2Degraded ? 'danger' : snap.drive.auto ? 'verify' : 'normal'}>{snap.drive.l2Degraded ? 'DEGRADED' : snap.drive.auto ? 'ACTIVE' : 'STANDBY'}</b></div>
          <button type="button" className="rail-l2" aria-pressed={snap.drive.auto} onClick={toggleL2}>{snap.drive.auto ? 'Disable L2' : 'Enable L2'}</button>
        </section>
        <section className="rail-section rail-cabin">
          <div className="rail-section-title"><span>CABIN</span><b>LIVE</b></div>
          <dl>
            <div><dt>Temperature</dt><dd>{snap.cabin.temp.toFixed(1)}°C</dd></div>
            <div><dt>Audio</dt><dd>{snap.cabin.music}</dd></div>
            <div><dt>Reading light</dt><dd>{snap.cabin.readingLight}</dd></div>
          </dl>
        </section>
      </aside>
    </>
  );
}
