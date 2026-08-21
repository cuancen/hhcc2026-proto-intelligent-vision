import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createCockpit } from '../../core';
import type { CockpitState } from '../../core';

/**
 * 订阅座舱内核。
 * 时间体系与既有经验一致：setInterval(100ms) 驱动仿真（后台标签页不冻结），
 * 每拍 dt = 0.2 × speed 仿真分钟；渲染层通过快照更新。
 */
export function useCockpit() {
  const api = useMemo(() => createCockpit(), []);
  const [snap, setSnap] = useState<CockpitState>(() => api.snapshot());
  const speedRef = useRef(1);
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    const iv = window.setInterval(() => {
      api.step(0.2 * speedRef.current);
      setSnap(api.snapshot());
    }, 100);
    return () => window.clearInterval(iv);
  }, [api]);

  const setSpeed = useCallback((v: number) => {
    speedRef.current = v;
    setSpeedState(v);
  }, []);

  /** Canvas 等高频渲染直接读内核实时状态（不经 React 快照） */
  const liveState = useCallback(() => api.state, [api]);

  return { snap, act: api.actions, liveState, speed, setSpeed };
}
