import { useEffect, useMemo, useRef, useState } from 'react';
import type { CockpitState } from '../../core';
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
  const [rendererState, setRendererState] = useState<'loading' | 'three' | 'fallback'>('loading');
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
          console.warn('[TwinStage] 三维场景不可用，已切换二维安全模式：', error);
          if (dead) return;
          setRendererState('fallback');
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

  return (
    <div
      className="twin-stage"
      data-renderer={rendererState}
      data-camera={frame.camera}
      data-accent={frame.accent}
    >
      <div className={`twin-fallback${rendererState === 'three' ? ' hidden' : ''}`} aria-hidden={rendererState === 'three'}>
        <svg viewBox="0 0 720 390" role="img" aria-label="EVA 整车数字孪生二维安全模式">
          <defs>
            <linearGradient id="twin-car-fill" x1="0" x2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.04" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0.16" />
            </linearGradient>
          </defs>
          <ellipse className="twin-fallback-floor" cx="360" cy="318" rx="276" ry="48" />
          <path className="twin-fallback-car" d="M126 250 183 145Q204 112 260 102h211q62 6 89 53l51 95-34 38H159Z" />
          <path className="twin-fallback-glass" d="m233 151 50-30h164q44 6 67 37l23 47H199Z" />
          <circle className="twin-fallback-wheel" cx="221" cy="288" r="44" />
          <circle className="twin-fallback-wheel" cx="517" cy="288" r="44" />
          <g className="twin-fallback-cabin">
            <rect x="266" y="160" width="64" height="72" rx="12" />
            <rect x="392" y="160" width="64" height="72" rx="12" />
            <circle cx="296" cy="146" r="18" />
            <path d="M296 166 204 228" />
          </g>
        </svg>
      </div>
      <canvas
        ref={canvasRef}
        className="twin-canvas"
        role="img"
        aria-label={`EVA 整车数字孪生，当前镜头 ${frame.camera}`}
      />
      <div className="twin-renderer-state" role="status">
        <span aria-hidden="true" />
        {rendererState === 'three' ? '实时三维孪生' : rendererState === 'fallback' ? '二维安全模式' : '正在建立数字孪生'}
      </div>
    </div>
  );
}
