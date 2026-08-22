import type { DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

export type ExperienceId = 'full-demo' | 'oms-trace' | 'commute' | 'fatigue' | 'complex' | 'cabin-memory';

const SCENARIO_OPTIONS: Array<{ id: ExperienceId; label: string }> = [
  { id: 'full-demo', label: 'Full Demo · 5 Experiences' },
  { id: 'oms-trace', label: 'OMS Risk · MomentTrace' },
  { id: 'commute', label: 'Daily Commute' },
  { id: 'fatigue', label: 'Fatigue Guard' },
  { id: 'complex', label: 'Complex Roads' },
  { id: 'cabin-memory', label: 'Cabin Memory Trace' },
];

const PRIMARY_LABEL: Record<DemoTransportState, string> = {
  ready: 'Start Experience',
  running: 'Pause',
  paused: 'Continue',
  completed: 'Replay MomentTrace',
};

export default function CinemaControls({
  transport,
  experience,
  preparing,
  canConfirm,
  onPrimary,
  onRestart,
  onExperience,
}: {
  transport: DemoTransportState;
  experience: ExperienceId;
  preparing?: boolean;
  canConfirm?: boolean;
  onPrimary: () => void;
  onRestart: () => void;
  onExperience: (id: ExperienceId) => void;
}) {
  const primaryIcon = canConfirm ? 'check' : transport === 'running' ? 'pause' : transport === 'completed' ? 'replay' : 'play';
  const primaryLabel = preparing
    ? 'Preparing experience'
    : canConfirm
      ? 'Confirm safe'
      : transport === 'completed' && experience === 'full-demo'
        ? 'Replay Full Demo'
        : PRIMARY_LABEL[transport];

  return (
    <div className="cinema-controls" aria-label="EVA experience controls">
      <button type="button" className="cinema-primary" onClick={onPrimary} disabled={preparing}>
        <CinemaIcon name={primaryIcon} />
        <span>{primaryLabel}</span>
      </button>
      <button type="button" className="cinema-icon-button" onClick={onRestart} disabled={preparing} aria-label="Replay from the beginning">
        <CinemaIcon name="replay" />
      </button>
      <label className="scenario-select">
        <span>EXPERIENCE</span>
        <select value={experience} disabled={preparing} onChange={(event) => onExperience(event.target.value as ExperienceId)}>
          {SCENARIO_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
