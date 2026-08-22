import { useCallback, useEffect, useRef, useState } from 'react';
import EvaLoadingAvatar from '../../shared/EvaLoadingAvatar';

export const ENTRY_LEAVE_MS = 620;
export const ENTRY_MAX_MS = 1050;

/** 非阻塞进舱过渡：驾驶舱与三维资源在遮罩下从第一帧开始挂载。 */
export default function EntryTransition({ onDone }: { onDone: () => void }) {
  const doneRef = useRef(onDone);
  const finishedRef = useRef(false);
  const doneCalledRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const [leaving, setLeaving] = useState(false);
  doneRef.current = onDone;

  const complete = useCallback(() => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    doneRef.current();
  }, []);

  const finish = useCallback((fast = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setLeaving(true);
    completionTimerRef.current = globalThis.setTimeout(complete, fast ? 160 : ENTRY_MAX_MS - ENTRY_LEAVE_MS);
  }, [complete]);

  useEffect(() => {
    const leaveTimer = globalThis.setTimeout(() => finish(), ENTRY_LEAVE_MS);
    const hardTimer = globalThis.setTimeout(complete, ENTRY_MAX_MS);
    return () => {
      globalThis.clearTimeout(leaveTimer);
      globalThis.clearTimeout(hardTimer);
      if (completionTimerRef.current !== null) globalThis.clearTimeout(completionTimerRef.current);
    };
  }, [complete, finish]);

  return (
    <div className={`entry-transition${leaving ? ' leaving' : ''}`} role="status" aria-label="Entering the EVA digital twin cockpit">
      <button type="button" className="entry-skip" onClick={() => finish(true)} aria-label="Enter the cockpit now">
        <EvaLoadingAvatar
          compact
          announce={false}
          label="EVA SMART COCKPIT"
          detail="Preparing the vehicle digital twin"
        />
      </button>
      <span className="entry-line" aria-hidden="true" />
    </div>
  );
}
