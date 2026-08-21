import type { RefObject } from 'react';
import type { DmsStatus } from '../../vision/dms';
import type { VisionSample } from '../../core';
import type { DmsMode } from '../hooks/useDms';

interface DmsPanelProps {
  mode: DmsMode;
  status: DmsStatus;
  sample: VisionSample | null;
  videoRef: RefObject<HTMLVideoElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  onStartModel: () => void;
  onStartSim: () => void;
  onStop: () => void;
}

const SOURCE_LABEL: Record<DmsMode, string> = {
  off: '未启用',
  model: '● 摄像头模型推理',
  sim: '◆ 模拟信号（链路一致）',
};

/** 机器视觉 · 驾驶员监测面板：摄像头画面 + 关键点叠加 + DMS 指标 */
export default function DmsPanel({
  mode, status, sample, videoRef, canvasRef, onStartModel, onStartSim, onStop,
}: DmsPanelProps) {
  const perclosPct = sample ? sample.perclos * 100 : 0;
  const metricCls = (warn: boolean, danger: boolean) => (danger ? 'metric danger' : warn ? 'metric warn' : 'metric');

  return (
    <section className="panel" aria-labelledby="dms-title">
      <h2 className="panel-title" id="dms-title">
        <span className="dot" aria-hidden="true" />机器视觉 · 驾驶员监测 DMS
        <span
          className={`chip${mode === 'model' ? ' on' : mode === 'sim' ? ' warn' : ''}`}
          style={{ marginLeft: 'auto', textTransform: 'none' }}
          role="status"
        >
          {SOURCE_LABEL[mode]}
        </span>
      </h2>

      <div className="dms-video">
        <video ref={videoRef} playsInline muted style={{ display: mode === 'model' ? 'block' : 'none' }} aria-label="驾驶员摄像头画面" />
        <canvas ref={canvasRef} style={{ display: mode === 'model' ? 'block' : 'none' }} aria-hidden="true" />

        {mode !== 'model' && (
          <div className="dms-empty">
            {mode === 'off' && status.kind !== 'loading' && (
              <>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.9rem', color: 'var(--text-soft)' }}>
                    开启摄像头，用真实面部关键点模型驱动疲劳/分神监测
                  </p>
                  <p style={{ margin: '0 0 12px' }}>眨眼 · PERCLOS · 头部姿态 —— 全部在浏览器本地推理，不上传任何画面</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" className="btn" onClick={onStartModel}>📷 开启摄像头监测</button>
                  <button type="button" className="btn" onClick={onStartSim}>▶ 使用模拟信号</button>
                </div>
                {status.kind === 'error' && (
                  <p role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', maxWidth: 380 }}>
                    摄像头/模型不可用：{status.detail}。可改用模拟信号，链路与真实模型完全一致。
                  </p>
                )}
              </>
            )}
            {status.kind === 'loading' && (
              <p>⏳ {status.detail}</p>
            )}
            {mode === 'sim' && (
              <div>
                <p style={{ margin: '0 0 12px' }}>模拟信号运行中：眨眼/PERCLOS/视线离开事件随工况合成，<br />经与真实模型相同的指标管线注入内核。</p>
                <button type="button" className="btn" onClick={onStop}>■ 停止</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dms-metrics">
        <div className={metricCls(sample ? sample.ear < 0.15 : false, false)}>
          <span>眼睛纵横比 EAR</span><b>{sample ? sample.ear.toFixed(2) : '—'}</b>
        </div>
        <div className={metricCls(perclosPct >= 25, perclosPct >= 35)}>
          <span>PERCLOS 闭眼占比</span><b>{sample ? `${perclosPct.toFixed(0)}%` : '—'}</b>
        </div>
        <div className="metric">
          <span>眨眼频率</span><b>{sample ? `${sample.blinkPm.toFixed(0)} 次/分` : '—'}</b>
        </div>
        <div className={metricCls(!!sample && sample.lookAwaySec >= 2, !!sample && sample.lookAwaySec >= 4)}>
          <span>视线</span>
          <b>{sample ? (sample.lookAwaySec < 0.3 ? '注视前方' : `离开 ${sample.lookAwaySec.toFixed(1)}s`) : '—'}</b>
        </div>
        <div className="metric">
          <span>头部 偏航/俯仰</span>
          <b>{sample ? `${sample.yaw.toFixed(0)}° / ${sample.pitch.toFixed(0)}°` : '—'}</b>
        </div>
        <div className={metricCls(false, !!sample && !sample.present)}>
          <span>驾驶员在位</span><b>{sample ? (sample.present ? '是' : '未检测到') : '—'}</b>
        </div>
      </div>
    </section>
  );
}
