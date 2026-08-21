import { useEffect, useRef, useState } from 'react';
import type { CockpitActions, CockpitState } from '../../core';

const QUICK_REPLIES = ['我有点困', '来点音乐', '有点热', '导航还有多久'];

function faceClass(mode: CockpitState['evaMode']) {
  if (mode === '干预中') return 'eva-face urg';
  if (mode === '守护中' || mode === '谨慎模式' || mode === '休息引导中') return 'eva-face warn';
  return 'eva-face';
}

/** Eva 拟人智能体：表情 + 对话流 + 情境快捷回复 + 分支选择 + 自然指令 */
export default function EvaAgent({ snap, act }: { snap: CockpitState; act: CockpitActions }) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snap.chat.length]);

  const send = (text: string) => {
    if (!text.trim()) return;
    act.command(text);
    setInput('');
  };

  return (
    <section className="panel" aria-labelledby="eva-title">
      <h2 className="panel-title" id="eva-title"><span className="dot" aria-hidden="true" />Eva 智能体</h2>

      <div className="eva-head">
        <div className={faceClass(snap.evaMode)} aria-hidden="true">
          <div className="eyes"><span className="eye" /><span className="eye" /></div>
        </div>
        <div className="eva-meta">
          <div className="eva-mode" aria-live="polite">{snap.evaMode}</div>
          <div className="eva-sub">
            主动服务 {snap.stats.proact} 次 · 指令 {snap.stats.cmd} 条
          </div>
        </div>
      </div>

      <div className="chat" ref={listRef} role="log" aria-label="Eva 对话流" aria-live="polite">
        {snap.chat.map((m) => (
          <div key={m.id} className={`msg ${m.role}${m.role === 'eva' ? ` ${m.kind}` : ''}`}>
            <div className="who">{m.role === 'eva' ? `Eva · ${m.t.toFixed(1)}′` : `我 · ${m.t.toFixed(1)}′`}</div>
            {m.text}
          </div>
        ))}
        {snap.chat.length === 0 && (
          <div className="msg eva sys">您好，我是 Eva。切换下方场景即可开始体验。</div>
        )}
      </div>

      {snap.pending && (
        <div className="pending-box" role="alertdialog" aria-label={snap.pending.prompt}>
          <div>⚠ {snap.pending.prompt}</div>
          <div className="opt">
            {snap.pending.options.map((o) => (
              <button key={o.key} type="button" className="btn small" onClick={() => act.reply(o.key)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="quick" aria-label="快捷指令">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" className="btn small" onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <form
        className="cmd-row"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <label htmlFor="eva-cmd" className="visually-hidden">对 Eva 说</label>
        <input
          id="eva-cmd"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="对 Eva 说：困了 / 冷 / 关音乐 / 按摩…"
          autoComplete="off"
        />
        <button type="submit" className="btn">发送</button>
      </form>
    </section>
  );
}
