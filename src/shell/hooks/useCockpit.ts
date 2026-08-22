import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCockpit } from '../../core';
import type { CockpitState } from '../../core';
import { createSimulationClock } from '../simulationClock';
import type { SimulationClock } from '../simulationClock';

/**
 * 订阅座舱内核。
 * 固定 100ms 节拍保留，但准备、暂停和完成状态不会推进内核。
 * 每拍 dt = 0.2 × speed 仿真分钟；渲染层通过快照更新。
 */
export function useCockpit() {
  const api = useMemo(() => createCockpit(), []);
  const [snap, setSnap] = useState<CockpitState>(() => api.snapshot());
  const speedRef = useRef(1);
  const clockRef = useRef<SimulationClock | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const clock = createSimulationClock((dt) => {
      api.step(dt * speedRef.current);
      setSnap(api.snapshot());
    });
    clockRef.current = clock;
    return () => {
      clock.dispose();
      clockRef.current = null;
    };
  }, [api]);

  const setSpeed = useCallback((v: number) => {
    speedRef.current = v;
    setSpeedState(v);
  }, []);

  const play = useCallback(() => {
    clockRef.current?.play();
    setRunning(true);
    setSnap(api.snapshot());
  }, [api]);

  const pause = useCallback(() => {
    clockRef.current?.pause();
    setRunning(false);
    setSnap(api.snapshot());
  }, [api]);

  const refresh = useCallback(() => setSnap(api.snapshot()), [api]);

  /** Canvas 等高频渲染直接读内核实时状态（不经 React 快照） */
  const liveState = useCallback(() => api.state, [api]);

  return { snap, act: api.actions, liveState, speed, setSpeed, running, play, pause, refresh };
}
