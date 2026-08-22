import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { complexityOf, OMS_BEHAVIORS, P } from '../../core';
import type { CockpitActions, CockpitState, EmotionId, OmsBehavior, OmsSeat, VisionSample } from '../../core';
import type { DmsStatus } from '../../vision/dms';
import type { DmsMode } from '../hooks/useDms';
import type { LocalDmsVideo } from '../hooks/useDms';
import { formatLocalVideoSize } from '../localVideo';
import CinemaIcon from './CinemaIcon';

const SOURCE_LABEL: Record<DmsMode, string> = {
  off: 'DMS not active',
  model: 'Live camera · on-device',
  video: 'Local video · on-device',
  sim: 'Simulated DMS signal',
  replay: 'DMS replay fallback',
};

const ALERT_LABEL = { info: 'INFO', warn: 'WARNING', urgent: 'URGENT' } as const;
const EMOTION_LABEL: Record<EmotionId, string> = {
  neutral: 'Neutral',
  happy: 'Positive',
  sad: 'Low',
  angry: 'Tense',
  surprised: 'Surprised',
  drowsy: 'Drowsy',
};
function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'danger' }) {
  return <div className="evidence-metric" data-tone={tone}><span>{label}</span><b>{value}</b></div>;
}

const OMS_SEATS: OmsSeat[] = ['driver', 'front-passenger', 'rear-left', 'rear-right'];
const humanize = (value: string) => value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function EvidenceDrawer({
  open,
  onClose,
  snap,
  act,
  refresh,
  dms,
  prefs,
  onConfirmSafety,
}: {
  open: boolean;
  onClose: () => void;
  snap: CockpitState;
  act: CockpitActions;
  refresh: () => void;
  dms: {
    mode: DmsMode;
    status: DmsStatus;
    sample: VisionSample | null;
    localVideo: LocalDmsVideo | null;
    inputError: string | null;
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    startModel: () => Promise<boolean>;
    startVideo: (file: File) => Promise<boolean>;
    startSim: () => void;
    startReplay: () => void;
    stopAll: () => void;
  };
  prefs: {
    scale: number;
    zoom: (dir: -1 | 0 | 1) => void;
    highContrast: boolean;
    toggleHighContrast: () => void;
    voice: boolean;
    toggleVoice: () => void;
  };
  onConfirmSafety: () => void;
}) {
  const [command, setCommand] = useState('');
  const [omsBehavior, setOmsBehavior] = useState<OmsBehavior>('head-outside-window');
  const [omsSeat, setOmsSeat] = useState<OmsSeat>('rear-right');
  const [omsConfidence, setOmsConfidence] = useState(0.9);
  const [omsDuration, setOmsDuration] = useState(1.2);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
    if (open && !wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.setTimeout(() => closeRef.current?.focus(), 0);
    }
    if (!open && wasOpenRef.current) restoreFocusRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  const sample = dms.sample;
  const perclos = sample ? sample.perclos * 100 : 0;
  const alerts = [...snap.alerts].reverse();
  const visionFatigue = sample?.present
    ? Math.min(100, Math.max(P.perclosFatigueK * sample.perclos, Math.min(P.lookAwayFatigueCap, sample.lookAwaySec * 6)))
    : 0;
  const roadComplexity = complexityOf(snap);
  const traceDecision = snap.momentTrace.record?.decision;
  const decision = traceDecision
    || (snap.oms.risk === 'urgent'
      ? 'Rear-right occupant risk · urgent response'
      : snap.oms.risk === 'warning'
        ? 'Rear-right occupant event · duration check'
        : snap.driver.fatigue >= P.fatigueTh.urgent
    ? 'Urgent fatigue intervention'
    : snap.driver.fatigue >= P.fatigueTh.care
      ? 'Gentle fatigue care'
      : roadComplexity >= P.complexityBlock
        ? 'Coordinated cautious mode'
        : 'Monitoring within normal range');

  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;
    act.command(command.trim());
    setCommand('');
    refresh();
  };

  const setAuto = () => {
    act.setAuto(!snap.drive.auto);
    refresh();
  };

  const injectOms = () => {
    act.observeOms({
      behavior: omsBehavior,
      seat: omsSeat,
      confidence: omsConfidence,
      durationSec: omsDuration,
      source: 'simulated-oms',
      observedAt: 0,
    });
    refresh();
  };

  const clearOms = () => {
    act.clearOms();
    refresh();
  };

  const chooseVideo = () => fileInputRef.current?.click();

  const loadVideo = (file: File | undefined) => {
    if (!file) return;
    void dms.startVideo(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <button
        type="button"
        className={`evidence-backdrop${open ? ' open' : ''}`}
        aria-label="Close technical evidence"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className={`evidence-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        aria-labelledby="evidence-title"
      >
        <div className="evidence-head">
          <div>
            <span>TRACE / 01</span>
            <h2 id="evidence-title">Technical Evidence</h2>
          </div>
          <button ref={closeRef} type="button" className="cinema-icon-button" onClick={onClose} aria-label="Close technical evidence">
            <CinemaIcon name="close" />
          </button>
        </div>

        <div className="evidence-chain" aria-label="Active evidence chain: perception to reasoning to execution">
          <div><i>01</i><span>Perception</span><b>{SOURCE_LABEL[dms.mode]}</b></div>
          <em aria-hidden="true">→</em>
          <div><i>02</i><span>Reasoning</span><b>{decision}</b></div>
          <em aria-hidden="true">→</em>
          <div><i>03</i><span>Execution</span><b>{snap.drive.l2Degraded ? 'Safety response' : 'Coordinated output'}</b></div>
        </div>

        <div className="evidence-boundary-card">
          <div><span>DMS SOURCE</span><b>{SOURCE_LABEL[dms.mode]}</b></div>
          <div><span>OMS SOURCE</span><b>Simulated semantic event</b></div>
          <div><span>DRIVING ENVIRONMENT</span><b>Simulated vehicle state</b></div>
          <div><span>VEHICLE CONFIGURATION</span><b>Left-hand drive · driver front left</b></div>
          <p>Live camera and selected video frames stay inside this browser. OMS and the driving environment are transparently simulated; no raw cabin video is uploaded or stored.</p>
        </div>

        <div className="evidence-scroll">
          <div className="evidence-workbench">
          <section className="evidence-column" data-stage="perception" aria-labelledby="evidence-perception-title">
            <header className="evidence-column-title"><span>01 / INPUT</span><h3 id="evidence-perception-title">Perception</h3></header>
            <div className="evidence-section-head">
              <h3>Driver Monitoring</h3>
              <span data-state={dms.mode}>{dms.status.kind === 'loading' ? 'Loading model' : SOURCE_LABEL[dms.mode]}</span>
            </div>
            <div className="evidence-video" data-source={dms.mode}>
              <video
                ref={dms.videoRef}
                playsInline
                muted
                controls={dms.mode === 'video'}
                style={{ display: ['model', 'video'].includes(dms.mode) ? 'block' : 'none' }}
                aria-label={dms.mode === 'video' ? 'Selected local driver video' : 'Driver camera feed'}
              />
              <canvas ref={dms.canvasRef} style={{ display: ['model', 'video'].includes(dms.mode) ? 'block' : 'none' }} aria-hidden="true" />
              {!['model', 'video'].includes(dms.mode) && (
                <div className="evidence-video-empty">
                  <CinemaIcon name={['sim', 'replay'].includes(dms.mode) ? 'simulation' : 'camera'} size={28} />
                  <strong>{dms.mode === 'video' ? 'The selected local video uses the on-device DMS pipeline' : dms.mode === 'sim' ? 'Simulation is running through the real metrics pipeline' : dms.mode === 'replay' ? 'Replay fallback keeps the same DMS evidence path' : 'Camera is not active'}</strong>
                  <span>Blinks · PERCLOS · Head pose · Eyes off road · Emotion</span>
                </div>
              )}
            </div>
            <div className="evidence-actions">
              <button type="button" aria-pressed={dms.mode === 'model'} onClick={() => void dms.startModel()}><CinemaIcon name="camera" />Live DMS</button>
              <button type="button" aria-pressed={dms.mode === 'video'} onClick={chooseVideo}><CinemaIcon name="upload" />Upload Video</button>
              <button type="button" onClick={dms.stopAll} disabled={dms.mode === 'off'}>Stop</button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.m4v,.mov,.webm,.ogv,.ogg"
                hidden
                onChange={(event) => loadVideo(event.currentTarget.files?.[0])}
              />
            </div>
            {dms.mode === 'video' && dms.localVideo && (
              <div className="evidence-video-source" role="status">
                <span>LOCAL FILE · ON-DEVICE</span>
                <strong title={dms.localVideo.name}>{dms.localVideo.name}</strong>
                <small>{formatLocalVideoSize(dms.localVideo.size)}</small>
              </div>
            )}
            {dms.status.kind === 'loading' && <p className="evidence-status">{dms.status.detail}</p>}
            {dms.inputError && <p className="evidence-status error" role="alert">{dms.inputError}</p>}
            {dms.status.kind === 'error' && <p className="evidence-status error" role="alert">DMS input unavailable: {dms.status.detail}. Choose another local input, or restart the Full Demo to use its labelled replay fallback.</p>}

            <div className="evidence-metrics">
              <Metric label="EAR" value={sample ? sample.ear.toFixed(2) : '—'} />
              <Metric label="PERCLOS" value={sample ? `${perclos.toFixed(0)}%` : '—'} tone={perclos >= 35 ? 'danger' : perclos >= 25 ? 'warn' : 'normal'} />
              <Metric label="BLINK RATE" value={sample ? `${sample.blinkPm.toFixed(0)} / min` : '—'} />
              <Metric label="EYES OFF ROAD" value={sample ? `${sample.lookAwaySec.toFixed(1)} s` : '—'} tone={sample && sample.lookAwaySec >= 4 ? 'danger' : sample && sample.lookAwaySec >= 2 ? 'warn' : 'normal'} />
              <Metric label="YAW / PITCH" value={sample ? `${sample.yaw.toFixed(0)}° / ${sample.pitch.toFixed(0)}°` : '—'} />
              <Metric label="FACE STATE" value={sample ? EMOTION_LABEL[sample.emotion] : '—'} tone={sample && ['angry', 'drowsy'].includes(sample.emotion) ? 'warn' : 'normal'} />
              <Metric label="DRIVER PRESENT" value={sample ? (sample.present ? 'Yes' : 'No') : '—'} tone={sample && !sample.present ? 'danger' : 'normal'} />
            </div>

            <div className="evidence-section-head"><h3>Occupant Monitoring</h3><span>23 SEMANTIC STATES · SIMULATED</span></div>
            <div className="oms-seat-map" aria-label="OMS seat map">
              {OMS_SEATS.map((seat) => (
                <button key={seat} type="button" aria-pressed={omsSeat === seat} data-seat={seat} onClick={() => setOmsSeat(seat)}>
                  <span>{seat === 'driver' ? 'DRIVER · LEFT' : humanize(seat)}</span>
                  <i data-risk={snap.oms.active?.seat === seat ? snap.oms.risk : 'none'} />
                </button>
              ))}
            </div>
            <div className="oms-simulator">
              <label>Behavior<select value={omsBehavior} onChange={(event) => setOmsBehavior(event.target.value as OmsBehavior)}>{OMS_BEHAVIORS.map((behavior) => <option key={behavior} value={behavior}>{humanize(behavior)}</option>)}</select></label>
              <label>Confidence <b>{Math.round(omsConfidence * 100)}%</b><input type="range" min="0" max="1" step="0.01" value={omsConfidence} onChange={(event) => setOmsConfidence(Number(event.target.value))} /></label>
              <label>Duration <b>{omsDuration.toFixed(1)} s</b><input type="range" min="0" max="8" step="0.1" value={omsDuration} onChange={(event) => setOmsDuration(Number(event.target.value))} /></label>
              <div><button type="button" onClick={injectOms}>Inject event</button><button type="button" onClick={clearOms}>Mark clear</button></div>
            </div>

          </section>

          <section className="evidence-column" data-stage="reasoning" aria-labelledby="evidence-reasoning-title">
            <header className="evidence-column-title"><span>02 / FUSION</span><h3 id="evidence-reasoning-title">Reasoning</h3></header>
            <div className="reasoning-summary">
              <span>CURRENT DECISION</span>
              <h3>{decision}</h3>
              <p>EVA correlates the occupant event with local DMS evidence, then applies explicit safety thresholds without inventing a decision confidence.</p>
            </div>
            <div className="evidence-section-head"><h3>OMS × DMS Correlation</h3><span>{snap.momentTrace.phase.toUpperCase()}</span></div>
            <div className="evidence-metrics">
              <Metric label="OMS RISK" value={snap.oms.stale ? 'Stale · not clear' : snap.oms.risk.toUpperCase()} tone={snap.oms.risk === 'urgent' ? 'danger' : snap.oms.risk === 'warning' ? 'warn' : 'normal'} />
              <Metric label="SEAT / BEHAVIOR" value={snap.oms.active ? `${humanize(snap.oms.active.seat)} · ${humanize(snap.oms.active.behavior)}` : 'No active event'} />
              <Metric label="DURATION THRESHOLD" value={`${snap.oms.active?.durationSec.toFixed(1) ?? '—'} / ${P.oms.outsideUrgentSec.toFixed(1)} s`} tone={snap.oms.risk === 'urgent' ? 'danger' : 'normal'} />
              <Metric label="FATIGUE EXCLUSION" value={sample?.present && perclos < P.perclosTh.warn * 100 ? 'PERCLOS normal' : 'Awaiting evidence'} />
            </div>
            <div className="evidence-section-head"><h3>Fatigue Fusion</h3><span>TAKE THE STRONGER</span></div>
            <div className="evidence-metrics">
              <Metric label="WORKLOAD CHANNEL" value={`${Math.round(snap.driver.simFatigue)}%`} tone={snap.driver.simFatigue >= 85 ? 'danger' : snap.driver.simFatigue >= 60 ? 'warn' : 'normal'} />
              <Metric label="VISION CHANNEL" value={sample?.present ? `${Math.round(visionFatigue)}%` : '—'} tone={visionFatigue >= 85 ? 'danger' : visionFatigue >= 60 ? 'warn' : 'normal'} />
              <Metric label="FUSED FATIGUE" value={`${Math.round(snap.driver.fatigue)}%`} tone={snap.driver.fatigue >= 85 ? 'danger' : snap.driver.fatigue >= 60 ? 'warn' : 'normal'} />
              <Metric label="CARE / URGENT" value={`${P.fatigueTh.care} / ${P.fatigueTh.urgent}`} />
            </div>

            <div className="evidence-section-head"><h3>Road Context</h3><span>{roadComplexity} / 3 FACTORS</span></div>
            <div className="evidence-list">
              <div className="evidence-row"><div><b>Rain</b><span>Visibility and target-speed trim</span></div><small>{snap.drive.rain ? 'ACTIVE' : 'CLEAR'}</small></div>
              <div className="evidence-row"><div><b>Night</b><span>Lighting and cautious display state</span></div><small>{snap.drive.night ? 'ACTIVE' : 'DAY'}</small></div>
              <div className="evidence-row"><div><b>Congestion</b><span>Entertainment block threshold</span></div><small>{snap.drive.road === 'congested' ? 'ACTIVE' : 'CLEAR'}</small></div>
              <div className="evidence-row"><div><b>Decision threshold</b><span>Coordinated response at factor {P.complexityBlock}</span></div><small>{roadComplexity >= P.complexityBlock ? 'CAUTIOUS' : 'NORMAL'}</small></div>
            </div>
          </section>

          <section className="evidence-column" data-stage="execution" aria-labelledby="evidence-execution-title">
            <header className="evidence-column-title"><span>03 / OUTPUT</span><h3 id="evidence-execution-title">Execution</h3></header>
            <div className="execution-l2">
              <div><span>L2 ASSISTANCE</span><b>{snap.drive.l2Degraded ? 'Safety degraded' : snap.drive.auto ? 'Combined assistance active' : 'Standby'}</b></div>
              <button type="button" aria-pressed={snap.drive.auto} onClick={setAuto}>{snap.drive.auto ? 'Disable L2' : 'Enable L2'}</button>
              <p>L2 only assists with lane-level steering and acceleration. The driver remains responsible, must supervise continuously and be ready to take over.</p>
            </div>

            <div className="evidence-section-head"><h3>Protective Response</h3><span>{snap.oms.response.active ? 'ACTIVE' : snap.oms.awaitingConfirmation ? 'VERIFYING' : 'STANDBY'}</span></div>
            <div className="evidence-metrics">
              <Metric label="REMINDER TARGET" value={snap.oms.risk !== 'none' || snap.oms.awaitingConfirmation ? 'Rear-right passenger' : 'None'} />
              <Metric label="SPEED CAP" value={snap.oms.response.speedCapKmh === null ? 'No temporary cap' : `${snap.oms.response.speedCapKmh} km/h`} tone={snap.oms.response.active ? 'warn' : 'normal'} />
              <Metric label="FOLLOWING GAP" value={snap.oms.response.followingGap.toUpperCase()} tone={snap.oms.response.followingGap === 'extended' ? 'warn' : 'normal'} />
              <Metric label="DRIVER CONFIRMATION" value={snap.oms.awaitingConfirmation ? 'Required' : snap.momentTrace.record?.verification.driverConfirmed ? 'Confirmed' : 'Not requested'} tone={snap.oms.awaitingConfirmation ? 'warn' : 'normal'} />
            </div>
            {snap.oms.awaitingConfirmation && <button type="button" className="evidence-confirm" onClick={onConfirmSafety}>Confirm occupant and road are safe</button>}

            <div className="evidence-section-head"><h3>Cabin Actuators</h3><span>LIVE</span></div>
            <dl className="actuator-grid">
              <div><dt>Temperature</dt><dd>{snap.cabin.temp.toFixed(1)} ℃</dd></div>
              <div><dt>Fan</dt><dd>Level {snap.cabin.fan}</dd></div>
              <div><dt>Audio</dt><dd>{snap.cabin.entertainmentBlocked ? 'Blocked' : snap.cabin.music}</dd></div>
              <div><dt>Seat massage</dt><dd>{snap.cabin.seatMassage ? 'On' : 'Off'}</dd></div>
              <div><dt>Ambient light</dt><dd>{snap.cabin.ambient}</dd></div>
              <div><dt>Reading light</dt><dd>{snap.cabin.readingLight}</dd></div>
            </dl>

            <form className="evidence-command" onSubmit={submitCommand}>
              <label htmlFor="eva-command">Talk to EVA</label>
              <div><input id="eva-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Try: I am cold, turn on massage" /><button type="submit">Send</button></div>
            </form>
            {snap.pending && (
              <div className="evidence-pending">
                <b>{snap.pending.prompt}</b>
                <div>{snap.pending.options.map((option) => (
                  <button key={option.key} type="button" onClick={() => { act.reply(option.key); refresh(); }}>{option.label}</button>
                ))}</div>
              </div>
            )}

            <div className="evidence-section-head"><h3>Alert Log</h3><span>{alerts.length} ALERTS</span></div>
            <div className="alert-trace" role="log">
              {alerts.length ? alerts.map((alert) => (
                <div key={alert.id} data-level={alert.level}><b>{ALERT_LABEL[alert.level]}</b><p>{alert.text}</p><small>{alert.t.toFixed(1)}′</small></div>
              )) : <p className="evidence-empty">No alerts.</p>}
            </div>

            <div className="evidence-section-head"><h3>Display and Voice</h3><span>ACCESSIBILITY</span></div>
            <div className="preference-actions">
              <button type="button" aria-pressed={prefs.voice} onClick={prefs.toggleVoice}><CinemaIcon name="voice" />Voice {prefs.voice ? 'On' : 'Off'}</button>
              <button type="button" aria-pressed={prefs.highContrast} onClick={prefs.toggleHighContrast}><CinemaIcon name="contrast" />High contrast {prefs.highContrast ? 'On' : 'Off'}</button>
              <button type="button" onClick={() => prefs.zoom(-1)} aria-label="Decrease text size">A−</button>
              <button type="button" onClick={() => prefs.zoom(0)} aria-label="Reset text size">A</button>
              <button type="button" onClick={() => prefs.zoom(1)} aria-label="Increase text size">A+</button>
            </div>
          </section>
          </div>
        </div>
      </aside>
    </>
  );
}
