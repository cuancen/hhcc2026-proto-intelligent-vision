import type { ContextStage } from '../../core';
import type { DemoCue, DemoTransportState } from '../autoDemo';

const STAGES: readonly ContextStage[] = ['See', 'Understand', 'Act', 'Verify'];
const STAGE_LABEL: Record<ContextStage, string> = {
  See: 'SEE',
  Understand: 'UNDERSTAND',
  Act: 'ACT',
  Verify: 'VERIFY',
  Remind: 'REMIND',
};

const CUE_STAGE: Record<DemoCue, number> = {
  boundary: 0,
  'observe-cabin': 0,
  'observe-phone': 0,
  'search-intent': 0,
  'gaze-away': 0,
  'cause-linked': 1,
  assistance: 2,
  verified: 3,
  'exit-filter': 3,
  completed: 3,
};

export default function StoryRail({
  cue,
  eventStages,
  transport,
}: {
  cue: DemoCue | null;
  eventStages: ContextStage[];
  transport: DemoTransportState;
}) {
  const reached = new Set(eventStages);
  const current = cue ? CUE_STAGE[cue] : transport === 'ready' ? -1 : 0;
  const allDone = transport === 'completed';

  return (
    <ol
      className="story-rail"
      aria-label={`Loop progress: ${STAGES.map((stage, index) => `${STAGE_LABEL[stage]} ${allDone || reached.has(stage) || index < current ? 'complete' : index === current ? 'active' : 'pending'}`).join(', ')}`}
    >
      {STAGES.map((stage, index) => {
        const done = allDone || reached.has(stage) || index < current;
        const active = !allDone && index === current;
        return (
          <li key={stage} className={`${done ? 'done ' : ''}${active ? 'active' : ''}`}>
            <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
            <span>{STAGE_LABEL[stage]}</span>
          </li>
        );
      })}
    </ol>
  );
}
