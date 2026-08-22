import type { ScenarioId } from './params';

export type RoadKind = 'city' | 'highway' | 'congested';
export type AlertLevel = 'info' | 'warn' | 'urgent';
/** 基于 Face Landmarker blendshapes 的端侧视觉情绪六态。 */
export type EmotionId = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'drowsy';
export type EvaMode = 'Observing' | 'Guarding' | 'Intervening' | 'Resting' | 'Cautious';
export type MusicKind = 'Soft' | 'Upbeat' | 'News' | 'Off';
export type CabinObjectId = 'parking-card' | 'phone' | 'laptop-bag' | 'water-bottle';
export type ContextPhase = 'idle' | 'observed' | 'searching' | 'assisting' | 'verified' | 'exit-check' | 'exit-reminded';
export type ContextStage = 'See' | 'Understand' | 'Act' | 'Verify' | 'Remind';
export type ObjectImportance = 'normal' | 'important';
export type OmsSeat = 'driver' | 'front-passenger' | 'rear-left' | 'rear-right' | 'unknown';
export type OmsRisk = 'none' | 'care' | 'warning' | 'urgent';
export type OmsBehavior =
  | 'unknown'
  | 'standing-on-seat'
  | 'standing'
  | 'lying'
  | 'sleeping'
  | 'tablet'
  | 'laptop'
  | 'phone'
  | 'calling'
  | 'reading'
  | 'makeup'
  | 'odorous-food'
  | 'eating'
  | 'drinking'
  | 'smoking'
  | 'head-outside-window'
  | 'body-outside-window'
  | 'hand-outside-window'
  | 'holding-pet'
  | 'fighting'
  | 'crying'
  | 'talking'
  | 'yawning';
export type MomentTracePhase = 'ready' | 'perceive' | 'correlate' | 'decide' | 'act' | 'verify' | 'artifact' | 'completed';
export type TraceDmsMode = 'live' | 'local-video' | 'replay-fallback';

export interface DriveState {
  /** L2 辅助驾驶是否开启（驾驶员始终监管） */
  auto: boolean;
  speed: number;
  targetSpeed: number;
  road: RoadKind;
  rain: boolean;
  night: boolean;
  curve: number;
  leadBrake: boolean;
  routeKm: number;
  elapsedMin: number;
  /** L2 因驾驶员分神而降级（缩时速距） */
  l2Degraded: boolean;
}

/** 视觉模块输出的驾驶员监测信号（DMS） */
export interface VisionSample {
  present: boolean;
  /** PERCLOS：滑动窗口内闭眼时间占比 0..1 */
  perclos: number;
  /** 每分钟眨眼次数 */
  blinkPm: number;
  /** 持续视线离开秒数（|yaw|/|pitch| 超限起累计） */
  lookAwaySec: number;
  yaw: number;
  pitch: number;
  /** 眼睛纵横比（左右均值，展示用） */
  ear: number;
  /** 面部情绪：与疲劳/PERCLOS 并行，不替代安全判断。 */
  emotion: EmotionId;
  source: 'model' | 'sim';
}

/** OMS 仅接收透明标注的语义事件；本原型不接收或保存 OMS 原始画面。 */
export interface OmsObservation {
  behavior: OmsBehavior;
  seat: OmsSeat;
  confidence: number;
  durationSec: number;
  source: 'simulated-oms';
  /** 事件源时间戳；进入内核后以当前仿真时钟为准。 */
  observedAt: number;
}

export interface OmsHistoryItem extends OmsObservation {
  id: number;
  risk: OmsRisk;
}

export interface OmsResponse {
  active: boolean;
  speedCapKmh: number | null;
  followingGap: 'normal' | 'extended';
}

export interface OmsState {
  active: OmsObservation | null;
  risk: OmsRisk;
  stale: boolean;
  lastUpdatedAt: number | null;
  awaitingConfirmation: boolean;
  response: OmsResponse;
  history: OmsHistoryItem[];
}

export interface MomentTraceRecord {
  createdAt: number;
  sources: {
    dms: 'live-local' | 'local-video' | 'replay-fallback';
    oms: 'simulated-oms';
  };
  input: {
    dms: VisionSample | null;
    oms: OmsObservation | null;
  };
  decision: string;
  actions: string[];
  verification: {
    omsClear: boolean;
    dmsForward: boolean;
    driverConfirmed: boolean;
  };
}

export interface MomentTraceState {
  phase: MomentTracePhase;
  dmsMode: TraceDmsMode;
  record: MomentTraceRecord | null;
}

export interface DriverState {
  /** 综合疲劳度 0..100（仿真累积与视觉 PERCLOS 融合） */
  fatigue: number;
  simFatigue: number;
  emotion: number;
  resting: boolean;
  attention: number;
  vision: VisionSample | null;
}

export interface CabinState {
  temp: number;
  fan: 0 | 1 | 2 | 3;
  music: MusicKind;
  seatMassage: boolean;
  ambient: string;
  entertainmentBlocked: boolean;
  readingLight: 'Off' | 'Driver left';
}

/** 物品视觉仅以语义事件进入内核；比赛原型明确标记为模拟输入，不保存原始画面。 */
export interface CabinObjectObservation {
  id: CabinObjectId;
  label: string;
  location: string;
  owner: string;
  importance: ObjectImportance;
  confidence: number;
}

export interface CabinMemoryItem extends CabinObjectObservation {
  source: 'simulated-event';
  lastSeenAt: number;
  present: boolean;
}

export interface ContextEvent {
  id: number;
  t: number;
  stage: ContextStage;
  text: string;
}

export interface ContextState {
  phase: ContextPhase;
  targetId: CabinObjectId | null;
  cause: string | null;
  assistance: string | null;
  resolved: boolean;
  memory: CabinMemoryItem[];
  events: ContextEvent[];
}

export interface ChatMsg {
  id: number;
  t: number;
  role: 'eva' | 'driver';
  kind: 'care' | 'warn' | 'urg' | 'sys';
  text: string;
}

export interface AlertItem {
  id: number;
  t: number;
  level: AlertLevel;
  text: string;
}

export interface PendingChoice {
  prompt: string;
  options: { key: string; label: string }[];
}

export interface Stats {
  proact: number;
  risk: number;
  rest: number;
  cmd: number;
  cabinAdj: number;
  warnAlerts: number;
  urgentAlerts: number;
  contextAssist: number;
  contextVerified: number;
  omsEvents: number;
  omsUrgent: number;
  momentTraces: number;
}

export interface CockpitState {
  /** 仿真分钟（自 epoch 起） */
  t: number;
  scenario: ScenarioId;
  evaMode: EvaMode;
  drive: DriveState;
  driver: DriverState;
  cabin: CabinState;
  context: ContextState;
  oms: OmsState;
  momentTrace: MomentTraceState;
  chat: ChatMsg[];
  alerts: AlertItem[];
  pending: PendingChoice | null;
  stats: Stats;
}

/** 视觉信号来源（UI 徽章用） */
export type VisionMode = 'off' | 'model' | 'sim';
