import type { CockpitState } from '../core';

/** 座舱氛围三档：驱动 --ambient 状态色、面板指示灯与告警光效（舱驾协同的可视层） */
export type AmbientLevel = 'ok' | 'warn' | 'danger';

export const WARN_FRESH_MIN = 1.2;
export const URGENT_FRESH_MIN = 0.8;

function lastAlertOf(s: CockpitState, level: 'warn' | 'urgent') {
  for (let i = s.alerts.length - 1; i >= 0; i--) {
    if (s.alerts[i].level === level) return s.alerts[i];
  }
  return null;
}

/**
 * 新鲜紧急告警 / 紧急干预待选择（pending）→ danger（红色脉冲，贯穿整个决策时刻）；
 * 新鲜预警 / L2 降级 → warn（琥珀）；其余 → ok（青碧）。
 * 时间窗基于仿真分钟，与速率倍率无关。
 */
export function ambientLevelOf(s: CockpitState): AmbientLevel {
  const urgent = lastAlertOf(s, 'urgent');
  if ((urgent && s.t - urgent.t <= URGENT_FRESH_MIN) || s.pending) return 'danger';
  const warn = lastAlertOf(s, 'warn');
  if ((warn && s.t - warn.t <= WARN_FRESH_MIN) || s.drive.l2Degraded) return 'warn';
  return 'ok';
}
