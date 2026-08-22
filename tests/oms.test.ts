import { describe, expect, it } from 'vitest';
import {
  OMS_BEHAVIORS,
  P,
  classifyOmsRisk,
  createCockpit,
} from '../src/core';
import type { OmsObservation } from '../src/core';

const observation = (over: Partial<OmsObservation> = {}): OmsObservation => ({
  behavior: 'body-outside-window',
  seat: 'rear-right',
  confidence: 0.96,
  durationSec: 1.2,
  source: 'simulated-oms',
  observedAt: 0,
  ...over,
});

describe('OMS 语义风险分类', () => {
  it('公开 unknown + 22 个行为，所有行为均可稳定分类', () => {
    expect(OMS_BEHAVIORS).toHaveLength(23);
    expect(OMS_BEHAVIORS[0]).toBe('unknown');
    expect(new Set(OMS_BEHAVIORS).size).toBe(23);
    for (const behavior of OMS_BEHAVIORS) {
      expect(['none', 'care', 'warning', 'urgent']).toContain(classifyOmsRisk(
        observation({ behavior }),
        { speed: 35, roadComplexity: 0 },
      ));
    }
  });

  it('低置信度与 UNKNOWN 不执行动作，外探按持续时间分级', () => {
    expect(classifyOmsRisk(observation({ confidence: 0.59 }), { speed: 72, roadComplexity: 0 })).toBe('none');
    expect(classifyOmsRisk(observation({ behavior: 'unknown' }), { speed: 72, roadComplexity: 0 })).toBe('none');
    expect(classifyOmsRisk(observation({ durationSec: 0.4 }), { speed: 35, roadComplexity: 0 })).toBe('warning');
    expect(classifyOmsRisk(observation({ durationSec: 1.2 }), { speed: 35, roadComplexity: 0 })).toBe('urgent');
  });

  it('驾驶员任务比乘员同类行为更高，速度或复杂路况可升级 warning', () => {
    expect(classifyOmsRisk(observation({ behavior: 'phone', seat: 'rear-right' }), { speed: 35, roadComplexity: 0 })).toBe('care');
    expect(classifyOmsRisk(observation({ behavior: 'phone', seat: 'driver' }), { speed: 35, roadComplexity: 0 })).toBe('warning');
    expect(classifyOmsRisk(observation({ behavior: 'phone', seat: 'driver' }), { speed: 72, roadComplexity: 0 })).toBe('urgent');
  });
});

describe('OMS 协同安全响应', () => {
  it('MomentTrace 如实区分现场摄像头、本地视频和回放来源', () => {
    const api = createCockpit();
    api.actions.scenario('cabin-safety');
    api.actions.beginMomentTrace('local-video');
    expect(api.state.momentTrace.dmsMode).toBe('local-video');
    expect(api.state.momentTrace.record?.sources.dms).toBe('local-video');
    api.actions.setMomentTraceDmsMode('live');
    expect(api.state.momentTrace.record?.sources.dms).toBe('live-local');
    api.actions.setMomentTraceDmsMode('replay-fallback');
    expect(api.state.momentTrace.record?.sources.dms).toBe('replay-fallback');
  });

  it('L2 开启时限制目标速度并增距，清除后仍等待驾驶员确认', () => {
    const api = createCockpit();
    api.actions.scenario('cabin-safety');
    expect(api.state.drive.auto).toBe(true);
    expect(api.state.drive.speed).toBe(72);

    api.actions.observeOms(observation());
    expect(api.state.oms.risk).toBe('urgent');
    expect(api.state.oms.response.active).toBe(true);
    expect(api.state.oms.response.speedCapKmh).toBe(52);
    expect(api.state.oms.response.followingGap).toBe('extended');
    expect(api.state.drive.l2Degraded).toBe(true);

    api.actions.clearOms();
    expect(api.state.oms.active).toBeNull();
    expect(api.state.oms.awaitingConfirmation).toBe(true);
    expect(api.state.oms.response.active).toBe(true);

    api.actions.confirmOmsClear();
    expect(api.state.oms.awaitingConfirmation).toBe(false);
    expect(api.state.oms.response.active).toBe(false);
    expect(api.state.oms.response.speedCapKmh).toBeNull();
    expect(api.state.oms.response.followingGap).toBe('normal');
    expect(api.state.drive.l2Degraded).toBe(false);
  });

  it('L2 关闭时只提醒，不改变车辆策略', () => {
    const api = createCockpit();
    api.actions.scenario('cabin-safety');
    api.actions.setAuto(false);
    api.actions.observeOms(observation());
    expect(api.state.oms.risk).toBe('urgent');
    expect(api.state.oms.response.active).toBe(false);
    expect(api.state.oms.response.speedCapKmh).toBeNull();
    expect(api.state.drive.l2Degraded).toBe(false);

    api.actions.clearOms();
    expect(api.state.oms.awaitingConfirmation).toBe(true);
    api.actions.confirmOmsClear();
    expect(api.state.oms.awaitingConfirmation).toBe(false);
  });

  it('8 秒无更新标记 stale，不误判为已恢复；历史固定保留最近 20 条', () => {
    const api = createCockpit();
    api.actions.scenario('cabin-safety');
    api.actions.observeOms(observation());
    api.step(P.oms.staleMin + 0.001);
    expect(api.state.oms.stale).toBe(true);
    expect(api.state.oms.active).not.toBeNull();

    for (let index = 0; index < 24; index += 1) {
      api.actions.observeOms(observation({ behavior: index % 2 ? 'talking' : 'phone', observedAt: index }));
    }
    expect(api.state.oms.history).toHaveLength(20);
  });
});
