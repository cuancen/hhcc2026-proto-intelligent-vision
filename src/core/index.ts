import { createState, stepSim } from './sim';
import {
  applyScenario,
  beginMomentTrace,
  beginObjectSearch,
  clearOms,
  confirmOmsClear,
  createCtx,
  handleCommand,
  handleReply,
  observeCabinObject,
  observeOms,
  requestExitCheck,
  runRules,
  setAuto,
  setMomentTraceDmsMode,
  setMomentTracePhase,
} from './evaRules';
import type {
  CabinObjectId,
  CabinObjectObservation,
  CockpitState,
  MomentTracePhase,
  OmsObservation,
  TraceDmsMode,
  VisionSample,
} from './types';

export * from './types';
export * from './params';
export * from './oms';
export { complexityOf, targetSpeedOf } from './sim';

export interface CockpitActions {
  scenario(id: CockpitState['scenario'], options?: { announce?: boolean }): void;
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
  /** 透明标注的模拟物品视觉事件：仅写入语义，不保存原始画面。 */
  observeCabinObject(observation: CabinObjectObservation): void;
  beginObjectSearch(id: CabinObjectId): void;
  requestExitCheck(): void;
  beginMomentTrace(mode: TraceDmsMode): void;
  setMomentTraceDmsMode(mode: TraceDmsMode): void;
  setMomentTracePhase(phase: MomentTracePhase): void;
  observeOms(observation: OmsObservation): void;
  clearOms(): void;
  confirmOmsClear(): void;
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
      scenario(id, options) {
        applyScenario(ctx, id, options);
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
      observeCabinObject(observation) {
        observeCabinObject(ctx, observation);
      },
      beginObjectSearch(id) {
        beginObjectSearch(ctx, id);
      },
      requestExitCheck() {
        requestExitCheck(ctx);
      },
      beginMomentTrace(mode) {
        beginMomentTrace(ctx, mode);
      },
      setMomentTraceDmsMode(mode) {
        setMomentTraceDmsMode(ctx, mode);
      },
      setMomentTracePhase(phase) {
        setMomentTracePhase(ctx, phase);
      },
      observeOms(observation) {
        observeOms(ctx, observation);
      },
      clearOms() {
        clearOms(ctx);
      },
      confirmOmsClear() {
        confirmOmsClear(ctx);
      },
      reset() {
        const fresh = createState(state.scenario);
        Object.assign(state, fresh);
        ctx.cd = {};
        ctx.q = [];
        ctx.flags.complexActive = false;
        ctx.flags.visEmo = { cur: 'neutral', since: 0, chatted: 'neutral' };
        applyScenario(ctx, state.scenario);
      },
    },
  };
  return api;
}
