import { useEffect, useRef, useState } from 'react';
import EvaLoadingAvatar from '../shared/EvaLoadingAvatar';

/**
 * Hero 主视觉：Sketchfab CC-BY 车辆 GLB（three.js 渲染）+ EVA 状态回退。
 * - three 与 GLB 场景代码动态 import：不进主包，加载失败零影响（容灾铁律 4）
 * - 首帧与模型异常统一由 EVA 头像承接，不再展示旧线框汽车
 * - prefers-reduced-motion：3D 车仅渲染静帧
 */
export default function CarModel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererState, setRendererState] = useState<'loading' | 'three' | 'unavailable'>('loading');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let dispose: (() => void) | null = null;
    let dead = false;
    const start = () => {
      import('./carScene')
        .then(({ mountCarScene }) => mountCarScene(canvas, { reducedMotion: reduced }))
        .then((d) => {
          if (dead) { d(); return; }
          dispose = d;
          setRendererState('three');
        })
        .catch((err: unknown) => {
          if (dead) return;
          setRendererState('unavailable');
          console.warn('[CarModel] 3D vehicle unavailable; keeping the EVA status view:', err);
        });
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = w.requestIdleCallback?.(start, { timeout: 1500 }) ?? window.setTimeout(start, 150);

    return () => {
      dead = true;
      if (w.cancelIdleCallback && idleId) w.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
      dispose?.();
    };
  }, []);

  return (
    <div className="car-model" data-renderer={rendererState}>
      <div className={`car-stage${rendererState === 'three' ? ' on' : ''}`}>
        <canvas
          ref={canvasRef}
          className="car-canvas"
          role="img"
          aria-label="EVA concept vehicle: a rotating graphite 3D car with soft grounding"
        />
      </div>
      {rendererState !== 'three' && (
        <div className="car-loader">
          <EvaLoadingAvatar
            state={rendererState === 'unavailable' ? 'unavailable' : 'loading'}
            label={rendererState === 'unavailable' ? '3D VEHICLE OFFLINE' : 'PREPARING VEHICLE'}
            detail={rendererState === 'unavailable' ? 'Enter the cockpit to continue' : 'Loading digital twin geometry'}
          />
        </div>
      )}
    </div>
  );
}
