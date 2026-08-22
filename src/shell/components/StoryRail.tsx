import type { DemoCue, DemoTransportState } from '../autoDemo';

const STAGES = ['COMMUTE', 'FATIGUE', 'COMPLEX'] as const;

const CUE_STAGE: Record<DemoCue, number> = {
  commute: 0,
  'fatigue-monitoring': 1,
  'fatigue-care': 1,
  'fatigue-urgent': 1,
  'fatigue-rest': 1,
  'complex-roads': 2,
  'conditions-ease': 2,
  'voice-command': 2,
  completed: 2,
};

export default function StoryRail({
  cue,
  transport,
}: {
  cue: DemoCue | null;
  transport: DemoTransportState;
}) {
  const current = cue ? CUE_STAGE[cue] : transport === 'ready' ? -1 : 0;
  const allDone = transport === 'completed';

  return (
    <ol
      className="story-rail"
      aria-label={`Tour progress: ${STAGES.map((stage, index) => `${stage} ${allDone || index < current ? 'complete' : index === current ? 'active' : 'pending'}`).join(', ')}`}
    >
      {STAGES.map((stage, index) => {
        const done = allDone || index < current;
        const active = !allDone && index === current;
        return (
          <li key={stage} className={`${done ? 'done ' : ''}${active ? 'active' : ''}`}>
            <i aria-hidden="true">{String(index + 1).padStart(2, '0')}</i>
            <span>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}
