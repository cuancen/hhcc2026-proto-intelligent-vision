import { describe, expect, it } from 'vitest';
import {
  EAR_CLOSED,
  EYE_RIGHT,
  createLookAwayTracker,
  createPerclosTracker,
  earOf,
  headPoseOf,
} from '../src/vision/metrics';

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
