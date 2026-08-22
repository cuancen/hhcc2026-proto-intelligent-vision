import type { MomentTraceRecord } from '../../core';

function statusLabel(value: boolean, yes: string, no: string) {
  return <span data-state={value ? 'ok' : 'waiting'}>{value ? yes : no}</span>;
}

export default function MomentTraceArtifact({ record }: { record: MomentTraceRecord }) {
  const dms = record.input.dms;
  const oms = record.input.oms;
  return (
    <section className="moment-trace-artifact" aria-labelledby="moment-trace-title">
      <header>
        <div>
          <span>OMS RISK / 01</span>
          <h2 id="moment-trace-title">MomentTrace</h2>
        </div>
        <strong>CLOSED LOOP</strong>
      </header>

      <div className="moment-trace-grid">
        <article>
          <i>01</i><h3>Input</h3>
          <p><b>OMS</b>{oms ? `Rear-right · ${oms.behavior.replaceAll('-', ' ')} · ${oms.durationSec.toFixed(1)} s` : 'No active event'}</p>
          <p><b>DMS</b>{dms ? `Yaw ${dms.yaw.toFixed(0)}° · eyes off ${dms.lookAwaySec.toFixed(1)} s · PERCLOS ${(dms.perclos * 100).toFixed(0)}%` : 'No sample'}</p>
        </article>
        <article>
          <i>02</i><h3>Decision</h3>
          <p>{record.decision || 'Awaiting correlated evidence.'}</p>
        </article>
        <article>
          <i>03</i><h3>Action</h3>
          <ul>{record.actions.length ? record.actions.map((action) => <li key={action}>{action}</li>) : <li>No vehicle action executed</li>}</ul>
        </article>
        <article>
          <i>04</i><h3>Verification</h3>
          <p>{statusLabel(record.verification.omsClear, 'OMS occupant clear', 'OMS awaiting clear')}</p>
          <p>{statusLabel(record.verification.dmsForward, 'DMS gaze forward', 'DMS awaiting forward gaze')}</p>
          <p>{statusLabel(record.verification.driverConfirmed, 'Driver confirmed', 'Driver confirmation required')}</p>
        </article>
      </div>

      <footer>
        <span>DMS · {record.sources.dms === 'live-local' ? 'LIVE LOCAL' : record.sources.dms === 'local-video' ? 'LOCAL VIDEO' : 'REPLAY FALLBACK'}</span>
        <span>OMS · SIMULATED SEMANTIC EVENT</span>
        <span>NO RAW CABIN VIDEO STORED</span>
      </footer>
    </section>
  );
}
