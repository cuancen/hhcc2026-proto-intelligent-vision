import { createState, stepSim } from './sim';
import { applyScenario, createCtx, handleCommand, handleReply, runRules, setAuto } from './evaRules';
import type { CockpitState, VisionSample } from './types';

export * from './types';
export * from './params';
export { complexityOf, targetSpeedOf } from './sim';

export interface CockpitActions {
  scenario(id: CockpitState['scenario']): void;
  /** 人工注入仿真疲劳（滑杆 0-100） */
  setSimFatigue(v: number): void;
  setRain(on: boolean): void;
  setNight(on: boolean): void;
  injectLeadBrake(): void;
  setAuto(on: boolean): void;
  command(text: string): boolean;
  reply(key: string): void;
  /** 视觉模块每个采样周期写入一次 DMS 信号 */
  setVision(sample: VisionSample | null): void;
  reset(): void;
}

export interface Cockpit {
  /** 内部可变状态（内核与测试使用；UI 请用 snapshot 订阅） */
  readonly state: CockpitState;
  /** 深拷贝快照（JSON 安全），供 React useSyncExternalStore */
  snapshot(): CockpitState;
  /** 推进 dt 仿真分钟：先仿真动力学，再跑 Eva 规则引擎 */
  step(dt: number): void;
  readonly actions: CockpitActions;
}

export function createCockpit(): Cockpit {
  const state = createState('commute');
  const ctx = createCtx(state);

  const api: Cockpit = {
    state,
    snapshot: () => structuredClone(state),
    step(dt: number) {
      stepSim(state, dt);
      runRules(ctx, dt);
    },
    actions: {
      scenario(id) {
        applyScenario(ctx, id);
      },
      setSimFatigue(v) {
        state.driver.simFatigue = Math.min(100, Math.max(0, v));
      },
      setRain(on) {
        state.drive.rain = on;
      },
      setNight(on) {
        state.drive.night = on;
      },
      injectLeadBrake() {
        state.drive.leadBrake = true;
        state.stats.risk += 1;
      },
      setAuto(on) {
        setAuto(ctx, on);
      },
      command(text) {
        return handleCommand(ctx, text);
      },
      reply(key) {
        handleReply(ctx, key);
      },
      setVision(sample) {
        state.driver.vision = sample;
      },
      reset() {
        const fresh = createState(state.scenario);
        Object.assign(state, fresh);
        ctx.cd = {};
        ctx.q = [];
        ctx.flags.complexActive = false;
        applyScenario(ctx, state.scenario);
      },
    },
  };
  return api;
}
