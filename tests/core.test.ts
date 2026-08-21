import { describe, expect, it } from 'vitest';
import { createCockpit, P } from '../src/core';
import type { VisionSample } from '../src/core';

const idleVision = (over: Partial<VisionSample> = {}): VisionSample => ({
  present: true,
  perclos: 0.06,
  blinkPm: 18,
  lookAwaySec: 0,
  yaw: 0,
  pitch: 0,
  ear: 0.32,
  source: 'model',
  ...over,
});

function run(api: ReturnType<typeof createCockpit>, minutes: number, dt = 0.5) {
  for (let t = 0; t < minutes; t += dt) api.step(dt);
}

describe('仿真动力学', () => {
  it('高速 L2 巡航趋近道路基准速度，路况修正生效', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue'); // highway + auto
    run(api, 12);
    expect(api.state.drive.auto).toBe(true);
    expect(api.state.drive.speed).toBeGreaterThan(80);
    expect(api.state.drive.targetSpeed).toBeLessThanOrEqual(P.roadSpeed.highway);

    api.actions.setRain(true);
    api.step(0.2);
    expect(api.state.drive.targetSpeed).toBeLessThan(P.roadSpeed.highway * P.speedTrim.rain + 1);
  });

  it('前车急刹触发减速并回落', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue');
    run(api, 8);
    const before = api.state.drive.speed;
    api.actions.injectLeadBrake();
    run(api, 1.5);
    expect(api.state.drive.speed).toBeLessThan(before);
    expect(api.state.stats.risk).toBeGreaterThan(0);
  });
});

describe('疲劳守护：双阈值 + 用户选择分支', () => {
  it('≥60 触发温柔关怀（座舱调节），冷却期内不重复', () => {
    const api = createCockpit();
    api.actions.scenario('commute');
    run(api, 2);
    const adj0 = api.state.stats.cabinAdj;
    api.actions.setSimFatigue(62);
    api.step(0.2);
    expect(api.state.chat.some((c) => c.text.includes('通风'))).toBe(true);
    expect(api.state.stats.cabinAdj).toBeGreaterThan(adj0);
    const chats = api.state.chat.length;
    run(api, 2); // 冷却 8 分钟内
    expect(api.state.chat.length).toBe(chats);
  });

  it('≥85 触发紧急干预 + 休息选择分支，选择休息进入休息模式并恢复', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue');
    run(api, 1);
    api.actions.setSimFatigue(88);
    api.step(0.2);
    expect(api.state.pending).not.toBeNull();
    expect(api.state.alerts.some((a) => a.level === 'urgent')).toBe(true);

    api.actions.reply('rest');
    expect(api.state.driver.resting).toBe(true);
    expect(api.state.stats.rest).toBe(1);
    expect(api.state.cabin.music).toBe('关闭');

    run(api, 35); // restDecay 2.6/min，88 → <15 约 28 分钟后自动退出，随后恢复行驶缓慢回升
    expect(api.state.driver.simFatigue).toBeLessThan(20);
    expect(api.state.driver.resting).toBe(false); // 自动退出休息
    expect(api.state.chat.some((c) => c.text.includes('状态已明显恢复'))).toBe(true);
  });

  it('拒绝休息后 reEscalateAfter 分钟再次升级', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue');
    run(api, 1);
    api.actions.setSimFatigue(88);
    api.step(0.2);
    expect(api.state.pending).not.toBeNull();
    api.actions.reply('hold');
    expect(api.state.pending).toBeNull();

    run(api, P.reEscalateAfter - 0.6);
    expect(api.state.pending).toBeNull(); // 未到点不重复
    run(api, 1);
    expect(api.state.pending).not.toBeNull(); // 到点再升级
  });
});

describe('机器视觉通道（DMS 融合）', () => {
  it('PERCLOS 升高驱动综合疲劳并触发关怀', () => {
    const api = createCockpit();
    api.actions.scenario('commute');
    run(api, 2);
    api.actions.setVision(idleVision({ perclos: 0.38 }));
    api.step(0.2);
    expect(api.state.driver.fatigue).toBeGreaterThanOrEqual(60); // 0.38×185≈70
    expect(api.state.chat.some((c) => c.text.includes('PERCLOS'))).toBe(true);
  });

  it('视线离开分级：≥2s 预警，≥4s L2 降级，恢复后解除', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue');
    run(api, 2);
    api.actions.setVision(idleVision({ lookAwaySec: 2.4 }));
    api.step(0.2);
    expect(api.state.alerts.some((a) => a.text.includes('视线离开'))).toBe(true);
    expect(api.state.drive.l2Degraded).toBe(false);

    api.actions.setVision(idleVision({ lookAwaySec: 4.6 }));
    api.step(0.2);
    expect(api.state.drive.l2Degraded).toBe(true);
    expect(api.state.evaMode).toBe('干预中');

    api.actions.setVision(idleVision({ lookAwaySec: 0.2 }));
    api.step(0.2);
    expect(api.state.drive.l2Degraded).toBe(false);
    expect(api.state.alerts.some((a) => a.text.includes('注意力恢复'))).toBe(true);
  });

  it('驾驶员不在位预警', () => {
    const api = createCockpit();
    run(api, 1);
    api.actions.setVision(idleVision({ present: false }));
    api.step(0.2);
    expect(api.state.alerts.some((a) => a.text.includes('未检测到驾驶员'))).toBe(true);
  });
});

describe('复杂路况舱驾协同', () => {
  it('因子 ≥2 屏蔽娱乐进入谨慎模式，缓解后恢复', () => {
    const api = createCockpit();
    api.actions.scenario('complex');
    run(api, 2.6); // 雨(0.3) + 拥堵(1.2) → 1.2 起因子=2
    expect(api.state.cabin.entertainmentBlocked).toBe(true);
    expect(api.state.evaMode).toBe('谨慎模式');

    api.actions.setRain(false);
    api.actions.setNight(false);
    api.state.drive.road = 'highway'; // 测试直接改路况且规则仅读状态
    api.step(0.2);
    expect(api.state.cabin.entertainmentBlocked).toBe(false);
    expect(api.state.chat.some((c) => c.text.includes('路况已缓解'))).toBe(true);
  });
});

describe('指令解析与 L2 定位', () => {
  it('“我有点困”触发疲劳关怀链路', () => {
    const api = createCockpit();
    run(api, 1);
    expect(api.actions.command('我有点困')).toBe(true);
    expect(api.state.stats.cmd).toBe(1);
    expect(api.state.driver.simFatigue).toBeGreaterThanOrEqual(63);
    expect(api.state.chat.some((c) => c.text.includes('提神'))).toBe(true);
  });

  it('温度/音乐/按摩/导航指令', () => {
    const api = createCockpit();
    run(api, 1);
    const t0 = api.state.cabin.temp;
    api.actions.command('有点热');
    expect(api.state.cabin.temp).toBeLessThan(t0);
    api.actions.command('来点音乐');
    expect(['轻音乐', '动感', '新闻']).toContain(api.state.cabin.music);
    api.actions.command('导航还有多久');
    expect(api.state.chat.at(-1)!.text).toContain('分钟');
  });

  it('未匹配指令给出能力边界说明', () => {
    const api = createCockpit();
    run(api, 1);
    expect(api.actions.command('给我讲个笑话')).toBe(false);
    expect(api.state.chat.at(-1)!.text).toContain('学习');
  });

  it('L2 开启话术明确驾驶员监管责任，疲劳时附加警示', () => {
    const api = createCockpit();
    run(api, 1);
    api.actions.setAuto(true);
    expect(api.state.chat.some((c) => c.text.includes('监管'))).toBe(true);

    const api2 = createCockpit();
    api2.actions.scenario('fatigue');
    run(api2, 1);
    api2.actions.setSimFatigue(65);
    api2.actions.setAuto(true);
    expect(api2.state.chat.some((c) => c.text.includes('疲劳') && c.kind === 'warn')).toBe(true);
  });
});

describe('日常通勤主动服务', () => {
  it('上车问候 + 习惯座舱 + 路线规划', () => {
    const api = createCockpit();
    api.actions.scenario('commute');
    run(api, 2.2);
    expect(api.state.chat.length).toBeGreaterThanOrEqual(3);
    expect(api.state.cabin.temp).toBe(22.5);
    expect(api.state.stats.proact).toBeGreaterThanOrEqual(2);
    expect(api.state.chat.some((c) => c.text.includes('预计'))).toBe(true);
  });
});

describe('场景脚本时序', () => {
  it('中途切换场景时，脚本按当前时刻顺延（不挤压同拍）', () => {
    const api = createCockpit();
    api.actions.scenario('fatigue');
    run(api, 10); // 先行驶一段（t≈10）
    const before = api.state.chat.length;
    api.actions.scenario('commute');
    api.step(0.1); // 第一条在 +0.2，此刻不应触发
    expect(api.state.chat.length).toBe(before);
    run(api, 1);
    expect(api.state.chat.length).toBeGreaterThan(before);
  });
});

describe('快照隔离与复位', () => {
  it('snapshot 深拷贝，不影响内核状态', () => {
    const api = createCockpit();
    const snap = api.snapshot();
    snap.chat.push({ id: 999, t: 0, role: 'eva', kind: 'sys', text: 'x' });
    expect(api.state.chat.length).toBe(0);
  });

  it('reset 回到初始并重放当前场景', () => {
    const api = createCockpit();
    api.actions.scenario('complex');
    run(api, 3);
    api.actions.reset();
    expect(api.state.t).toBe(0);
    expect(api.state.drive.rain).toBe(false);
    expect(api.state.chat.length).toBe(0);
  });
});
