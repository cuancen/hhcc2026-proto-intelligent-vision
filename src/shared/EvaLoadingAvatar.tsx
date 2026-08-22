import './evaLoadingAvatar.css';
import EvaAvatar from './EvaAvatar';

export type EvaLoadingState = 'loading' | 'unavailable';

export default function EvaLoadingAvatar({
  state = 'loading',
  label,
  detail,
  compact = false,
  announce = true,
}: {
  state?: EvaLoadingState;
  label?: string;
  detail?: string;
  compact?: boolean;
  announce?: boolean;
}) {
  const unavailable = state === 'unavailable';
  const title = label ?? (unavailable ? '3D TWIN OFFLINE' : 'BUILDING DIGITAL TWIN');
  const description = detail ?? (unavailable
    ? 'Live cockpit systems remain available'
    : 'Loading vehicle geometry');

  return (
    <div
      className={`eva-loading-avatar${compact ? ' compact' : ''}`}
      data-state={state}
      role={announce ? 'status' : undefined}
      aria-live={announce ? 'polite' : undefined}
    >
      <span className="eva-loading-orbit" aria-hidden="true">
        <EvaAvatar
          expression={unavailable ? 'cautious' : 'thinking'}
          state={unavailable ? 'offline' : 'loading'}
          size={compact ? 58 : 102}
        />
      </span>
      <span className="eva-loading-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </div>
  );
}
