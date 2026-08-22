export type CinemaIconName =
  | 'play'
  | 'pause'
  | 'replay'
  | 'evidence'
  | 'close'
  | 'camera'
  | 'upload'
  | 'simulation'
  | 'voice'
  | 'contrast'
  | 'check'
  | 'home';

/** 统一的车规线性图标；避免平台相关表情符号破坏视觉语言。 */
export default function CinemaIcon({ name, size = 20 }: { name: CinemaIconName; size?: number }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...common}>
      {name === 'play' && <path d="m9 6 9 6-9 6Z" />}
      {name === 'pause' && <><path d="M8 6v12" /><path d="M16 6v12" /></>}
      {name === 'replay' && <><path d="M6.2 8.1H2.8V4.7" /><path d="M3.2 8a9 9 0 1 1-.1 7.8" /></>}
      {name === 'evidence' && <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
      {name === 'close' && <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>}
      {name === 'camera' && <><path d="M4 8h3l1.3-2h7.4L17 8h3v10H4z" /><circle cx="12" cy="13" r="3.2" /></>}
      {name === 'upload' && <><path d="M12 16V5" /><path d="m8 9 4-4 4 4" /><path d="M5 14v5h14v-5" /></>}
      {name === 'simulation' && <><path d="M4 18V6l7 4v8z" /><path d="M11 18V9l9 4v5z" /></>}
      {name === 'voice' && <><path d="M5 10v4h3l4 3V7L8 10z" /><path d="M16 9.2a4 4 0 0 1 0 5.6M18.5 7a7 7 0 0 1 0 10" /></>}
      {name === 'contrast' && <><circle cx="12" cy="12" r="8" /><path d="M12 4v16M12 7a5 5 0 0 1 0 10" /></>}
      {name === 'check' && <path d="m5 12 4.2 4.2L19 6.5" />}
      {name === 'home' && <><path d="m4 11 8-7 8 7" /><path d="M6.5 9.5V20h11V9.5M10 20v-6h4v6" /></>}
    </svg>
  );
}
