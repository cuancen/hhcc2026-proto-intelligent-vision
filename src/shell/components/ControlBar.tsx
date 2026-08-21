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
    <footer className="controlbar" aria-label="演示控制">
      <div className="grp" role="group" aria-label="演示场景">
        <span className="grp-label">场景</span>
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

      <div className="grp" role="group" aria-label="手动事件注入">
        <span className="grp-label">事件</span>
        <button type="button" className={`btn${snap.drive.rain ? ' active' : ''}`} aria-pressed={snap.drive.rain} onClick={() => act.setRain(!snap.drive.rain)}>☔ 雨</button>
        <button type="button" className={`btn${snap.drive.night ? ' active' : ''}`} aria-pressed={snap.drive.night} onClick={() => act.setNight(!snap.drive.night)}>🌙 夜</button>
        <button type="button" className="btn" onClick={() => act.injectLeadBrake()}>⚠ 前车急刹</button>
      </div>

      <div className="sep" aria-hidden="true" />

      <div className="grp">
        <div className="slider-row">
          <label htmlFor="fat-slider">疲劳注入</label>
          <input
            id="fat-slider"
            type="range" min={0} max={100} value={fat}
            aria-valuetext={`仿真疲劳 ${fat}%（综合 ${Math.round(snap.driver.fatigue)}%）`}
            onChange={(e) => { const v = +e.target.value; setFat(v); act.setSimFatigue(v); }}
          />
          <span aria-hidden="true">{fat}%</span>
        </div>
      </div>

      <div className="sep" aria-hidden="true" />

      <div className="grp" role="group" aria-label="自动演示与速率">
        <button
          type="button"
          className={`btn${autoDemoRunning ? ' active' : ''}`}
          aria-pressed={autoDemoRunning}
          onClick={onToggleAutoDemo}
          title="自动走完三大场景（约 60 秒），快捷键 D"
        >
          {autoDemoRunning ? '■ 停止演示' : '▶ 自动演示'}
        </button>
        {[0.5, 1, 2].map((v) => (
          <button key={v} type="button" className={`btn small${speed === v ? ' active' : ''}`} aria-pressed={speed === v} onClick={() => setSpeed(v)}>
            ×{v === 0.5 ? '½' : v}
          </button>
        ))}
        <button type="button" className="btn small" onClick={() => act.reset()} title="复位当前场景">⟲ 复位</button>
        <span className="grp-label" style={{ marginLeft: 4 }}>快捷键 1/2/3 场景 · D 演示 · L 辅助</span>
      </div>
    </footer>
  );
}
