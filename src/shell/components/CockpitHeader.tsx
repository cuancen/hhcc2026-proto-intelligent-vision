import type { CockpitState } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import CinemaIcon from './CinemaIcon';

const TRANSPORT_LABEL: Record<DemoTransportState, string> = {
  ready: '准备体验',
  running: '剧情运行中',
  paused: '画面已冻结',
  completed: '闭环已完成',
};

export default function CockpitHeader({
  snap,
  step,
  transport,
  onOpenEvidence,
}: {
  snap: CockpitState;
  step: DemoStep | null;
  transport: DemoTransportState;
  onOpenEvidence: () => void;
}) {
  return (
    <header className="cinema-header">
      <a className="cinema-brand" href="#/" aria-label="返回 EVA 首页">
        <span className="cinema-brand-eyes" aria-hidden="true"><i /><i /></span>
        <span><b>EVA</b><small>DIGITAL TWIN</small></span>
      </a>

      <div className="cinema-chapter" aria-live="polite">
        <small>{step ? `${String(step.i).padStart(2, '0')} / ${String(step.total).padStart(2, '0')}` : TRANSPORT_LABEL[transport]}</small>
        <strong>{step?.title ?? '整车数字孪生已就绪'}</strong>
      </div>

      <div className="cinema-vehicle-state" aria-label="车辆状态">
        <span className="cinema-speed"><b>{Math.round(snap.drive.speed)}</b><small>km/h</small></span>
        <span className={`cinema-l2${snap.drive.l2Degraded ? ' danger' : snap.drive.auto ? ' on' : ''}`}>
          L2 {snap.drive.l2Degraded ? '降级' : snap.drive.auto ? '辅助中' : '待机'}
        </span>
      </div>

      <button type="button" className="cinema-icon-button evidence-trigger" aria-label="技术证据" onClick={onOpenEvidence}>
        <CinemaIcon name="evidence" />
        <span>技术证据</span>
      </button>
    </header>
  );
}
