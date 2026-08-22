export interface SimulationClockOptions {
  intervalMs?: number;
  dt?: number;
}

export interface SimulationClock {
  play(): void;
  pause(): void;
  dispose(): void;
  isRunning(): boolean;
}

/**
 * 固定节拍仿真时钟。计时器常驻，但仅在 play 状态推进内核；这样准备、暂停和
 * 演示结束时路线与仿真分钟不会继续消耗，同时仍保留后台标签页的确定性节拍。
 */
export function createSimulationClock(
  step: (dt: number) => void,
  options: SimulationClockOptions = {},
): SimulationClock {
  const intervalMs = options.intervalMs ?? 100;
  const dt = options.dt ?? 0.2;
  let running = false;
  let disposed = false;
  const timer = globalThis.setInterval(() => {
    if (!running || disposed) return;
    step(dt);
  }, intervalMs);

  return {
    play() {
      if (!disposed) running = true;
    },
    pause() {
      running = false;
    },
    dispose() {
      disposed = true;
      running = false;
      globalThis.clearInterval(timer);
    },
    isRunning() {
      return running && !disposed;
    },
  };
}
