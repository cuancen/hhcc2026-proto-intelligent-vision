import { useEffect, useRef } from 'react';
import type { ChatMsg } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import type { EvaMood } from '../evaFace';
import { useTts } from '../hooks/useTts';

function fallbackText(transport: DemoTransportState, step: DemoStep | null): string {
  if (step) return step.note;
  if (transport === 'paused') return '现场已冻结。继续时，我会从这一刻接着讲。';
  if (transport === 'completed') return '闭环完成：我看见原因、协助解决，也确认了结果。';
  return '准备就绪。我会用一次完整闭环，讲清视觉如何从检测走向行动。';
}

export default function EvaNarration({
  message,
  step,
  transport,
  mood,
  voiceOn,
}: {
  message: ChatMsg | null;
  step: DemoStep | null;
  transport: DemoTransportState;
  mood: EvaMood;
  voiceOn: boolean;
}) {
  const { speak, speaking } = useTts(voiceOn);
  const lastSpokenRef = useRef<string | null>(null);
  const text = step?.note ?? message?.text ?? fallbackText(transport, step);

  useEffect(() => {
    const key = step ? `step-${step.i}` : message ? `message-${message.id}` : null;
    if (!key || lastSpokenRef.current === key) return;
    lastSpokenRef.current = key;
    if (step) speak(step.note, ['cause-linked', 'assistance'].includes(step.cue) ? 'warn' : 'care');
    else if (message) speak(message.text, message.kind);
  }, [message, speak, step]);

  return (
    <section className="eva-narration" data-mood={mood} aria-live="polite" aria-atomic="true">
      <div className={`narration-face${speaking ? ' speaking' : ''}`} aria-hidden="true">
        <i /><i />
      </div>
      <div>
        <span>EVA</span>
        <p>{text}</p>
      </div>
    </section>
  );
}
