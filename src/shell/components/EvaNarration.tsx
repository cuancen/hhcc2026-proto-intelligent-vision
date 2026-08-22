import { useEffect, useRef } from 'react';
import type { ChatMsg } from '../../core';
import type { DemoStep, DemoTransportState } from '../autoDemo';
import type { EvaMood } from '../evaFace';
import { useTts } from '../hooks/useTts';
import EvaAvatar from '../../shared/EvaAvatar';
import type { EvaExpression } from '../../shared/evaExpression';
import type { ExperienceId } from './CinemaControls';

function fallbackText(transport: DemoTransportState, step: DemoStep | null, experience: ExperienceId): string {
  if (step) return step.note;
  if (transport === 'paused') return 'The scene is frozen. I will continue from this exact moment.';
  if (transport === 'completed') return experience === 'full-demo'
    ? 'Full Demo complete. All five EVA experiences are ready for individual review.'
    : 'MomentTrace complete: the input, decision, action, verification and source boundaries are preserved as one explainable record.';
  if (experience === 'full-demo') return 'Ready for the Full Demo: five EVA experiences will run automatically from commute to OMS MomentTrace.';
  return 'Ready for OMS MomentTrace: choose a local DMS source when needed, while rear-seat OMS risk remains transparently simulated.';
}

export default function EvaNarration({
  message,
  step,
  transport,
  mood,
  expression,
  voiceOn,
  experience,
}: {
  message: ChatMsg | null;
  step: DemoStep | null;
  transport: DemoTransportState;
  mood: EvaMood;
  expression: EvaExpression;
  voiceOn: boolean;
  experience: ExperienceId;
}) {
  const { speak, speaking, pauseSpeech, resumeSpeech } = useTts(voiceOn);
  const lastStepRef = useRef<DemoStep | null>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const text = step?.note ?? message?.text ?? fallbackText(transport, step, experience);

  useEffect(() => {
    if (step && lastStepRef.current !== step) {
      lastStepRef.current = step;
      if (step.voice === false) return;
      speak(
        step.note,
        ['fatigue-urgent', 'oms-urgent'].includes(step.cue) ? 'urg' : ['fatigue-care', 'complex-roads', 'oms-candidate', 'oms-prompt'].includes(step.cue) ? 'warn' : 'care',
      );
      return;
    }
    if (!step && message && lastMessageIdRef.current !== message.id) {
      lastMessageIdRef.current = message.id;
      speak(message.text, message.kind);
    }
  }, [message, speak, step]);

  useEffect(() => {
    if (transport === 'paused') pauseSpeech();
    else if (transport === 'running') resumeSpeech();
  }, [pauseSpeech, resumeSpeech, transport]);

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
