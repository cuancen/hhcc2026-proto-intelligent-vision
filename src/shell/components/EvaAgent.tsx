import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMsg, CockpitActions, CockpitState } from '../../core';
import { deriveMood } from '../evaFace';
import { useTts } from '../hooks/useTts';
import EvaFace from './EvaFace';

const QUICK_REPLIES = ["I'm sleepy", 'Play some music', "It's hot", 'How much further?'];

/** 打字机速率：每 24ms 露出 2 个字符，与中文语速相当 */
const TYPE_INTERVAL_MS = 24;
const TYPE_CHARS_PER_TICK = 2;
/** 「正在输入…」提示时长 */
const TYPING_PRE_MS = 320;

/** Eva 消息气泡：最新一条走「正在输入 → 打字机」编排；reduced-motion 直接全文 */
function EvaBubble({ msg, animate, onTypingEnd }: {
  msg: ChatMsg;
  animate: boolean;
  onTypingEnd?: () => void;
}) {
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );
  const start = animate && !reduced;
  const [phase, setPhase] = useState<'pre' | 'typing' | 'done'>(start ? 'pre' : 'done');
  const [shown, setShown] = useState(start ? 0 : msg.text.length);

  useEffect(() => {
    if (phase !== 'pre') return;
    const t = window.setTimeout(() => setPhase('typing'), TYPING_PRE_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'typing') return;
    const iv = window.setInterval(() => {
      setShown((s) => Math.min(msg.text.length, s + TYPE_CHARS_PER_TICK));
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(iv);
  }, [phase, msg.text.length]);

  useEffect(() => {
    if (phase === 'typing' && shown >= msg.text.length) {
      setPhase('done');
      onTypingEnd?.();
    }
  }, [shown, phase, onTypingEnd]);

  // 新消息到来后本条失去 animate：立即展示全文
  useEffect(() => {
    if (!animate && phase !== 'done') {
      setShown(msg.text.length);
      setPhase('done');
    }
  }, [animate, phase, msg.text.length]);

  return (
    <div className={`msg eva ${msg.kind}`}>
      <div className="who">Eva · {msg.t.toFixed(1)}′</div>
      {/* 读屏一次拿全文；打字进度仅视觉 */}
      <span className="visually-hidden">{msg.text}</span>
      {phase === 'pre' ? (
        <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
      ) : (
        <span aria-hidden="true">{msg.text.slice(0, shown)}</span>
      )}
    </div>
  );
}

/** Eva 拟人智能体：四态表情 + 语音播报 + 对话流（打字机）+ 情境快捷回复 + 分支选择 + 自然指令 */
export default function EvaAgent({ snap, act, voiceOn }: {
  snap: CockpitState;
  act: CockpitActions;
  voiceOn: boolean;
}) {
  const [input, setInput] = useState('');
  /** 已完成打字编排的消息 id：渲染期推导 typingId，保证新气泡首帧即拿到 animate */
  const [typingDoneId, setTypingDoneId] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { speak, speaking: ttsSpeaking } = useTts(voiceOn);
  const spokenRef = useRef(0);
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );

  const lastEva = useMemo(() => {
    for (let i = snap.chat.length - 1; i >= 0; i--) {
      if (snap.chat[i].role === 'eva') return snap.chat[i];
    }
    return null;
  }, [snap.chat]);

  const typingId = !reduced && lastEva && lastEva.id > typingDoneId ? lastEva.id : 0;
  const handleTypingEnd = useCallback((id: number) => setTypingDoneId(id), []);

  // 语音播报新增的 care/warn/urg 消息（快速剧本下最多排队 2 条，紧急打断）
  useEffect(() => {
    const fresh = snap.chat.filter(
      (m) => m.role === 'eva' && m.id > spokenRef.current && (m.kind === 'care' || m.kind === 'warn' || m.kind === 'urg'),
    );
    if (!fresh.length) return;
    spokenRef.current = Math.max(spokenRef.current, fresh[fresh.length - 1].id);
    fresh.slice(-2).forEach((m) => speak(m.text, m.kind));
  }, [snap.chat.length, speak]); // eslint-disable-line react-hooks/exhaustive-deps

  // 滚动跟随：新消息与打字完成时贴底
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [snap.chat.length, typingId]);

  const send = (text: string) => {
    if (!text.trim()) return;
    act.command(text);
    setInput('');
  };

  const mood = deriveMood(snap.evaMode, lastEva, snap.t, { pending: !!snap.pending });
  const speaking = ttsSpeaking || typingId !== 0;

  return (
    <section className="panel" aria-labelledby="eva-title">
      <h2 className="panel-title" id="eva-title"><span className="dot" aria-hidden="true" />Eva Agent</h2>

      <div className="eva-head">
        <div className={`eva-face ${mood}`} aria-hidden="true">
          <EvaFace mood={mood} speaking={speaking} />
        </div>
        <div className="eva-meta">
          <div className="eva-mode" aria-live="polite">{snap.evaMode}</div>
          <div className="eva-sub">
            {snap.stats.proact} proactive · {snap.stats.cmd} commands
          </div>
        </div>
      </div>

      <div className="chat" ref={listRef} role="log" aria-label="Eva conversation" aria-live="polite">
        {snap.chat.map((m) => m.role === 'eva' ? (
          <EvaBubble key={m.id} msg={m} animate={m.id === typingId} onTypingEnd={() => handleTypingEnd(m.id)} />
        ) : (
          <div key={m.id} className="msg driver">
            <div className="who">Me · {m.t.toFixed(1)}′</div>
            {m.text}
          </div>
        ))}
        {snap.chat.length === 0 && (
          <div className="msg eva sys">Hi, I'm Eva. Switch scenes below to start exploring.</div>
        )}
      </div>

      {snap.pending && (
        <div className="pending-box" role="alert">
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

      <div className="quick" aria-label="Quick commands">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" className="btn small" onClick={() => send(q)}>{q}</button>
        ))}
      </div>

      <form
        className="cmd-row"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <label htmlFor="eva-cmd" className="visually-hidden">Talk to Eva</label>
        <input
          id="eva-cmd"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell Eva: sleepy / cold / music off / massage…"
          autoComplete="off"
        />
        <button type="submit" className="btn">Send</button>
      </form>
    </section>
  );
}
