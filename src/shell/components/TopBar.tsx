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

  const time = now.toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <header className="topbar">
      <div className="brand">
        <h1><a href="#/" title="返回品牌首页" style={{ color: 'inherit', textDecoration: 'none' }}>Eva · 智能座舱</a></h1>
        <span className="slogan">看见原因 · 闭环解决</span>
      </div>
      <span className="chip l2" title="L2 辅助驾驶：驾驶员始终监管">
        {snap.drive.auto ? '● L2 辅助驾驶中' : '○ 人工驾驶'}
      </span>
      <span className="chip" title="驾驶员监测系统：眨眼 / PERCLOS / 头部姿态">机器视觉 DMS</span>
      <span className="chip" title="物品位置以语义事件记录；比赛原型为模拟输入">情境记忆 · 语义</span>
      <span className="chip" title="吉利全域 AI OS 底座">全域 AI OS</span>

      <div className="a11y-group" role="group" aria-label="无障碍设置">
        <button type="button" className="btn small" onClick={() => onZoom(-1)} aria-label="减小字号">A−</button>
        <button type="button" className="btn small" onClick={() => onZoom(0)} aria-label="恢复默认字号" title={`当前 ${Math.round(fontScale * 100)}%`}>A</button>
        <button type="button" className="btn small" onClick={() => onZoom(1)} aria-label="增大字号">A+</button>
        <button type="button" className={`btn small${highContrast ? ' active' : ''}`} aria-pressed={highContrast} onClick={onToggleContrast}>高对比</button>
        <button
          type="button"
          className={`btn small${voiceOn ? ' active' : ''}`}
          aria-pressed={voiceOn}
          onClick={onToggleVoice}
          title="Eva 语音播报（本地合成，可随时静音）"
        >
          {voiceOn ? '🔊 语音' : '🔇 静音'}
        </button>
      </div>

      <span className="clock" aria-label={`当前时间 ${time}`}>{time}</span>
    </header>
  );
}
