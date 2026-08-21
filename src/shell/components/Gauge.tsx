interface GaugeProps {
  label: string;
  value: number;
  unit?: string;
  warnAt?: number;
  dangerAt?: number;
  /** 数值越低越危险（如注意力/情绪） */
  invert?: boolean;
}

function levelOf(value: number, warnAt?: number, dangerAt?: number, invert?: boolean) {
  const v = invert ? 100 - value : value;
  if (dangerAt !== undefined && v >= dangerAt) return 'danger' as const;
  if (warnAt !== undefined && v >= warnAt) return 'warn' as const;
  return 'ok' as const;
}

const COLOR: Record<'ok' | 'warn' | 'danger', string> = {
  ok: 'var(--accent)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

/** 环形仪表（SVG），颜色随阈值分级；含 aria 描述 */
export default function Gauge({ label, value, unit = '', warnAt, dangerAt, invert }: GaugeProps) {
  const lv = levelOf(value, warnAt, dangerAt, invert);
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.min(100, Math.max(0, value)) / 100;

  return (
    <div className={`gauge${lv === 'warn' ? ' warn' : ''}${lv === 'danger' ? ' danger' : ''}`}>
      <svg width="68" height="68" viewBox="0 0 68 68" role="img" aria-label={`${label}：${Math.round(value)}${unit}${lv !== 'ok' ? (lv === 'warn' ? '，偏高' : '，告警') : ''}`}>
        <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(148,178,215,0.18)" strokeWidth="6" />
        <circle
          cx="34" cy="34" r={r} fill="none"
          stroke={COLOR[lv]}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform="rotate(-90 34 34)"
          style={{ transition: 'stroke-dasharray 0.35s ease, stroke 0.35s ease' }}
        />
        <text x="34" y="38" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="var(--mono)">
          {Math.round(value)}
        </text>
      </svg>
      <span className="glabel">{label}</span>
    </div>
  );
}
