import { useEffect, useRef, useState } from 'react';
import type { CockpitState } from '../../core';

const LV_TEXT: Record<string, string> = { info: '提示', warn: '预警', urgent: '紧急' };

/**
 * 分级告警中心。列表以 role=log 呈现；
 * 紧急告警额外写入 aria-live=assertive 的隐藏区，确保读屏即时播报。
 */
export default function AlertCenter({ snap }: { snap: CockpitState }) {
  const items = [...snap.alerts].reverse().slice(0, 12);
  const lastUrgentId = useRef(0);
  const [urgentText, setUrgentText] = useState('');

  useEffect(() => {
    const urgents = snap.alerts.filter((a) => a.level === 'urgent');
    const latest = urgents[urgents.length - 1];
    if (latest && latest.id > lastUrgentId.current) {
      lastUrgentId.current = latest.id;
      setUrgentText(latest.text);
    }
  }, [snap.alerts]);

  return (
    <section className="panel" aria-labelledby="alert-title">
      <h2 className="panel-title" id="alert-title"><span className="dot" aria-hidden="true" />告警中心</h2>
      <div className="visually-hidden" role="status" aria-live="assertive">{urgentText}</div>
      <div className="alerts" role="log" aria-label="分级告警列表">
        {items.map((a) => (
          <div key={a.id} className={`alert-item ${a.level}`}>
            <span className="lv">{LV_TEXT[a.level]}</span>
            <span>{a.text}</span>
            <span className="at">{a.t.toFixed(1)}′</span>
          </div>
        ))}
        {items.length === 0 && <div className="alert-item info"><span className="lv">提示</span><span>暂无告警，一路顺风。</span></div>}
      </div>
    </section>
  );
}
