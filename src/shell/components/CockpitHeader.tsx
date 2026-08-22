import type { CockpitState } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

const TRANSPORT_LABEL: Record<DemoTransportState, string> = {
  ready: 'READY',
  running: 'STORY RUNNING',
  paused: 'SCENE FROZEN',
  completed: 'LOOP COMPLETE',
};

export default function CockpitHeader({
  snap,
  step,
  transport,
  onOpenEvidence,
}: {
  snap: CockpitState;
  step: DemoStep | null;
  transport: DemoTransportState;
  onOpenEvidence: () => void;
}) {
  return (
    <header className="cinema-header">
      <a className="cinema-brand" href="#/" aria-label="Return to the EVA home page">
        <span className="cinema-brand-eyes" aria-hidden="true"><i /><i /></span>
        <span><b>EVA</b><small>DIGITAL TWIN</small></span>
      </a>

      <div className="cinema-chapter" aria-live="polite">
        <small>{step ? `${String(step.i).padStart(2, '0')} / ${String(step.total).padStart(2, '0')}` : TRANSPORT_LABEL[transport]}</small>
        <strong>{step?.title ?? 'Vehicle digital twin ready'}</strong>
      </div>

      <div className="cinema-vehicle-state" aria-label="Vehicle status">
        <span className="cinema-speed"><b>{Math.round(snap.drive.speed)}</b><small>km/h</small></span>
        <span className={`cinema-l2${snap.drive.l2Degraded ? ' danger' : snap.drive.auto ? ' on' : ''}`}>
          L2 {snap.drive.l2Degraded ? 'DEGRADED' : snap.drive.auto ? 'ACTIVE' : 'STANDBY'}
        </span>
      </div>

      <button type="button" className="cinema-icon-button evidence-trigger" aria-label="Open technical evidence" onClick={onOpenEvidence}>
        <CinemaIcon name="evidence" />
        <span>EVIDENCE</span>
      </button>
    </header>
  );
}
