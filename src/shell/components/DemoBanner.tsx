import type { DemoStep } from '../autoDemo';

interface DemoBannerProps {
  step: DemoStep | null;
  running: boolean;
  onStop: () => void;
}

/** 路演讲解横幅：自动演示时逐步告诉评委"正在看什么、这一段想表达什么" */
export default function DemoBanner({ step, running, onStop }: DemoBannerProps) {
  if (!running || !step) return null;
  return (
    <div className="demo-banner" role="status" aria-live="polite">
      <span className="demo-step">{step.i}/{step.total}</span>
      <div className="demo-text">
        <strong>{step.title}</strong>
        <span>{step.note}</span>
      </div>
      <button type="button" className="btn small" onClick={onStop}>
        ■ Stop
      </button>
      <div className="demo-dots" aria-hidden="true">
        {Array.from({ length: step.total }, (_, k) => (
          <i key={k} className={k < step.i ? 'done' : ''} />
        ))}
      </div>
    </div>
  );
}
