import { useCallback, useEffect, useRef, useState } from 'react';

/** 参与语音播报的消息语气（sys 为系统日志，不读） */
const TTS_KINDS: Record<string, boolean> = { care: true, warn: true, urg: true };

/**
 * Eva 语音输出：浏览器本地 speechSynthesis（zh-CN），零依赖、零上传。
 * 防挂死设计（嵌入式/无头浏览器无语音服务时 speak 可能卡死渲染进程）：
 * - 无语音包（getVoices 为空）的环境直接跳过，绝不调用 speak
 * - 每次播报前 cancel：只读最新一条，不排队积压
 * - 语音包延迟加载：监听 voiceschanged，就绪前静默
 * TTS 不可用或被浏览器策略拦截时静默降级为纯文字。
 */
export function useTts(enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const readyRef = useRef(false);
  const [, setVoicesTick] = useState(0);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const refresh = () => {
      const ok = synth.getVoices().length > 0;
      readyRef.current = ok;
      setVoicesTick((v) => v + 1);
    };
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, [supported]);

  const speak = useCallback((text: string, kind: string) => {
    if (!enabled || !supported || !TTS_KINDS[kind] || !text.trim()) return;
    try {
      const synth = window.speechSynthesis;
      if (!readyRef.current || synth.getVoices().length === 0) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 1.05;
      const zh = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('zh'));
      if (zh) u.voice = zh;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch {
      /* 语音合成不可用：静默降级为纯文字 */
    }
  }, [enabled, supported]);

  useEffect(() => {
    if (!enabled && supported) {
      try { window.speechSynthesis.cancel(); } catch { /* 已销毁等 */ }
      setSpeaking(false);
    }
  }, [enabled, supported]);

  return { speak, speaking: speaking && enabled };
}
