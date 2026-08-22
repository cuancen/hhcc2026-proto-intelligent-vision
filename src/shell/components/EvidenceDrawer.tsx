import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import type { CockpitActions, CockpitState, ContextStage, EmotionId, VisionSample } from '../../core';
import type { DmsStatus } from '../../vision/dms';
import type { DmsMode } from '../hooks/useDms';
import CinemaIcon from './CinemaIcon';

type EvidenceTab = 'perception' | 'reasoning' | 'execution';

const TAB_LABEL: Record<EvidenceTab, string> = {
  perception: 'Perception',
  reasoning: 'Reasoning',
  execution: 'Execution',
};

const SOURCE_LABEL: Record<DmsMode, string> = {
  off: 'DMS not active',
  model: 'Live camera · on-device',
  sim: 'Simulated DMS signal',
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
const CONTEXT_STAGE_LABEL: Record<ContextStage, string> = {
  See: 'SEE',
  Understand: 'UNDERSTAND',
  Act: 'ACT',
  Verify: 'VERIFY',
  Remind: 'REMIND',
};

function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'danger' }) {
  return <div className="evidence-metric" data-tone={tone}><span>{label}</span><b>{value}</b></div>;
}

export default function EvidenceDrawer({
  open,
  onClose,
  snap,
  act,
  refresh,
  dms,
  prefs,
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
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    startModel: () => Promise<void>;
    startSim: () => void;
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
}) {
  const [tab, setTab] = useState<EvidenceTab>('perception');
  const [command, setCommand] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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
  const events = [...snap.context.events].reverse();
  const alerts = [...snap.alerts].reverse();

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

        <div className="evidence-tabs" role="tablist" aria-label="Technical evidence categories">
          {(Object.keys(TAB_LABEL) as EvidenceTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>

        <div className="evidence-scroll">
          <section id="panel-perception" role="tabpanel" aria-labelledby="tab-perception" hidden={tab !== 'perception'}>
            <div className="evidence-boundary-card">
              <div><span>DMS SOURCE</span><b>{SOURCE_LABEL[dms.mode]}</b></div>
              <div><span>OBJECT SOURCE</span><b>Simulated vision events</b></div>
              <p>The driver camera can run live and is processed only in this browser. Object locations are transparently labeled simulated semantic inputs, not a claim of general object recognition.</p>
            </div>

            <div className="evidence-section-head">
              <h3>Driver Monitoring</h3>
              <span data-state={dms.mode}>{dms.status.kind === 'loading' ? 'Loading model' : SOURCE_LABEL[dms.mode]}</span>
            </div>
            <div className="evidence-video">
              <video ref={dms.videoRef} playsInline muted style={{ display: dms.mode === 'model' ? 'block' : 'none' }} aria-label="Driver camera feed" />
              <canvas ref={dms.canvasRef} style={{ display: dms.mode === 'model' ? 'block' : 'none' }} aria-hidden="true" />
              {dms.mode !== 'model' && (
                <div className="evidence-video-empty">
                  <CinemaIcon name={dms.mode === 'sim' ? 'simulation' : 'camera'} size={28} />
                  <strong>{dms.mode === 'sim' ? 'Simulation is running through the real metrics pipeline' : 'Camera is not active'}</strong>
                  <span>Blinks · PERCLOS · Head pose · Eyes off road · Emotion</span>
                </div>
              )}
            </div>
            <div className="evidence-actions">
              <button type="button" onClick={() => void dms.startModel()}><CinemaIcon name="camera" />Live DMS</button>
              <button type="button" onClick={dms.startSim}><CinemaIcon name="simulation" />Simulation</button>
              <button type="button" onClick={dms.stopAll} disabled={dms.mode === 'off'}>Stop</button>
            </div>
            {dms.status.kind === 'loading' && <p className="evidence-status">{dms.status.detail}</p>}
            {dms.status.kind === 'error' && <p className="evidence-status error" role="alert">Camera unavailable: {dms.status.detail}. Switch to simulation to continue the full flow.</p>}

            <div className="evidence-metrics">
              <Metric label="EAR" value={sample ? sample.ear.toFixed(2) : '—'} />
              <Metric label="PERCLOS" value={sample ? `${perclos.toFixed(0)}%` : '—'} tone={perclos >= 35 ? 'danger' : perclos >= 25 ? 'warn' : 'normal'} />
              <Metric label="BLINK RATE" value={sample ? `${sample.blinkPm.toFixed(0)} / min` : '—'} />
              <Metric label="EYES OFF ROAD" value={sample ? `${sample.lookAwaySec.toFixed(1)} s` : '—'} tone={sample && sample.lookAwaySec >= 4 ? 'danger' : sample && sample.lookAwaySec >= 2 ? 'warn' : 'normal'} />
              <Metric label="YAW / PITCH" value={sample ? `${sample.yaw.toFixed(0)}° / ${sample.pitch.toFixed(0)}°` : '—'} />
              <Metric label="FACE STATE" value={sample ? EMOTION_LABEL[sample.emotion] : '—'} tone={sample && ['angry', 'drowsy'].includes(sample.emotion) ? 'warn' : 'normal'} />
              <Metric label="DRIVER PRESENT" value={sample ? (sample.present ? 'Yes' : 'No') : '—'} tone={sample && !sample.present ? 'danger' : 'normal'} />
            </div>

            <div className="evidence-section-head"><h3>Cabin Semantic Memory</h3><span>{snap.context.memory.length} ITEMS</span></div>
            <div className="evidence-list">
              {snap.context.memory.length ? snap.context.memory.map((item) => (
                <div className="evidence-row" key={item.id}>
                  <div><b>{item.label}</b><span>{item.location}</span></div>
                  <small>{Math.round(item.confidence * 100)}% · SIMULATED EVENT</small>
                </div>
              )) : <p className="evidence-empty">Once the loop starts, only semantic object locations are retained — never the raw frame.</p>}
            </div>
          </section>

          <section id="panel-reasoning" role="tabpanel" aria-labelledby="tab-reasoning" hidden={tab !== 'reasoning'}>
            <div className="reasoning-summary">
              <span>CURRENT HYPOTHESIS</span>
              <h3>{snap.context.cause ?? 'Waiting for people, objects and time to form a relationship'}</h3>
              <p>{snap.context.assistance ?? 'EVA observes the evidence before deciding whether to intervene.'}</p>
            </div>
            <div className="evidence-section-head"><h3>Explainable Event Chain</h3><span>{events.length} EVENTS</span></div>
            <div className="event-trace" role="log">
              {events.length ? events.map((event) => (
                <div key={event.id} data-stage={event.stage}>
                  <i>{CONTEXT_STAGE_LABEL[event.stage]}</i>
                  <p>{event.text}</p>
                  <small>{event.t.toFixed(1)}′</small>
                </div>
              )) : <p className="evidence-empty">No reasoning events yet. Run the 60-second loop to build a See—Understand—Act—Verify trace.</p>}
            </div>
          </section>

          <section id="panel-execution" role="tabpanel" aria-labelledby="tab-execution" hidden={tab !== 'execution'}>
            <div className="execution-l2">
              <div><span>L2 ASSISTANCE</span><b>{snap.drive.l2Degraded ? 'Safety degraded' : snap.drive.auto ? 'Combined assistance active' : 'Standby'}</b></div>
              <button type="button" aria-pressed={snap.drive.auto} onClick={setAuto}>{snap.drive.auto ? 'Disable L2' : 'Enable L2'}</button>
              <p>L2 only assists with lane-level steering and acceleration. The driver remains responsible, must supervise continuously and be ready to take over.</p>
            </div>

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
      </aside>
    </>
  );
}
