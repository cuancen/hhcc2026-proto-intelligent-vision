import type { ScenarioId } from '../../core';
import type { DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

const SCENARIO_OPTIONS: Array<{ id: ScenarioId; label: string }> = [
  { id: 'visionLoop', label: '60 秒情境闭环' },
  { id: 'commute', label: '日常通勤' },
  { id: 'fatigue', label: '疲劳守护' },
  { id: 'complex', label: '复杂路况' },
];

const PRIMARY_LABEL: Record<DemoTransportState, string> = {
  ready: '开始体验',
  running: '暂停',
  paused: '继续',
  completed: '重播闭环',
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
    <div className="cinema-controls" aria-label="电影演示控制">
      <button type="button" className="cinema-primary" onClick={onPrimary}>
        <CinemaIcon name={primaryIcon} />
        <span>{PRIMARY_LABEL[transport]}</span>
      </button>
      <button type="button" className="cinema-icon-button" onClick={onRestart} aria-label="从头重播">
        <CinemaIcon name="replay" />
      </button>
      <label className="scenario-select">
        <span>场景</span>
        <select value={scenario} onChange={(event) => onScenario(event.target.value as ScenarioId)}>
          {SCENARIO_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
  );
}
