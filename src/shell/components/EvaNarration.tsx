import { useEffect, useRef } from 'react';
import type { ChatMsg } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import type { EvaMood } from '../evaFace';
import { useTts } from '../hooks/useTts';
import EvaAvatar from '../../shared/EvaAvatar';
import type { EvaExpression } from '../../shared/evaExpression';

function fallbackText(transport: DemoTransportState, step: DemoStep | null): string {
  if (step) return step.note;
  if (transport === 'paused') return 'The scene is frozen. I will continue from this exact moment.';
  if (transport === 'completed') return 'Tour complete: commute care, fatigue protection and complex-road coordination all share one cockpit kernel.';
  return 'Ready. The three-act tour moves from proactive comfort to fatigue protection and coordinated road safety.';
}

export default function EvaNarration({
  message,
  step,
  transport,
  mood,
  expression,
  voiceOn,
}: {
  message: ChatMsg | null;
  step: DemoStep | null;
  transport: DemoTransportState;
  mood: EvaMood;
  expression: EvaExpression;
  voiceOn: boolean;
}) {
  const { speak, speaking } = useTts(voiceOn);
  const lastSpokenRef = useRef<string | null>(null);
  const text = step?.note ?? message?.text ?? fallbackText(transport, step);

  useEffect(() => {
    const key = step ? `step-${step.i}` : message ? `message-${message.id}` : null;
    if (!key || lastSpokenRef.current === key) return;
    lastSpokenRef.current = key;
    if (step) speak(step.note, step.cue === 'fatigue-urgent' ? 'urg' : ['fatigue-care', 'complex-roads'].includes(step.cue) ? 'warn' : 'care');
    else if (message) speak(message.text, message.kind);
  }, [message, speak, step]);

  return (
    <section className="eva-narration" data-mood={mood} aria-live="polite" aria-atomic="true">
      <EvaAvatar expression={expression} speaking={speaking} size={58} label={`EVA is ${expression}`} />
      <div>
        <span>EVA</span>
        <p>{text}</p>
      </div>
    </section>
  );
}
