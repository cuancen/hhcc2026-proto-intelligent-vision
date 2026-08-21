import { useEffect, useState } from 'react';
import type { CockpitState } from '../../core';

export default function TopBar({ snap }: { snap: CockpitState }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(iv);
  }, []);

  const time = now.toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <header className="topbar">
      <div className="brand">
        <h1>Eva · 智能座舱</h1>
        <span className="slogan">从智能驾驶 到 人车共生</span>
      </div>
      <span className={`chip l2${snap.drive.auto ? '' : ''}`} title="L2 辅助驾驶：驾驶员始终监管">
        {snap.drive.auto ? '● L2 辅助驾驶中' : '○ 人工驾驶'}
      </span>
      <span className="chip" title="驾驶员监测系统：眨眼 / PERCLOS / 头部姿态">
        机器视觉 DMS
      </span>
      <span className="chip" title="吉利全域 AI OS 底座">全域 AI OS</span>
      <span className="clock" aria-label={`当前时间 ${time}`}>{time}</span>
    </header>
  );
}
