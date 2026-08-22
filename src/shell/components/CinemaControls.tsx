import type { ScenarioId } from '../../core';
import type { DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

export type ExperienceId = 'auto-tour' | ScenarioId;

const SCENARIO_OPTIONS: Array<{ id: ExperienceId; label: string }> = [
  { id: 'auto-tour', label: '60s Three-Act Tour' },
  { id: 'commute', label: 'Daily Commute' },
  { id: 'fatigue', label: 'Fatigue Guard' },
  { id: 'complex', label: 'Complex Roads' },
];

const PRIMARY_LABEL: Record<DemoTransportState, string> = {
  ready: 'Start Experience',
  running: 'Pause',
  paused: 'Continue',
  completed: 'Replay Tour',
};

export default function CinemaControls({
  transport,
  experience,
  onPrimary,
  onRestart,
  onExperience,
}: {
  transport: DemoTransportState;
  experience: ExperienceId;
  onPrimary: () => void;
  onRestart: () => void;
  onExperience: (id: ExperienceId) => void;
}) {
  const primaryIcon = transport === 'running' ? 'pause' : transport === 'completed' ? 'replay' : 'play';

  return (
    <div className="cinema-controls" aria-label="Cinematic demo controls">
      <button type="button" className="cinema-primary" onClick={onPrimary}>
        <CinemaIcon name={primaryIcon} />
        <span>{PRIMARY_LABEL[transport]}</span>
      </button>
      <button type="button" className="cinema-icon-button" onClick={onRestart} aria-label="Replay from the beginning">
        <CinemaIcon name="replay" />
      </button>
      <label className="scenario-select">
        <span>EXPERIENCE</span>
        <select value={experience} onChange={(event) => onExperience(event.target.value as ExperienceId)}>
          {SCENARIO_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
