import type { CockpitState } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import type { DemoCue } from '../autoDemo';
import EvaAvatar from '../../shared/EvaAvatar';
import type { EvaExpression } from '../../shared/evaExpression';
import CinemaIcon from './CinemaIcon';

const TRANSPORT_LABEL: Record<DemoTransportState, string> = {
  ready: 'READY',
  running: 'TOUR RUNNING',
  paused: 'SCENE FROZEN',
  completed: 'TOUR COMPLETE',
};

const ACT_BY_CUE: Record<DemoCue, number> = {
  commute: 0,
  'fatigue-monitoring': 1,
  'fatigue-care': 1,
  'fatigue-urgent': 1,
  'fatigue-rest': 1,
  'complex-roads': 2,
  'conditions-ease': 2,
  'voice-command': 2,
  completed: 2,
};

export default function CockpitHeader({
  snap,
  step,
  cue,
  expression,
  transport,
  onOpenEvidence,
}: {
  snap: CockpitState;
  step: DemoStep | null;
  cue: DemoCue | null;
  expression: EvaExpression;
  transport: DemoTransportState;
  onOpenEvidence: () => void;
}) {
  return (
    <header className="cinema-header">
      <a className="cinema-brand" href="#/" aria-label="Return to the EVA home page">
        <EvaAvatar expression={expression} size={44} />
        <span><b>EVA</b><small>DIGITAL TWIN</small></span>
      </a>

      <div className="cinema-chapter" aria-live="polite">
        <small>{step ? `${String(step.i).padStart(2, '0')} / ${String(step.total).padStart(2, '0')}` : TRANSPORT_LABEL[transport]}</small>
        <strong>{step?.title ?? 'Vehicle digital twin ready'}</strong>
        <div className="cinema-act-progress" aria-label="Three-act progress">
          {[0, 1, 2].map((act) => {
            const current = cue ? ACT_BY_CUE[cue] : -1;
            return <i key={act} data-state={act < current ? 'done' : act === current ? 'active' : 'idle'} />;
          })}
        </div>
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
