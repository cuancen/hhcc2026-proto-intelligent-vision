import { describe, expect, it } from 'vitest';
import {
  EAR_CLOSED,
  EYE_RIGHT,
  classifyEmotion,
  createEmotionSmoother,
  createLookAwayTracker,
  createPerclosTracker,
  earOf,
  headPoseOf,
} from '../src/vision/metrics';
import { createState } from '../src/core/sim';
import { shouldReplayLookAway, simulatedEarAt } from '../src/vision/simVision';
import { createObjectUrlLease, validateLocalDmsVideo } from '../src/shell/localVideo';

/** 依据索引构造合成关键点：open=true 生成睁开眼（EAR≈0.38），否则闭眼（EAR≈0.02） */
function synthEye(open: boolean) {
  const lms: { x: number; y: number }[] = [];
  const set = (i: number, x: number, y: number) => {
    while (lms.length <= i) lms.push({ x: 0, y: 0 });
    lms[i] = { x, y };
  };
  const v = open ? 0.19 : 0.01;
  const [p1, p2, p3, p4, p5, p6] = EYE_RIGHT;
  set(p1, 0.0, 0);
  set(p2, 0.3, v);
  set(p3, 0.7, v * 0.9);
  set(p4, 1.0, 0);
  set(p5, 0.7, -v * 0.9);
  set(p6, 0.3, -v);
  return lms;
}

describe('EAR 眼睛纵横比', () => {
  it('睁眼 EAR≈0.38，闭眼低于阈值', () => {
    const open = earOf(synthEye(true), EYE_RIGHT);
    const closed = earOf(synthEye(false), EYE_RIGHT);
    expect(open).toBeGreaterThan(0.3);
    expect(closed).toBeLessThan(EAR_CLOSED);
  });
});

describe('头部姿态解算', () => {
  /** 列主序 4x4 矩阵 */
  const colMajor = (m: number[][]) => [
    m[0][0], m[1][0], m[2][0], 0,
    m[0][1], m[1][1], m[2][1], 0,
    m[0][2], m[1][2], m[2][2], 0,
    0, 0, 0, 1,
  ];

  it('单位矩阵 → 零姿态', () => {
    const { yaw, pitch } = headPoseOf(colMajor([
      [1, 0, 0], [0, 1, 0], [0, 0, 1],
    ]));
    expect(yaw).toBeCloseTo(0, 5);
    expect(pitch).toBeCloseTo(0, 5);
  });

  it('绕 Y 轴 30° → yaw=30°；绕 X 轴 20° → pitch=20°', () => {
    const rad = (d: number) => (d * Math.PI) / 180;
    const yawM = colMajor([
      [Math.cos(rad(30)), 0, Math.sin(rad(30))],
      [0, 1, 0],
      [-Math.sin(rad(30)), 0, Math.cos(rad(30))],
    ]);
    expect(headPoseOf(yawM).yaw).toBeCloseTo(30, 3);

    const pitchM = colMajor([
      [1, 0, 0],
      [0, Math.cos(rad(20)), -Math.sin(rad(20))],
      [0, Math.sin(rad(20)), Math.cos(rad(20))],
    ]);
    expect(headPoseOf(pitchM).pitch).toBeCloseTo(20, 3);
  });

  it('空矩阵安全回退零姿态', () => {
    expect(headPoseOf(undefined).yaw).toBe(0);
  });
});

describe('PERCLOS 追踪器', () => {
  it('模拟视觉冷启动从睁眼相位开始，不因首帧闭眼产生 100% PERCLOS 误报', () => {
    const tr = createPerclosTracker(30);
    let state = tr.feed(0, simulatedEarAt(0, 8));
    expect(simulatedEarAt(0, 8)).toBeGreaterThan(EAR_CLOSED);
    for (let i = 1; i <= 10; i++) state = tr.feed(i / 10, simulatedEarAt(i / 10, 8));
    expect(state.perclos).toBeLessThan(0.25);
  });

  it('持续闭眼 → 窗口占比≈1；睁闭各半 → ≈0.5', () => {
    const tr = createPerclosTracker(30);
    let st = tr.feed(0, 0.3);
    for (let i = 1; i <= 30; i++) st = tr.feed(i, 0.3); // 30s 睁眼
    for (let i = 31; i <= 62; i++) st = tr.feed(i, 0.05); // 持续闭眼：窗口滑满后占比≈1
    expect(st.perclos).toBeGreaterThan(0.9);
    expect(st.eyeClosed).toBe(true);

    const tr2 = createPerclosTracker(30);
    let st2 = tr2.feed(0, 0.3);
    for (let i = 1; i <= 60; i++) st2 = tr2.feed(i, i % 2 === 0 ? 0.05 : 0.3); // 睁闭交替
    expect(st2.perclos).toBeGreaterThan(0.4);
    expect(st2.perclos).toBeLessThan(0.6);
  });

  it('眨眼计数：3 次睁闭转换 → blinkPm≥3', () => {
    const tr = createPerclosTracker(30);
    let t = 0;
    for (let b = 0; b < 3; b++) {
      for (let i = 0; i < 10; i++, t += 0.1) tr.feed(t, 0.3);
      for (let i = 0; i < 3; i++, t += 0.1) tr.feed(t, 0.05);
    }
    const st = tr.feed(t, 0.3);
    expect(st.blinkPm).toBeGreaterThanOrEqual(3);
  });
});

describe('视线离开追踪器', () => {
  it('超阈值持续累计时长，回正清零', () => {
    const tr = createLookAwayTracker();
    expect(tr.feed(0, 5, 3).lookAwaySec).toBe(0);
    expect(tr.feed(1, 30, 5).looking).toBe(true);
    expect(tr.feed(2.5, 30, 5).lookAwaySec).toBeCloseTo(1.5, 5);
    expect(tr.feed(3, 0, 0).lookAwaySec).toBe(0);
  });

  it('俯仰超阈同样判定离开', () => {
    const tr = createLookAwayTracker();
    expect(tr.feed(0, 0, 25).looking).toBe(true);
  });
});

describe('MomentTrace DMS 回放', () => {
  it('风险存在时看向右后，OMS 清除后回正以形成恢复证据', () => {
    const state = createState('cabin-safety');
    state.momentTrace.phase = 'act';
    state.oms.active = {
      behavior: 'body-outside-window',
      seat: 'rear-right',
      confidence: 0.96,
      durationSec: 1.2,
      source: 'simulated-oms',
      observedAt: 0,
    };
    expect(shouldReplayLookAway(state)).toBe(true);
    state.oms.active = null;
    expect(shouldReplayLookAway(state)).toBe(false);
  });
});

describe('情绪分类（blendshapes 启发式）', () => {
  it('微笑+脸颊上抬 → happy；嘴角下垂+内眉上挑 → sad', () => {
    expect(classifyEmotion({ mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.4, cheekSquintRight: 0.4 }).id).toBe('happy');
    expect(classifyEmotion({ mouthFrownLeft: 0.6, mouthFrownRight: 0.6, browInnerUp: 0.6 }).id).toBe('sad');
  });

  it('眉压低+鼻冷笑 → angry（微笑为抑制项）；眉外抬+瞪眼张嘴 → surprised', () => {
    expect(classifyEmotion({ browDownLeft: 0.7, browDownRight: 0.7, noseSneerLeft: 0.5, noseSneerRight: 0.5 }).id).toBe('angry');
    // 微笑同时存在时 angry 被抑制，happy 胜出——防止笑场误报路怒
    expect(classifyEmotion({ browDownLeft: 0.7, browDownRight: 0.7, mouthSmileLeft: 0.8, mouthSmileRight: 0.8 }).id).toBe('happy');
    expect(classifyEmotion({ browOuterUpLeft: 0.7, browOuterUpRight: 0.7, eyeWideLeft: 0.6, eyeWideRight: 0.6, jawOpen: 0.7 }).id).toBe('surprised');
  });

  it('持续闭眼 → drowsy；零输入与低强度 → neutral', () => {
    expect(classifyEmotion({ eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 }).id).toBe('drowsy');
    expect(classifyEmotion({}).id).toBe('neutral');
    expect(classifyEmotion({ mouthSmileLeft: 0.1, mouthSmileRight: 0.1 }).id).toBe('neutral');
  });

  it('平滑器多数投票：未过半回落 neutral，稳定后输出多数情绪', () => {
    const sm = createEmotionSmoother(4);
    expect(sm.feed('happy')).toBe('neutral'); // 1/4 未过半
    expect(sm.feed('happy')).toBe('neutral');
    expect(sm.feed('happy')).toBe('happy');   // 3/4 过半
    expect(sm.feed('sad')).toBe('happy');     // 3/4 仍是 happy
    expect(sm.feed('sad')).toBe('neutral');   // 2/4 未过半
    expect(sm.feed('sad')).toBe('sad');       // 3/4 sad
  });
});

describe('本地 DMS 视频输入', () => {
  it('接受浏览器视频类型及常见视频扩展名，拒绝空文件和图片', () => {
    expect(validateLocalDmsVideo({ name: 'driver.mp4', type: 'video/mp4', size: 1024 })).toBeNull();
    expect(validateLocalDmsVideo({ name: 'driver.MOV', type: '', size: 1024 })).toBeNull();
    expect(validateLocalDmsVideo({ name: 'portrait.png', type: 'image/png', size: 1024 })).toMatch(/video/i);
    expect(validateLocalDmsVideo({ name: 'empty.mp4', type: 'video/mp4', size: 0 })).toMatch(/empty/i);
  });

  it('对象 URL 只释放一次，避免切换输入源后继续占用视频文件', () => {
    const revoked: string[] = [];
    const lease = createObjectUrlLease({} as Blob, {
      createObjectURL: () => 'blob:local-dms-test',
      revokeObjectURL: (url) => revoked.push(url),
    });

    expect(lease.url).toBe('blob:local-dms-test');
    lease.release();
    lease.release();
    expect(revoked).toEqual(['blob:local-dms-test']);
  });
});
