import { useCallback, useEffect, useState } from 'react';

const FONT_SCALES = [0.9, 1, 1.15, 1.3] as const;
const KEY_SCALE = 'eva.fontScale';
const KEY_HC = 'eva.highContrast';

function loadNum(key: string, dflt: number): number {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? dflt : Number(v) || dflt;
  } catch {
    return dflt;
  }
}

function loadBool(key: string, dflt: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? dflt : v === '1';
  } catch {
    return dflt;
  }
}

/**
 * 用户界面偏好：字号缩放（rem 根字号）与高对比模式，localStorage 持久化。
 * 与 prefers-reduced-motion（CSS 媒体查询）共同构成无障碍三开关。
 */
export function useUiPrefs() {
  const [scale, setScale] = useState<number>(() => loadNum(KEY_SCALE, 1));
  const [highContrast, setHighContrast] = useState<boolean>(() => loadBool(KEY_HC, false));

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * scale}px`;
    try { window.localStorage.setItem(KEY_SCALE, String(scale)); } catch { /* 隐私模式等 */ }
  }, [scale]);

  useEffect(() => {
    document.body.classList.toggle('high-contrast', highContrast);
    try { window.localStorage.setItem(KEY_HC, highContrast ? '1' : '0'); } catch { /* 隐私模式等 */ }
  }, [highContrast]);

  const zoom = useCallback((dir: -1 | 0 | 1) => {
    setScale((s) => {
      const i = FONT_SCALES.indexOf(s as (typeof FONT_SCALES)[number]);
      const base = i === -1 ? 1 : i;
      const next = dir === 0 ? 1 : Math.min(FONT_SCALES.length - 1, Math.max(0, base + dir));
      return FONT_SCALES[next];
    });
  }, []);

  return { scale, zoom, highContrast, toggleHighContrast: () => setHighContrast((v) => !v) };
}
