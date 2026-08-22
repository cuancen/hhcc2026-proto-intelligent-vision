import { useEffect, useState } from 'react';
import type { CockpitState } from '../../core';

interface TopBarProps {
  snap: CockpitState;
  fontScale: number;
  onZoom: (dir: -1 | 0 | 1) => void;
  highContrast: boolean;
  onToggleContrast: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
}

export default function TopBar({ snap, fontScale, onZoom, highContrast, onToggleContrast, voiceOn, onToggleVoice }: TopBarProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const time = now.toLocaleTimeString('en-GB', { hour12: false });

  return (
    <header className="topbar">
      <div className="brand">
        <h1><a href="#/" title="Back to the brand homepage" style={{ color: 'inherit', textDecoration: 'none' }}>Eva · Smart Cockpit</a></h1>
        <span className="slogan">From Assisted Driving to Human-Car Symbiosis</span>
      </div>
      <span className="chip l2" title="L2 assisted driving: the driver always supervises">
        {snap.drive.auto ? '● L2 Assisted Driving' : '○ Manual Driving'}
      </span>
      <span className="chip" title="Driver monitoring: blinks / PERCLOS / head pose">Vision DMS</span>
      <span className="chip" title="Geely full-domain AI OS foundation">Full-Domain AI OS</span>

      <div className="a11y-group" role="group" aria-label="Accessibility settings">
        <button type="button" className="btn small" onClick={() => onZoom(-1)} aria-label="Decrease font size">A−</button>
        <button type="button" className="btn small" onClick={() => onZoom(0)} aria-label="Reset font size" title={`Current ${Math.round(fontScale * 100)}%`}>A</button>
        <button type="button" className="btn small" onClick={() => onZoom(1)} aria-label="Increase font size">A+</button>
        <button type="button" className={`btn small${highContrast ? ' active' : ''}`} aria-pressed={highContrast} onClick={onToggleContrast}>Contrast</button>
        <button
          type="button"
          className={`btn small${voiceOn ? ' active' : ''}`}
          aria-pressed={voiceOn}
          onClick={onToggleVoice}
          title="Eva voice announcements (local synthesis, mute anytime)"
        >
          {voiceOn ? '🔊 Voice' : '🔇 Muted'}
        </button>
      </div>

      <span className="clock" aria-label={`Current time ${time}`}>{time}</span>
    </header>
  );
}
