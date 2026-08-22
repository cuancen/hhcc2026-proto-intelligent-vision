import { useEffect, useRef } from 'react';
import { brandColor, buildCabin, project, rotY } from './projection';
import type { Vec3 } from './projection';

/**
 * Hero 主视觉：手写 Canvas 伪 3D 线框座舱（零依赖、零外部模型资源）。
 * - 缓慢自转 + 正弦悬浮；深度按品牌渐变（暗红→橙红）着色
 * - 驾驶员检测框呼吸脉冲 + 舱内摄像头视线，呼应「机器视觉 DMS」主线
 * - prefers-reduced-motion：静止帧（无旋转/脉冲）
 */
export default function CabinModel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const model = buildCabin();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let lastMs = performance.now();
    let spin = 0.62; // 初始朝向：侧前 45°
    let settle = 0; // 入场缓动

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const CAM_Z = 7.4;
    const FOCAL = 3.4;

    const drawLine = (a: Vec3, b: Vec3, w: number, h: number) => {
      const pa = project(a, CAM_Z, FOCAL, w / 2, h * 0.56, Math.min(w, h) * 0.42);
      const pb = project(b, CAM_Z, FOCAL, w / 2, h * 0.56, Math.min(w, h) * 0.42);
      if (pa.depth <= 0.4 || pb.depth <= 0.4) return; // 近裁剪
      const far = Math.min(1, (Math.max(pa.depth, pb.depth) - 4.5) / 4.5);
      ctx.strokeStyle = brandColor(far, 0.9 - far * 0.45);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    };

    const draw = (ms: number) => {
      const dt = Math.min(0.1, (ms - lastMs) / 1000);
      lastMs = ms;
      if (!reduced) {
        spin += dt * 0.22; // 约 28 秒一圈
        settle = Math.min(1, settle + dt * 1.4);
      } else {
        settle = 1;
      }
      const ease = 1 - Math.pow(1 - settle, 3);
      const float = reduced ? 0 : Math.sin(ms / 1400) * 0.05;
      const lift = (float + 0.05) * ease; // 入场时整体抬升
      const a = spin - 0.62 * (1 - ease);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const map = (p: Vec3): Vec3 => {
        const r = rotY(p, a);
        return { x: r.x, y: r.y + lift, z: r.z };
      };

      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255, 120, 56, 0.35)';
      ctx.shadowBlur = 6;

      // 车身线框
      for (const [p, q] of model.segments) drawLine(map(p), map(q), w, h);
      for (const loop of model.loops) {
        for (let i = 0; i < loop.length; i++) {
          drawLine(map(loop[i]), map(loop[(i + 1) % loop.length]), w, h);
        }
      }

      // 舱内摄像头视线（细虚线，先画在检测框下层）
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      for (const [p, q] of model.gazes) drawLine(map(p), map(q), w, h);
      ctx.restore();

      // 驾驶员检测框：呼吸脉冲 + 角点
      const pulse = reduced ? 1 : 0.85 + Math.sin(ms / 520) * 0.15;
      const head = map(model.head);
      const hp = project(head, CAM_Z, FOCAL, w / 2, h * 0.56, Math.min(w, h) * 0.42);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = `rgba(255, 150, 80, ${0.55 + 0.35 * (pulse - 0.85) / 0.3})`;
      ctx.shadowColor = 'rgba(255, 120, 56, 0.7)';
      ctx.shadowBlur = 10;
      for (const [p, q] of model.headBoxSegs) {
        const pa = project({ ...map(p), y: head.y + (map(p).y - head.y) * pulse }, CAM_Z, FOCAL, w / 2, h * 0.56, Math.min(w, h) * 0.42);
        const pb = project({ ...map(q), y: head.y + (map(q).y - head.y) * pulse }, CAM_Z, FOCAL, w / 2, h * 0.56, Math.min(w, h) * 0.42);
        if (pa.depth <= 0.4 || pb.depth <= 0.4) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      // 头部标签（投影在检测框上方）
      if (hp.depth > 0.4) {
        ctx.shadowBlur = 0;
        ctx.font = '600 11px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(255, 160, 96, 0.95)';
        ctx.textAlign = 'center';
        ctx.fillText('DRIVER · TRACKED', hp.x, hp.y - 34);
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="cabin-model"
      role="img"
      aria-label="EVA cockpit wireframe: a rotating vehicle outline with a driver detection box and camera sight line"
    />
  );
}
