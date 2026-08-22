import type { CSSProperties } from 'react';
import type { EvaAvatarState, EvaExpression } from './evaExpression';
import './evaAvatar.css';

const SHELL_URL = `${import.meta.env.BASE_URL}eva/eva-shell.png`;

function EvaEyes({ expression }: { expression: EvaExpression }) {
  if (expression === 'caring' || expression === 'confirming') {
    const bend = expression === 'confirming' ? 9 : 6;
    return (
      <g className="eva-avatar-eye-pair eye-arcs">
        <path d={`M 29 49 Q 37 ${49 + bend} 45 49`} />
        <path d={`M 55 49 Q 63 ${49 + bend} 71 49`} />
      </g>
    );
  }

  return (
    <g className="eva-avatar-eye-pair eye-pills">
      <rect className="eva-avatar-eye left" x="31" y="35" width="13" height="29" rx="6.5" />
      <rect className="eva-avatar-eye right" x="56" y="35" width="13" height="29" rx="6.5" />
    </g>
  );
}

export default function EvaAvatar({
  expression = 'calm',
  state = 'ready',
  speaking = false,
  size = 72,
  label,
  className = '',
}: {
  expression?: EvaExpression;
  state?: EvaAvatarState;
  speaking?: boolean;
  size?: number;
  label?: string;
  className?: string;
}) {
  const style = { '--eva-avatar-size': `${size}px` } as CSSProperties;

  return (
    <span
      className={`eva-avatar ${className}`.trim()}
      data-expression={expression}
      data-state={state}
      data-speaking={speaking ? 'true' : 'false'}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <img className="eva-avatar-shell" src={SHELL_URL} alt="" draggable={false} />
      <svg className="eva-avatar-face" viewBox="0 0 100 100" focusable="false" aria-hidden="true">
        <EvaEyes expression={expression} />
      </svg>
      <span className="eva-avatar-state-ring" aria-hidden="true" />
      <span className="eva-avatar-scan" aria-hidden="true" />
    </span>
  );
}

