import { useEffect, useRef, useState } from 'react';
import CabinModel from './CabinModel';

/**
 * Hero 主视觉：Sketchfab CC-BY 车辆 GLB（three.js 渲染）+ Canvas 线框回退。
 * - three 与 GLB 场景代码动态 import：不进主包，加载失败零影响（容灾铁律 4）
 * - 首帧由零依赖线框 CabinModel 兜底；GLB 就绪后交叉淡入，失败则线框常驻
 * - prefers-reduced-motion：3D 车仅渲染静帧
 */
export default function CarModel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [carOn, setCarOn] = useState(false);
  const [wireOn, setWireOn] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let dispose: (() => void) | null = null;
    let dead = false;
    let fadeTimer = 0;

    const start = () => {
      import('./carScene')
        .then(({ mountCarScene }) => mountCarScene(canvas, { reducedMotion: reduced }))
        .then((d) => {
          if (dead) { d(); return; }
          dispose = d;
          setCarOn(true);
          fadeTimer = window.setTimeout(() => setWireOn(false), 1000);
        })
        .catch((err: unknown) => {
          // 加载/渲染失败：线框回退常驻，零影响；留一条控制台线索便于排查
          console.warn('[CarModel] 3D car failed to load, falling back to Canvas wireframe:', err);
        });
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = w.requestIdleCallback?.(start, { timeout: 1500 }) ?? window.setTimeout(start, 150);

    return () => {
      dead = true;
      window.clearTimeout(fadeTimer);
      if (w.cancelIdleCallback && idleId) w.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      dispose?.();
    };
  }, []);

  return (
    <div className="car-model">
      <div className={`car-stage${carOn ? ' on' : ''}`}>
        <canvas
          ref={canvasRef}
          className="car-canvas"
          role="img"
          aria-label="EVA demo car: a slowly rotating white full-car 3D model with a soft shadow and brand-orange rim light"
        />
      </div>
      {wireOn && <CabinModel />}
    </div>
  );
}
