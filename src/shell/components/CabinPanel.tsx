import { useEffect, useRef, useState } from 'react';
import type { CockpitState } from '../../core';

const AMBIENT_HEX: Record<string, string> = {
  Teal: '#2dd4bf',
  'Warm Amber': '#fb923c',
};

/** 数值变化后的高亮停留时长 */
const FLASH_MS = 2000;

type CabinKey = 'temp' | 'fan' | 'music' | 'seatMassage' | 'ambient' | 'entertainmentBlocked';

function cabinSig(c: CockpitState['cabin']): Record<CabinKey, string | number | boolean> {
  return {
    temp: c.temp,
    fan: c.fan,
    music: c.music,
    seatMassage: c.seatMassage,
    ambient: c.ambient,
    entertainmentBlocked: c.entertainmentBlocked,
  };
}

/** 座舱环境：Eva 的调节触发 2 秒闪烁高亮（看得见的「无感调节」）；复杂路况下娱乐被屏蔽 */
export default function CabinPanel({ snap }: { snap: CockpitState }) {
  const c = snap.cabin;
  const [changed, setChanged] = useState<Partial<Record<CabinKey, boolean>>>({});
  const prev = useRef(cabinSig(c));

  useEffect(() => {
    const cur = cabinSig(c);
    const keys = (Object.keys(cur) as CabinKey[]).filter((k) => cur[k] !== prev.current[k]);
    prev.current = cur;
    if (!keys.length) return;
    setChanged((m) => {
      const next = { ...m };
      keys.forEach((k) => { next[k] = true; });
      return next;
    });
    // 到点整批清空（而非只清本次 keys）：避免 2 秒内连续变化时旧标志滞留、动画无法重放
    const t = window.setTimeout(() => setChanged({}), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [c.temp, c.fan, c.music, c.seatMassage, c.ambient, c.entertainmentBlocked]);

  const cls = (k: CabinKey, extra = '') => `cabin-item${changed[k] ? ' changed' : ''}${extra}`;

  return (
    <section className="panel" aria-labelledby="cabin-title">
      <h2 className="panel-title" id="cabin-title"><span className="dot" aria-hidden="true" />Cabin Environment</h2>
      <div className="cabin-grid">
        <div className={cls('temp')}>
          <span className="k">Temp</span><b>{c.temp.toFixed(1)}℃</b>
        </div>
        <div className={cls('fan')}>
          <span className="k">Fan</span><b>{['Off', 'Level 1', 'Level 2', 'Level 3'][c.fan]}</b>
        </div>
        <div className={cls('music', c.entertainmentBlocked ? ' blocked' : '')}>
          <span className="k">Music</span>
          <b>{c.entertainmentBlocked ? 'Blocked' : c.music}</b>
        </div>
        <div className={cls('seatMassage')}>
          <span className="k">Seat massage</span><b>{c.seatMassage ? 'On' : 'Off'}</b>
        </div>
        <div className={cls('ambient', ' highlight')} style={{ borderColor: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>
          <span className="k">Ambient light</span>
          <b style={{ color: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>{c.ambient}</b>
        </div>
        <div className="cabin-item">
          <span className="k">Total adjustments</span><b>{snap.stats.cabinAdj}</b>
        </div>
      </div>
    </section>
  );
}
