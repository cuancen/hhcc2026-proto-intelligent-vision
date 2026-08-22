import { useEffect, useRef, useState } from 'react';
import type { CockpitState } from '../../core';

const AMBIENT_HEX: Record<string, string> = {
  青碧: '#2dd4bf',
  暖橙: '#fb923c',
};

/** 数值变化后的高亮停留时长 */
const FLASH_MS = 2000;

type CabinKey = 'temp' | 'fan' | 'music' | 'seatMassage' | 'ambient' | 'entertainmentBlocked' | 'readingLight';

function cabinSig(c: CockpitState['cabin']): Record<CabinKey, string | number | boolean> {
  return {
    temp: c.temp,
    fan: c.fan,
    music: c.music,
    seatMassage: c.seatMassage,
    ambient: c.ambient,
    entertainmentBlocked: c.entertainmentBlocked,
    readingLight: c.readingLight,
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
  }, [c.temp, c.fan, c.music, c.seatMassage, c.ambient, c.entertainmentBlocked, c.readingLight]);

  const cls = (k: CabinKey, extra = '') => `cabin-item${changed[k] ? ' changed' : ''}${extra}`;

  return (
    <section className="panel" aria-labelledby="cabin-title">
      <h2 className="panel-title" id="cabin-title"><span className="dot" aria-hidden="true" />座舱环境</h2>
      <div className="cabin-grid">
        <div className={cls('temp')}>
          <span className="k">温度</span><b>{c.temp.toFixed(1)}℃</b>
        </div>
        <div className={cls('fan')}>
          <span className="k">风量</span><b>{['关', '1 档', '2 档', '3 档'][c.fan]}</b>
        </div>
        <div className={cls('music', c.entertainmentBlocked ? ' blocked' : '')}>
          <span className="k">音乐</span>
          <b>{c.entertainmentBlocked ? '已屏蔽' : c.music}</b>
        </div>
        <div className={cls('seatMassage')}>
          <span className="k">座椅按摩</span><b>{c.seatMassage ? '开' : '关'}</b>
        </div>
        <div className={cls('ambient', ' highlight')} style={{ borderColor: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>
          <span className="k">氛围灯</span>
          <b style={{ color: AMBIENT_HEX[c.ambient] ?? 'var(--accent)' }}>{c.ambient}</b>
        </div>
        <div className={cls('readingLight', c.readingLight !== '关闭' ? ' highlight' : '')}>
          <span className="k">阅读灯</span><b>{c.readingLight}</b>
        </div>
      </div>
    </section>
  );
}
