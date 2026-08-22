import type { CockpitState } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import type { DemoCue } from '../autoDemo';
import EvaAvatar from '../../shared/EvaAvatar';
import type { EvaExpression } from '../../shared/evaExpression';
import CinemaIcon from './CinemaIcon';
import type { ExperienceId } from './CinemaControls';

const TRANSPORT_LABEL: Record<DemoTransportState, string> = {
  ready: 'READY',
  running: 'DEMO RUNNING',
  paused: 'SCENE FROZEN',
  completed: 'DEMO COMPLETE',
};

const PHASE_BY_CUE: Record<DemoCue, number> = {
  'oms-cruise': 0,
  'oms-candidate': 0,
  'oms-prompt': 0,
  'oms-correlate': 1,
  'oms-decide': 2,
  'oms-urgent': 3,
  'oms-clear': 3,
  'oms-verify': 4,
  'moment-trace': 4,
  commute: 0,
  'fatigue-monitoring': 1,
  'fatigue-care': 1,
  'fatigue-urgent': 1,
  'fatigue-rest': 1,
  'complex-roads': 2,
  'conditions-ease': 2,
  'voice-command': 2,
  'cabin-memory': 2,
  completed: 4,
};

export function progressPhaseOf(experience: ExperienceId, step: DemoStep | null, cue: DemoCue | null): number {
  if (experience === 'full-demo' && step) {
    if (step.i <= 2) return 0;
    if (step.i <= 6) return 1;
    if (step.i <= 9) return 2;
    if (step.i <= 12) return 3;
    return 4;
  }
  return cue ? PHASE_BY_CUE[cue] : -1;
}

export default function CockpitHeader({
  snap,
  step,
  cue,
  expression,
  transport,
  experience,
  onOpenEvidence,
}: {
  snap: CockpitState;
  step: DemoStep | null;
  cue: DemoCue | null;
  expression: EvaExpression;
  transport: DemoTransportState;
  experience: ExperienceId;
  onOpenEvidence: () => void;
}) {
  const currentPhase = progressPhaseOf(experience, step, cue);
  return (
    <header className="cinema-header">
      <a className="cinema-brand" href="#/" aria-label="Return to the EVA home page">
        <EvaAvatar expression={expression} size={44} />
        <span><b>EVA</b><small>DIGITAL TWIN</small></span>
      </a>

      <div className="cinema-chapter" aria-live="polite">
        <small>{step ? `${String(step.i).padStart(2, '0')} / ${String(step.total).padStart(2, '0')}` : TRANSPORT_LABEL[transport]}</small>
        <strong>{step?.title ?? 'EVA experience ready'}</strong>
        <div className="cinema-act-progress" aria-label="Experience progress">
          {[0, 1, 2, 3, 4].map((phase) => {
            return <i key={phase} data-state={phase < currentPhase ? 'done' : phase === currentPhase ? 'active' : 'idle'} />;
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
