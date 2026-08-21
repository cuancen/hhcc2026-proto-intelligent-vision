import { useEffect, useRef } from 'react';
import type { CockpitState } from '../../core';

interface SceneViewProps {
  liveState: () => CockpitState;
}

/**
 * 态势主视图：Canvas 伪三维道路（昼夜 / 雨 / 弯道 / 前车刹车灯），HUD 覆盖层为 React。
 * 渲染走 rAF 并直接读内核实时状态（不经 React 快照），保证 60fps 平滑。
 */
export default function SceneView({ liveState }: SceneViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let travel = 0;
    let lastMs = performance.now();

    const drops = Array.from({ length: 90 }, () => ({
      x: Math.random(), y: Math.random(), len: 0.02 + Math.random() * 0.05, spd: 0.9 + Math.random() * 0.8,
    }));
    const stars = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random() * 0.3, a: 0.2 + Math.random() * 0.6 }));

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = Math.round((w * 9) / 16);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const draw = (ms: number) => {
      const dt = Math.min(0.1, (ms - lastMs) / 1000);
      lastMs = ms;
      const s = liveState();
      const d = s.drive;
      travel += (d.speed / 3.6) * dt * 0.045;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const horizon = h * 0.36;
      const t = s.t;

      // 天空与地面
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      if (d.night) { sky.addColorStop(0, '#070c1c'); sky.addColorStop(1, '#101b33'); }
      else { sky.addColorStop(0, '#27436f'); sky.addColorStop(1, '#7e9cc9'); }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = d.night ? '#060a16' : '#0d1526';
      ctx.fillRect(0, horizon, w, h - horizon);

      if (d.night) {
        for (const st of stars) {
          ctx.globalAlpha = st.a * (0.6 + 0.4 * Math.sin(t * 2 + st.x * 20));
          ctx.fillStyle = '#cfe3ff';
          ctx.fillRect(st.x * w, st.y * h, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
      }

      // 弯道视点摆动
      const bend = Math.sin(t * 0.42) * d.curve;
      const vx = w / 2 + bend * w * 0.34;
      const bwBot = w * 0.52;
      const twTop = w * 0.028;

      // 路面
      ctx.beginPath();
      ctx.moveTo(vx - bwBot, h);
      ctx.lineTo(vx - twTop, horizon);
      ctx.lineTo(vx + twTop, horizon);
      ctx.lineTo(vx + bwBot, h);
      ctx.closePath();
      ctx.fillStyle = '#1a2438';
      ctx.fill();

      // 路缘线
      ctx.strokeStyle = 'rgba(230,240,255,0.55)';
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(vx + side * bwBot, h);
        ctx.lineTo(vx + side * twTop, horizon);
        ctx.stroke();
      }

      // 车道虚线（透视）
      ctx.fillStyle = 'rgba(250, 250, 220, 0.75)';
      const N = 14;
      for (let i = 0; i < N; i++) {
        const z0 = (i / N + travel) % 1;
        const z1 = z0 + 0.42 / N;
        const y0 = horizon + (h - horizon) * Math.pow(z0, 2.4);
        const y1 = horizon + (h - horizon) * Math.pow(z1, 2.4);
        if (y1 - y0 < 1) continue;
        const w0 = twTop + (bwBot - twTop) * Math.pow(z0, 2.4);
        const w1 = twTop + (bwBot - twTop) * Math.pow(z1, 2.4);
        ctx.beginPath();
        ctx.moveTo(vx - w0 * 0.035 - 1.2, y0);
        ctx.lineTo(vx + w0 * 0.035 + 1.2, y0);
        ctx.lineTo(vx + w1 * 0.035 + 1.2, y1);
        ctx.lineTo(vx - w1 * 0.035 - 1.2, y1);
        ctx.closePath();
        ctx.fill();
      }

      // 前车
      const showLead = d.leadBrake || d.road === 'congested';
      if (showLead) {
        const zi = d.leadBrake ? 0.24 : 0.34;
        const y = horizon + (h - horizon) * Math.pow(zi, 2.0);
        const cw = bwBot * zi * 0.62;
        const chh = cw * 0.42;
        const cxp = vx;
        ctx.fillStyle = '#25314a';
        ctx.beginPath();
        ctx.roundRect(cxp - cw / 2, y - chh, cw, chh, 6);
        ctx.fill();
        // 尾灯
        ctx.fillStyle = d.leadBrake ? '#ff3b3b' : '#992222';
        ctx.shadowColor = d.leadBrake ? '#ff3b3b' : 'transparent';
        ctx.shadowBlur = d.leadBrake ? 18 : 0;
        ctx.beginPath();
        ctx.roundRect(cxp - cw / 2 + 2, y - chh * 0.72, cw * 0.16, chh * 0.28, 3);
        ctx.roundRect(cxp + cw / 2 - 2 - cw * 0.16, y - chh * 0.72, cw * 0.16, chh * 0.28, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 夜间大灯锥
      if (d.night) {
        const lamp = ctx.createRadialGradient(w / 2, h + 40, 20, w / 2, h + 40, h * 0.95);
        lamp.addColorStop(0, 'rgba(255,244,200,0.20)');
        lamp.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = lamp;
        ctx.fillRect(0, horizon, w, h - horizon);
      }

      // 雨
      if (d.rain) {
        ctx.strokeStyle = 'rgba(170,205,255,0.30)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (const dp of drops) {
          dp.y += dp.spd * dt;
          if (dp.y > 1) { dp.y = -0.05; dp.x = Math.random(); }
          const x = dp.x * w;
          const y = dp.y * h;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + dp.len * h);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [liveState]);

  const s = liveState();
  const d = s.drive;

  return (
    <section className="panel" aria-labelledby="scene-title" style={{ padding: 10 }}>
      <h2 className="panel-title" id="scene-title" style={{ marginBottom: 8 }}>
        <span className="dot" aria-hidden="true" />态势主视图
        <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }} className="chip">
          行驶 {d.elapsedMin.toFixed(0)}′ · 剩余 {d.routeKm.toFixed(1)} km
        </span>
      </h2>
      <div className="scene-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label={`态势视图：${d.night ? '夜间' : '白天'}${d.rain ? '雨天' : ''}，车速 ${Math.round(d.speed)} 公里每小时`} />
        <div className="scene-top">
          <span className="chip">{d.night ? '🌙 夜间' : '☀ 白昼'}</span>
          {d.rain && <span className="chip warn">☔ 降雨</span>}
          {d.curve > 0.35 && <span className="chip warn">↩ 弯道</span>}
          {d.leadBrake && <span className="chip warn">⚠ 前车急刹</span>}
        </div>
        <div className="hud">
          <div className="speed" aria-hidden="true">
            {Math.round(d.speed)}<small> km/h</small>
          </div>
          <span className={`badge ${d.l2Degraded ? 'l2deg' : d.auto ? 'l2on' : ''}`}>
            {d.l2Degraded ? '⚠ L2 已降级 · 请接管观察' : d.auto ? '● L2 辅助驾驶 · 监管中' : '○ 人工驾驶'}
          </span>
        </div>
      </div>
    </section>
  );
}
