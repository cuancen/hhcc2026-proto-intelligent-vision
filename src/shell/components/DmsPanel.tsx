import type { RefObject } from 'react';
import type { DmsStatus } from '../../vision/dms';
import type { EmotionId, VisionSample } from '../../core';
import type { DmsMode } from '../hooks/useDms';

interface DmsPanelProps {
  mode: DmsMode;
  status: DmsStatus;
  sample: VisionSample | null;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  onStartModel: () => void;
  onStartSim: () => void;
  onStop: () => void;
}

const SOURCE_LABEL: Record<DmsMode, string> = {
  off: 'Off',
  model: '● Camera model inference',
  video: '● Local video inference',
  sim: '◆ Simulated signal (same pipeline)',
  replay: '◆ Replay fallback (same pipeline)',
};

/** 情绪展示：emoji + 英文标签（检测 6 态，与 Eva 主动关怀联动） */
const EMO_UI: Record<EmotionId, { emoji: string; label: string }> = {
  neutral: { emoji: '😐', label: 'Neutral' },
  happy: { emoji: '😊', label: 'Happy' },
  sad: { emoji: '😢', label: 'Sad' },
  angry: { emoji: '😠', label: 'Angry' },
  surprised: { emoji: '😮', label: 'Surprised' },
  drowsy: { emoji: '😪', label: 'Drowsy' },
};

/** 机器视觉 · 驾驶员监测面板：摄像头画面 + 关键点叠加 + DMS 指标 */
export default function DmsPanel({
  mode, status, sample, videoRef, canvasRef, onStartModel, onStartSim, onStop,
}: DmsPanelProps) {
  const perclosPct = sample ? sample.perclos * 100 : 0;
  const metricCls = (warn: boolean, danger: boolean) => (danger ? 'metric danger' : warn ? 'metric warn' : 'metric');

  return (
    <section className="panel" aria-labelledby="dms-title">
      <h2 className="panel-title" id="dms-title">
        <span className="dot" aria-hidden="true" />Machine Vision · Driver Monitoring
        <span
          className={`chip${mode === 'model' ? ' on' : mode === 'sim' ? ' warn' : ''}`}
          style={{ marginLeft: 'auto', textTransform: 'none' }}
          role="status"
        >
          {SOURCE_LABEL[mode]}
        </span>
      </h2>

      <div className="dms-video">
        <video ref={videoRef} playsInline muted style={{ display: ['model', 'video'].includes(mode) ? 'block' : 'none' }} aria-label={mode === 'video' ? 'Selected local driver video' : 'Driver camera view'} />
        <canvas ref={canvasRef} style={{ display: ['model', 'video'].includes(mode) ? 'block' : 'none' }} aria-hidden="true" />

        {!['model', 'video'].includes(mode) && (
          <div className="dms-empty">
            {mode === 'off' && status.kind !== 'loading' && (
              <>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--text-soft)' }}>
                    Turn on the camera and drive fatigue/distraction monitoring with a real facial-landmark model
                  </p>
                  <p style={{ margin: '0 0 12px' }}>Blinks · PERCLOS · head pose — all inferred locally in your browser, nothing uploaded</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" className="btn" onClick={onStartModel}>📷 Start camera monitoring</button>
                  <button type="button" className="btn" onClick={onStartSim}>▶ Use simulated signal</button>
                </div>
                {status.kind === 'error' && (
                  <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', maxWidth: 380 }}>
                    Camera/model unavailable: {status.detail}. You can switch to the simulated signal — the pipeline is identical to the real model.
                  </p>
                )}
              </>
            )}
            {status.kind === 'loading' && (
              <p>⏳ {status.detail}</p>
            )}
            {mode === 'sim' && (
              <div>
                <p style={{ margin: '0 0 12px' }}>Simulated signal running: blinks / PERCLOS / look-away events synthesized from driving state,<br />injected into the kernel through the same metrics pipeline as the real model.</p>
                <button type="button" className="btn" onClick={onStop}>■ Stop</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dms-metrics">
        <div className={metricCls(sample ? sample.ear < 0.15 : false, false)}>
          <span>Eye aspect ratio EAR</span><b>{sample ? sample.ear.toFixed(2) : '—'}</b>
        </div>
        <div className={metricCls(perclosPct >= 25, perclosPct >= 35)}>
          <span>PERCLOS closure</span><b>{sample ? `${perclosPct.toFixed(0)}%` : '—'}</b>
        </div>
        <div className="metric">
          <span>Blink rate</span><b>{sample ? `${sample.blinkPm.toFixed(0)}/min` : '—'}</b>
        </div>
        <div className={metricCls(!!sample && sample.lookAwaySec >= 2, !!sample && sample.lookAwaySec >= 4)}>
          <span>Gaze</span>
          <b>{sample ? (sample.lookAwaySec < 0.3 ? 'On road' : `Away ${sample.lookAwaySec.toFixed(1)}s`) : '—'}</b>
        </div>
        <div className="metric">
          <span>Head yaw/pitch</span>
          <b>{sample ? `${sample.yaw.toFixed(0)}° / ${sample.pitch.toFixed(0)}°` : '—'}</b>
        </div>
        <div className={metricCls(false, !!sample && !sample.present)}>
          <span>Driver present</span><b>{sample ? (sample.present ? 'Yes' : 'Not detected') : '—'}</b>
        </div>
        <div
          className={metricCls(
            !!sample && (sample.emotion === 'sad' || sample.emotion === 'drowsy' || sample.emotion === 'surprised'),
            !!sample && sample.emotion === 'angry',
          )}
          style={{ gridColumn: '1 / -1' }}
        >
          <span>Emotion (6-class)</span>
          <b>{sample && sample.present ? `${EMO_UI[sample.emotion].emoji} ${EMO_UI[sample.emotion].label}` : '—'}</b>
        </div>
      </div>
    </section>
  );
}
