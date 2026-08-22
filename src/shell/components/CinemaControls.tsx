import type { ScenarioId } from '../../core';
import type { DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

const SCENARIO_OPTIONS: Array<{ id: ScenarioId; label: string }> = [
  { id: 'visionLoop', label: '60s Vision Context Loop' },
  { id: 'commute', label: 'Daily Commute' },
  { id: 'fatigue', label: 'Fatigue Guard' },
  { id: 'complex', label: 'Complex Roads' },
];

const PRIMARY_LABEL: Record<DemoTransportState, string> = {
  ready: 'Start Experience',
  running: 'Pause',
  paused: 'Continue',
  completed: 'Replay Loop',
};

export default function CinemaControls({
  transport,
  scenario,
  onPrimary,
  onRestart,
  onScenario,
}: {
  transport: DemoTransportState;
  scenario: ScenarioId;
  onPrimary: () => void;
  onRestart: () => void;
  onScenario: (id: ScenarioId) => void;
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
        <span>SCENE</span>
        <select value={scenario} onChange={(event) => onScenario(event.target.value as ScenarioId)}>
          {SCENARIO_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
