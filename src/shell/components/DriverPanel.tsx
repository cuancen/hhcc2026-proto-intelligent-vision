import type { CockpitState } from '../../core';
import Gauge from './Gauge';

/** 驾驶员状态：疲劳（双通道融合）/ 注意力 / 情绪 */
export default function DriverPanel({ snap }: { snap: CockpitState }) {
  const v = snap.driver.vision;
  return (
    <section className="panel" aria-labelledby="driver-title">
      <h2 className="panel-title" id="driver-title"><span className="dot" aria-hidden="true" />驾驶员状态</h2>
      <div className="gauges">
        <Gauge label="疲劳度" value={snap.driver.fatigue} unit="%" warnAt={60} dangerAt={85} />
        <Gauge label="注意力" value={snap.driver.attention} unit="%" warnAt={45} dangerAt={65} invert />
        <Gauge label="情绪值" value={snap.driver.emotion} warnAt={68} dangerAt={80} />
      </div>
      <p className="l2-note" style={{ marginBottom: 0 }}>
        疲劳度 = 行车工况累积 + 机器视觉 PERCLOS 融合
        {v ? `（当前视觉源：${v.source === 'model' ? '摄像头模型' : '模拟信号'}）` : '（视觉通道未接入）'}。
      </p>
    </section>
  );
}
