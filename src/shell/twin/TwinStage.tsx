import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CockpitState } from '../../core';
import EvaLoadingAvatar from '../../shared/EvaLoadingAvatar';
import type { TwinFrame } from './twinState';
import type { TwinSceneController } from './twinScene';

const THREE_ENHANCEMENT_DELAY_MS = 1600;

export default function TwinStage({
  liveState,
  frame,
  running,
  onReady,
}: {
  liveState: () => CockpitState;
  frame: TwinFrame;
  running: boolean;
  onReady?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<TwinSceneController | null>(null);
  const frameRef = useRef(frame);
  const runningRef = useRef(running);
  const readyRef = useRef(onReady);
  const [rendererState, setRendererState] = useState<'loading' | 'three' | 'unavailable'>('loading');
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  frameRef.current = frame;
  runningRef.current = running;
  readyRef.current = onReady;
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );

  // 二维安全舞台首帧即可交互；三维模型继续在其后异步接管。
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => readyRef.current?.());
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let controller: TwinSceneController | null = null;
    // 先让轻量二维舞台完成首帧与入口淡出，再加载 5MB 车型；也避开 StrictMode 的试运行 effect。
    const startTimer = window.setTimeout(() => {
      import('./twinScene')
        .then(({ mountTwinScene }) => mountTwinScene(canvas, {
          liveState,
          initialFrame: frameRef.current,
          running: runningRef.current,
          reducedMotion: reduced,
        }))
        .then((mounted) => {
          if (dead) { mounted.dispose(); return; }
          controller = mounted;
          controllerRef.current = mounted;
          setRendererState('three');
          readyRef.current?.();
        })
        .catch((error: unknown) => {
          console.warn('[TwinStage] 3D unavailable; keeping the EVA status view:', error);
          if (dead) return;
          setRendererState('unavailable');
          readyRef.current?.();
        });
    }, THREE_ENHANCEMENT_DELAY_MS);
    return () => {
      dead = true;
      window.clearTimeout(startTimer);
      controller?.dispose();
      controllerRef.current = null;
    };
  }, [liveState, reduced]);

  useEffect(() => {
    controllerRef.current?.setFrame(frame);
  }, [frame]);

  useEffect(() => {
    controllerRef.current?.setRunning(running);
  }, [running]);

  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const moving = running && pageVisible && !reduced && frame.motionIntensity > 0;
  const style = {
    '--twin-motion-intensity': frame.motionIntensity.toFixed(3),
    '--twin-flow-duration': `${Math.max(0.34, 1.62 - frame.motionIntensity * 1.2).toFixed(2)}s`,
  } as CSSProperties;

  return (
    <div
      className="twin-stage"
      data-renderer={rendererState}
      data-camera={frame.camera}
      data-accent={frame.accent}
      data-environment={frame.environment}
      data-moving={moving ? 'true' : 'false'}
      data-wheel-motion={frame.wheelMotion ? 'true' : 'false'}
      data-braking={frame.braking ? 'true' : 'false'}
      style={style}
    >
      <div className="twin-driving-environment" aria-hidden="true">
        <div className="twin-skyline">
          {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
        </div>
        <div className="twin-road">
          <span className="twin-lane-flow" />
          <span className="twin-road-sheen" />
        </div>
        <div className="twin-road-gates">
          {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
        </div>
        <div className="twin-lead-vehicle"><i /><i /></div>
        <div className="twin-rain">
          {Array.from({ length: 22 }, (_, index) => <i key={index} />)}
        </div>
      </div>
      {rendererState !== 'three' && (
        <div className="twin-loader">
          <EvaLoadingAvatar
            state={rendererState === 'unavailable' ? 'unavailable' : 'loading'}
            label={rendererState === 'unavailable' ? '3D TWIN OFFLINE' : 'BUILDING DIGITAL TWIN'}
            detail={rendererState === 'unavailable' ? 'Live cockpit systems remain available' : 'Loading vehicle geometry'}
          />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="twin-canvas"
        role="img"
        aria-label={`EVA vehicle digital twin, current camera ${frame.camera}`}
      />
      <div className="twin-wheel-motion" aria-hidden="true"><i /><i /></div>
      <div className="twin-renderer-state" role="status">
        <span aria-hidden="true" />
        {rendererState === 'three' ? 'LIVE 3D TWIN' : rendererState === 'unavailable' ? '3D TWIN OFFLINE' : 'BUILDING DIGITAL TWIN'}
      </div>
    </div>
  );
}
