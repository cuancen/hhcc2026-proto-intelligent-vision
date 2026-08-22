import { useEffect, useState } from 'react';

/** 开机自检清单：展示顺序即点亮顺序 */
export const BOOT_SEQUENCE: readonly string[] = [
  'Cockpit simulation kernel',
  'Eva rule engine',
  'L2 assistance policy chain',
  'MediaPipe Vision model · on-device inference',
  'Human-car symbiosis protocol',
];

interface BootSplashProps {
  onDone: () => void;
}

/** 座舱开机自检动画：Eva 亮灯 + 子系统逐项点亮 + 进度条，点击或「跳过」可跳过 */
export default function BootSplash({ onDone }: BootSplashProps) {
  const [lit, setLit] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (lit < BOOT_SEQUENCE.length) {
      const t = window.setTimeout(() => setLit((v) => v + 1), 320);
      return () => window.clearTimeout(t);
    }
    const t1 = window.setTimeout(() => setLeaving(true), 500);
    const t2 = window.setTimeout(onDone, 950);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [lit, onDone]);

  const skip = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onDone, 250);
  };

  return (
    <div
      className={`boot-splash${leaving ? ' leaving' : ''}`}
      role="status"
      aria-label="Cockpit boot self-check"
      onClick={skip}
    >
      <div className="boot-face" aria-hidden="true">
        <div className="eyes">
          <span className="eye" />
          <span className="eye" />
        </div>
      </div>
      <h2>EVA · Smart Cockpit</h2>
      <p className="boot-slogan">From Assisted Driving to Human-Car Symbiosis</p>
      <ul className="boot-checks">
        {BOOT_SEQUENCE.map((item, k) => (
          <li key={item} className={k < lit ? 'on' : ''}>
            <span className="tick" aria-hidden="true">{k < lit ? '✓' : '·'}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="boot-bar" aria-hidden="true">
        <i style={{ width: `${(lit / BOOT_SEQUENCE.length) * 100}%` }} />
      </div>
      <button type="button" className="boot-skip" onClick={skip}>
        Skip
      </button>
    </div>
  );
}
