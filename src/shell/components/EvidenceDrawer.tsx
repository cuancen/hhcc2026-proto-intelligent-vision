import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import type { CockpitActions, CockpitState, VisionSample } from '../../core';
import type { DmsStatus } from '../../vision/dms';
import type { DmsMode } from '../hooks/useDms';
import CinemaIcon from './CinemaIcon';

type EvidenceTab = 'perception' | 'reasoning' | 'execution';

const TAB_LABEL: Record<EvidenceTab, string> = {
  perception: '感知',
  reasoning: '推理',
  execution: '执行',
};

const SOURCE_LABEL: Record<DmsMode, string> = {
  off: 'DMS 未启用',
  model: '真实摄像头 · 本地推理',
  sim: 'DMS 模拟信号',
};

const ALERT_LABEL = { info: '提示', warn: '预警', urgent: '紧急' } as const;

function Metric({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'danger' }) {
  return <div className="evidence-metric" data-tone={tone}><span>{label}</span><b>{value}</b></div>;
}

export default function EvidenceDrawer({
  open,
  onClose,
  snap,
  act,
  refresh,
  dms,
  prefs,
}: {
  open: boolean;
  onClose: () => void;
  snap: CockpitState;
  act: CockpitActions;
  refresh: () => void;
  dms: {
    mode: DmsMode;
    status: DmsStatus;
    sample: VisionSample | null;
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    startModel: () => Promise<void>;
    startSim: () => void;
    stopAll: () => void;
  };
  prefs: {
    scale: number;
    zoom: (dir: -1 | 0 | 1) => void;
    highContrast: boolean;
    toggleHighContrast: () => void;
    voice: boolean;
    toggleVoice: () => void;
  };
}) {
  const [tab, setTab] = useState<EvidenceTab>('perception');
  const [command, setCommand] = useState('');
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
    if (open && !wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.setTimeout(() => closeRef.current?.focus(), 0);
    }
    if (!open && wasOpenRef.current) restoreFocusRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  const sample = dms.sample;
  const perclos = sample ? sample.perclos * 100 : 0;
  const events = [...snap.context.events].reverse();
  const alerts = [...snap.alerts].reverse();

  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;
    act.command(command.trim());
    setCommand('');
    refresh();
  };

  const setAuto = () => {
    act.setAuto(!snap.drive.auto);
    refresh();
  };

  return (
    <>
      <button
        type="button"
        className={`evidence-backdrop${open ? ' open' : ''}`}
        aria-label="关闭技术证据抽屉"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className={`evidence-drawer${open ? ' open' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
        aria-labelledby="evidence-title"
      >
        <div className="evidence-head">
          <div>
            <span>TRACE / 01</span>
            <h2 id="evidence-title">技术证据</h2>
          </div>
          <button ref={closeRef} type="button" className="cinema-icon-button" onClick={onClose} aria-label="关闭技术证据">
            <CinemaIcon name="close" />
          </button>
        </div>

        <div className="evidence-tabs" role="tablist" aria-label="技术证据分类">
          {(Object.keys(TAB_LABEL) as EvidenceTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>

        <div className="evidence-scroll">
          <section id="panel-perception" role="tabpanel" aria-labelledby="tab-perception" hidden={tab !== 'perception'}>
            <div className="evidence-boundary-card">
              <div><span>DMS SOURCE</span><b>{SOURCE_LABEL[dms.mode]}</b></div>
              <div><span>OBJECT SOURCE</span><b>模拟视觉事件</b></div>
              <p>驾驶员摄像头可真实运行且仅在浏览器本地推理；物品位置是透明标注的模拟语义输入，不宣称通用物体识别。</p>
            </div>

            <div className="evidence-section-head">
              <h3>驾驶员监测</h3>
              <span data-state={dms.mode}>{dms.status.kind === 'loading' ? '模型加载中' : SOURCE_LABEL[dms.mode]}</span>
            </div>
            <div className="evidence-video">
              <video ref={dms.videoRef} playsInline muted style={{ display: dms.mode === 'model' ? 'block' : 'none' }} aria-label="驾驶员摄像头画面" />
              <canvas ref={dms.canvasRef} style={{ display: dms.mode === 'model' ? 'block' : 'none' }} aria-hidden="true" />
              {dms.mode !== 'model' && (
                <div className="evidence-video-empty">
                  <CinemaIcon name={dms.mode === 'sim' ? 'simulation' : 'camera'} size={28} />
                  <strong>{dms.mode === 'sim' ? '模拟信号正在通过真实指标管线' : '摄像头尚未启用'}</strong>
                  <span>眨眼 · PERCLOS · 头部姿态 · 视线离开</span>
                </div>
              )}
            </div>
            <div className="evidence-actions">
              <button type="button" onClick={() => void dms.startModel()}><CinemaIcon name="camera" />真实 DMS</button>
              <button type="button" onClick={dms.startSim}><CinemaIcon name="simulation" />模拟信号</button>
              <button type="button" onClick={dms.stopAll} disabled={dms.mode === 'off'}>停止</button>
            </div>
            {dms.status.kind === 'loading' && <p className="evidence-status">{dms.status.detail}</p>}
            {dms.status.kind === 'error' && <p className="evidence-status error" role="alert">摄像头不可用：{dms.status.detail}。可切换模拟信号继续完整流程。</p>}

            <div className="evidence-metrics">
              <Metric label="EAR" value={sample ? sample.ear.toFixed(2) : '—'} />
              <Metric label="PERCLOS" value={sample ? `${perclos.toFixed(0)}%` : '—'} tone={perclos >= 35 ? 'danger' : perclos >= 25 ? 'warn' : 'normal'} />
              <Metric label="眨眼频率" value={sample ? `${sample.blinkPm.toFixed(0)} / min` : '—'} />
              <Metric label="视线离开" value={sample ? `${sample.lookAwaySec.toFixed(1)} s` : '—'} tone={sample && sample.lookAwaySec >= 4 ? 'danger' : sample && sample.lookAwaySec >= 2 ? 'warn' : 'normal'} />
              <Metric label="偏航 / 俯仰" value={sample ? `${sample.yaw.toFixed(0)}° / ${sample.pitch.toFixed(0)}°` : '—'} />
              <Metric label="驾驶员在位" value={sample ? (sample.present ? '是' : '否') : '—'} tone={sample && !sample.present ? 'danger' : 'normal'} />
            </div>

            <div className="evidence-section-head"><h3>车内语义记忆</h3><span>{snap.context.memory.length} ITEMS</span></div>
            <div className="evidence-list">
              {snap.context.memory.length ? snap.context.memory.map((item) => (
                <div className="evidence-row" key={item.id}>
                  <div><b>{item.label}</b><span>{item.location}</span></div>
                  <small>{Math.round(item.confidence * 100)}% · 模拟事件</small>
                </div>
              )) : <p className="evidence-empty">闭环开始后，只记录物品的语义位置，不保存原始画面。</p>}
            </div>
          </section>

          <section id="panel-reasoning" role="tabpanel" aria-labelledby="tab-reasoning" hidden={tab !== 'reasoning'}>
            <div className="reasoning-summary">
              <span>CURRENT HYPOTHESIS</span>
              <h3>{snap.context.cause ?? '等待人、物与时间形成关联'}</h3>
              <p>{snap.context.assistance ?? 'EVA 先观察证据，再决定是否干预。'}</p>
            </div>
            <div className="evidence-section-head"><h3>可解释事件链</h3><span>{events.length} EVENTS</span></div>
            <div className="event-trace" role="log">
              {events.length ? events.map((event) => (
                <div key={event.id} data-stage={event.stage}>
                  <i>{event.stage}</i>
                  <p>{event.text}</p>
                  <small>{event.t.toFixed(1)}′</small>
                </div>
              )) : <p className="evidence-empty">暂无推理事件。运行 60 秒闭环后，这里会出现“看见—理解—行动—确认”的因果轨迹。</p>}
            </div>
          </section>

          <section id="panel-execution" role="tabpanel" aria-labelledby="tab-execution" hidden={tab !== 'execution'}>
            <div className="execution-l2">
              <div><span>L2 ASSISTANCE</span><b>{snap.drive.l2Degraded ? '安全降级' : snap.drive.auto ? '组合辅助运行中' : '待机'}</b></div>
              <button type="button" aria-pressed={snap.drive.auto} onClick={setAuto}>{snap.drive.auto ? '退出 L2' : '开启 L2'}</button>
              <p>L2 仅辅助车道内转向与加减速。驾驶员始终承担驾驶责任，须持续监管并随时准备接管。</p>
            </div>

            <div className="evidence-section-head"><h3>座舱执行器</h3><span>LIVE</span></div>
            <dl className="actuator-grid">
              <div><dt>温度</dt><dd>{snap.cabin.temp.toFixed(1)} ℃</dd></div>
              <div><dt>风量</dt><dd>{snap.cabin.fan} 档</dd></div>
              <div><dt>音乐</dt><dd>{snap.cabin.entertainmentBlocked ? '已屏蔽' : snap.cabin.music}</dd></div>
              <div><dt>座椅按摩</dt><dd>{snap.cabin.seatMassage ? '开启' : '关闭'}</dd></div>
              <div><dt>氛围灯</dt><dd>{snap.cabin.ambient}</dd></div>
              <div><dt>阅读灯</dt><dd>{snap.cabin.readingLight}</dd></div>
            </dl>

            <form className="evidence-command" onSubmit={submitCommand}>
              <label htmlFor="eva-command">对 EVA 说</label>
              <div><input id="eva-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="例如：有点冷，打开按摩" /><button type="submit">发送</button></div>
            </form>
            {snap.pending && (
              <div className="evidence-pending">
                <b>{snap.pending.prompt}</b>
                <div>{snap.pending.options.map((option) => (
                  <button key={option.key} type="button" onClick={() => { act.reply(option.key); refresh(); }}>{option.label}</button>
                ))}</div>
              </div>
            )}

            <div className="evidence-section-head"><h3>告警记录</h3><span>{alerts.length} ALERTS</span></div>
            <div className="alert-trace" role="log">
              {alerts.length ? alerts.map((alert) => (
                <div key={alert.id} data-level={alert.level}><b>{ALERT_LABEL[alert.level]}</b><p>{alert.text}</p><small>{alert.t.toFixed(1)}′</small></div>
              )) : <p className="evidence-empty">暂无告警。</p>}
            </div>

            <div className="evidence-section-head"><h3>显示与语音</h3><span>ACCESSIBILITY</span></div>
            <div className="preference-actions">
              <button type="button" aria-pressed={prefs.voice} onClick={prefs.toggleVoice}><CinemaIcon name="voice" />语音 {prefs.voice ? '开' : '关'}</button>
              <button type="button" aria-pressed={prefs.highContrast} onClick={prefs.toggleHighContrast}><CinemaIcon name="contrast" />高对比 {prefs.highContrast ? '开' : '关'}</button>
              <button type="button" onClick={() => prefs.zoom(-1)} aria-label="缩小文字">A−</button>
              <button type="button" onClick={() => prefs.zoom(0)} aria-label="恢复默认文字">A</button>
              <button type="button" onClick={() => prefs.zoom(1)} aria-label="放大文字">A+</button>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
