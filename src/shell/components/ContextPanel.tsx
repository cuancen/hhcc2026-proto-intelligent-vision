import type { CockpitActions, CockpitState, ContextStage } from '../../core';

const LOOP_STAGES: ContextStage[] = ['See', 'Understand', 'Act', 'Verify'];

const PHASE_LABEL: Record<CockpitState['context']['phase'], string> = {
  idle: 'Waiting for context input',
  observed: 'Semantic memory established',
  searching: 'Observing search behavior',
  assisting: 'Resolving the cause',
  verified: 'Risk visually verified as cleared',
  'exit-check': 'Running exit check',
  'exit-reminded': 'Exit reminder complete',
};

interface ContextPanelProps {
  snap: CockpitState;
  act: CockpitActions;
  demoRunning: boolean;
  onToggleDemo: () => void;
}

/**
 * 情境时间轨：显示语义物品记忆如何与 DMS 共同形成“看见—理解—行动—确认”闭环。
 * 物品输入始终显著标记为 simulated-event，避免把比赛模拟演成通用物体识别。
 */
export default function ContextPanel({ snap, act, demoRunning, onToggleDemo }: ContextPanelProps) {
  const { context } = snap;
  const reached = new Set(context.events.map((event) => event.stage));
  const latestLoopStage = [...context.events].reverse().find((event) => LOOP_STAGES.includes(event.stage))?.stage;
  const memory = [...context.memory].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 4);
  const events = context.events.slice(-3).reverse();

  return (
    <section className="panel context-panel" aria-labelledby="context-title" data-phase={context.phase}>
      <div className="context-heading">
        <h2 className="panel-title" id="context-title"><span className="dot" aria-hidden="true" />Context Timeline</h2>
        <span className="context-provenance" title="Object locations are simulated vision events; driver DMS can run live">
          OBJECT INPUT · SIMULATED
        </span>
      </div>

      <div
        className="loop-rail"
        role="img"
        aria-label={`Loop stages: ${LOOP_STAGES.map((stage) => `${stage} ${reached.has(stage) ? 'complete' : 'pending'}`).join(', ')}`}
      >
        {LOOP_STAGES.map((stage, index) => (
          <div
            className={`loop-stage${reached.has(stage) ? ' reached' : ''}${latestLoopStage === stage ? ' current' : ''}`}
            key={stage}
          >
            <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
            <b>{stage}</b>
          </div>
        ))}
      </div>

      <div className="context-now">
        <span>CURRENT CONTEXT</span>
        <strong>{context.cause ?? PHASE_LABEL[context.phase]}</strong>
        <p>{context.assistance ?? 'Waiting for vision events to connect with driver state.'}</p>
      </div>

      <div className="context-split">
        <div>
          <div className="context-subhead"><span>SEMANTIC MEMORY</span><b>{context.memory.length}</b></div>
          <div className="memory-list">
            {memory.length ? memory.map((item) => (
              <div className="memory-row" key={item.id}>
                <span><b>{item.label}</b><small>{item.location}</small></span>
                <i>{Math.round(item.confidence * 100)}%</i>
              </div>
            )) : <p className="context-empty">Key objects appear here after the loop begins.</p>}
          </div>
        </div>

        <div>
          <div className="context-subhead"><span>RECENT EVENTS</span><b>{context.events.length}</b></div>
          <div className="event-list" aria-live="polite">
            {events.length ? events.map((event) => (
              <div className="event-row" key={event.id}>
                <i>{event.stage}</i>
                <span>{event.text}</span>
              </div>
            )) : <p className="context-empty">No video is stored; only explainable semantic events appear here.</p>}
          </div>
        </div>
      </div>

      <div className="context-actions">
        <button type="button" className={`btn${demoRunning ? ' active' : ''}`} onClick={onToggleDemo}>
          {demoRunning ? 'Stop Loop' : 'Run Loop'}
        </button>
        <button type="button" className="btn" disabled={!context.memory.length} onClick={() => act.requestExitCheck()}>
          Exit Check
        </button>
        <span>Semantic events are removable and optional; raw frames never enter memory.</span>
      </div>
    </section>
  );
}
