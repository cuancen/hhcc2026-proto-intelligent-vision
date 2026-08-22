/**
 * 模拟视觉信号源：无摄像头 / 模型加载失败时的降级通道。
 * 与真实模型共用同一套指标纯函数管线（PERCLOS / 视线离开追踪器），
 * 保证演示链路与生产链路一致；信号随座舱内核的工况联动：
 *  - 疲劳度越高 → 眨眼越频繁、闭眼时长越长 → PERCLOS 上升
 *  - 复杂路况 / 高疲劳 → 随机出现 2~5 秒视线离开事件
 */
import type { CockpitState, EmotionId, VisionSample } from '../core';
import { createLookAwayTracker, createPerclosTracker } from './metrics';

export interface SimVisionHandle {
  stop(): void;
}

export function startSimVision(
  getState: () => CockpitState,
  onSample: (s: VisionSample) => void,
  hz = 10,
): SimVisionHandle {
  const perclos = createPerclosTracker(30);
  const lookAway = createLookAwayTracker();
  const t0 = performance.now() / 1000;

  // 视线离开事件调度
  let awayUntil = 0;
  let awayYaw = 0;
  let awayPitch = 0;
  let nextAwayAt = t0 + 6 + Math.random() * 8;

  // 情绪事件调度：按工况选情绪并保持一段时间（供 Eva 主动关怀链路演示）
  let emoUntil = 0;
  let emoCur: EmotionId = 'neutral';
  let nextEmoAt = t0 + 6 + Math.random() * 6;

  const iv = window.setInterval(() => {
    const s = getState();
    const t = performance.now() / 1000;
    const fatigue = s.driver.fatigue;

    // 眨眼合成：周期随疲劳缩短（4.2s → 1.4s），闭眼时长随疲劳拉长
    const period = Math.max(1.4, 4.2 - fatigue * 0.028);
    const closeDur = 0.12 + fatigue * 0.0022; // 0.12s → 0.34s
    const phase = (t - t0) % period;
    const closed = phase < closeDur;
    const ear = closed ? 0.06 : 0.3 + Math.sin(t * 1.3) * 0.02;

    // 视线离开事件
    const risky = s.scenario === 'complex' || fatigue > 60;
    if (t >= nextAwayAt && awayUntil < t) {
      awayUntil = t + (risky ? 2.4 + Math.random() * 2.4 : 1.6 + Math.random() * 1.4);
      awayYaw = (26 + Math.random() * 12) * (Math.random() < 0.5 ? -1 : 1);
      awayPitch = (Math.random() - 0.35) * 14;
      nextAwayAt = awayUntil + 8 + Math.random() * (risky ? 10 : 22);
    }
    const looking = t < awayUntil;
    const yaw = looking ? awayYaw : Math.sin(t * 0.8) * 4;
    const pitch = looking ? awayPitch : Math.sin(t * 0.6) * 3;

    // 情绪合成：拥堵→angry / 高疲劳→drowsy / 情绪值高→happy / 低→sad，与工况联动
    if (t >= nextEmoAt && emoUntil < t) {
      if (s.drive.road === 'congested' && Math.random() < 0.8) {
        emoCur = 'angry'; emoUntil = t + 5 + Math.random() * 4;
      } else if (fatigue > 55) {
        emoCur = 'drowsy'; emoUntil = t + 4 + Math.random() * 4;
      } else if (s.driver.emotion >= 66) {
        emoCur = 'happy'; emoUntil = t + 6 + Math.random() * 5;
      } else if (s.driver.emotion <= 34) {
        emoCur = 'sad'; emoUntil = t + 6 + Math.random() * 5;
      } else if (Math.random() < 0.25) {
        emoCur = 'surprised'; emoUntil = t + 2.5;
      } else {
        emoCur = 'neutral'; emoUntil = t + 4;
      }
      nextEmoAt = emoUntil + 7 + Math.random() * 14;
    }

    const p = perclos.feed(t, ear);
    const la = lookAway.feed(t, yaw, pitch);

    onSample({
      present: true,
      perclos: p.perclos,
      blinkPm: p.blinkPm,
      lookAwaySec: la.lookAwaySec,
      yaw,
      pitch,
      ear,
      emotion: t < emoUntil ? emoCur : 'neutral',
      source: 'sim',
    });
  }, 1000 / hz);

  return { stop: () => window.clearInterval(iv) };
}
