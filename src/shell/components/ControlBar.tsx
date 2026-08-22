import { useState } from 'react';
import { SCENARIOS } from '../../core';
import type { CockpitActions, CockpitState, ScenarioId } from '../../core';

interface ControlBarProps {
  snap: CockpitState;
  act: CockpitActions;
  speed: number;
  setSpeed: (v: number) => void;
  autoDemoRunning: boolean;
  onToggleAutoDemo: () => void;
}

/** 底部控制栏：场景 / 手动事件 / 疲劳注入 / L2 / 自动演示 / 速率 */
export default function ControlBar({ snap, act, speed, setSpeed, autoDemoRunning, onToggleAutoDemo }: ControlBarProps) {
  const [fat, setFat] = useState(20);

  return (
    <footer className="controlbar" aria-label="Demo controls">
      <div className="grp" role="group" aria-label="Demo scenes">
        <span className="grp-label">Scene</span>
        {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`btn${snap.scenario === id ? ' active' : ''}`}
            aria-pressed={snap.scenario === id}
            title={SCENARIOS[id].desc}
            onClick={() => act.scenario(id)}
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>

      <div className="sep" aria-hidden="true" />

      <div className="grp" role="group" aria-label="Inject events manually">
        <span className="grp-label">Events</span>
        <button type="button" className={`btn${snap.drive.rain ? ' active' : ''}`} aria-pressed={snap.drive.rain} onClick={() => act.setRain(!snap.drive.rain)}>☔ Rain</button>
        <button type="button" className={`btn${snap.drive.night ? ' active' : ''}`} aria-pressed={snap.drive.night} onClick={() => act.setNight(!snap.drive.night)}>🌙 Night</button>
        <button type="button" className="btn" onClick={() => act.injectLeadBrake()}>⚠ Lead brake</button>
      </div>

      <div className="sep" aria-hidden="true" />

      <div className="grp">
        <div className="slider-row">
          <label htmlFor="fat-slider">Fatigue inject</label>
          <input
            id="fat-slider"
            type="range" min={0} max={100} value={fat}
            aria-valuetext={`simulated fatigue ${fat}% (fused ${Math.round(snap.driver.fatigue)}%)`}
            onChange={(e) => { const v = +e.target.value; setFat(v); act.setSimFatigue(v); }}
          />
          <span aria-hidden="true">{fat}%</span>
        </div>
      </div>

      <div className="sep" aria-hidden="true" />

      <div className="grp" role="group" aria-label="Auto demo and speed">
        <button
          type="button"
          className={`btn${autoDemoRunning ? ' active' : ''}`}
          aria-pressed={autoDemoRunning}
          onClick={onToggleAutoDemo}
          title="Run all three scenes automatically (~60 s); hotkey D"
        >
          {autoDemoRunning ? '■ Stop demo' : '▶ Auto demo'}
        </button>
        {[0.5, 1, 2].map((v) => (
          <button key={v} type="button" className={`btn small${speed === v ? ' active' : ''}`} aria-pressed={speed === v} onClick={() => setSpeed(v)}>
            ×{v === 0.5 ? '½' : v}
          </button>
        ))}
        <button type="button" className="btn small" onClick={() => act.reset()} title="Reset current scene">⟲ Reset</button>
        <span className="grp-label" style={{ marginLeft: 4 }}>Hotkeys 1/2/3 scenes · D demo · L assist</span>
      </div>
    </footer>
  );
}
