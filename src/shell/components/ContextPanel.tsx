import type { CockpitActions, CockpitState, ContextStage } from '../../core';

const LOOP_STAGES: ContextStage[] = ['看见', '理解', '行动', '确认'];

const PHASE_LABEL: Record<CockpitState['context']['phase'], string> = {
  idle: '等待情境输入',
  observed: '已建立语义记忆',
  searching: '正在观察寻找行为',
  assisting: '正在协助解决原因',
  verified: '风险已视觉确认解除',
  'exit-check': '正在进行离车检查',
  'exit-reminded': '离车提醒已完成',
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
        <h2 className="panel-title" id="context-title"><span className="dot" aria-hidden="true" />情境时间轨</h2>
        <span className="context-provenance" title="物品位置来自透明标注的模拟视觉事件；驾驶员 DMS 可真实运行">
          物品输入 · 模拟
        </span>
      </div>

      <div
        className="loop-rail"
        role="img"
        aria-label={`闭环阶段：${LOOP_STAGES.map((stage) => `${stage}${reached.has(stage) ? '已完成' : '未完成'}`).join('，')}`}
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
        <span>当前情境</span>
        <strong>{context.cause ?? PHASE_LABEL[context.phase]}</strong>
        <p>{context.assistance ?? '等待视觉事件与驾驶员状态形成关联。'}</p>
      </div>

      <div className="context-split">
        <div>
          <div className="context-subhead"><span>语义记忆</span><b>{context.memory.length}</b></div>
          <div className="memory-list">
            {memory.length ? memory.map((item) => (
              <div className="memory-row" key={item.id}>
                <span><b>{item.label}</b><small>{item.location}</small></span>
                <i>{Math.round(item.confidence * 100)}%</i>
              </div>
            )) : <p className="context-empty">自动演示开始后，关键物品会出现在这里。</p>}
          </div>
        </div>

        <div>
          <div className="context-subhead"><span>最近事件</span><b>{context.events.length}</b></div>
          <div className="event-list" aria-live="polite">
            {events.length ? events.map((event) => (
              <div className="event-row" key={event.id}>
                <i>{event.stage}</i>
                <span>{event.text}</span>
              </div>
            )) : <p className="context-empty">不记录视频，只显示可解释的语义事件。</p>}
          </div>
        </div>
      </div>

      <div className="context-actions">
        <button type="button" className={`btn${demoRunning ? ' active' : ''}`} onClick={onToggleDemo}>
          {demoRunning ? '■ 停止闭环' : '▶ 运行闭环'}
        </button>
        <button type="button" className="btn" disabled={!context.memory.length} onClick={() => act.requestExitCheck()}>
          离车检查
        </button>
        <span>语义事件可删除、可关闭；原始画面不进入记忆。</span>
      </div>
    </section>
  );
}
