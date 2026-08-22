import { useCallback, useEffect, useRef, useState } from 'react';

/** EVA 可播报的语气；sys 使用平静旁白，不再被静默丢弃。 */
const TTS_KINDS = new Set(['care', 'warn', 'urg', 'sys']);

interface SpeechItem {
  id: number;
  text: string;
  kind: string;
}

export function normalizeSpeechText(text: string): string {
  return text
    .replace(/\bDMS\b/g, 'D M S')
    .replace(/\bOMS\b/g, 'O M S')
    .replace(/\bPERCLOS\b/g, 'per-clos')
    .replace(/\bL2\b/g, 'level two')
    .replace(/[—–]/g, ', ')
    .replace(/\s*·\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = lang.startsWith('en-us') ? 40 : lang.startsWith('en-gb') ? 34 : lang.startsWith('en') ? 24 : -100;
  if (/natural|neural|aria|jenny|ava|sonia|samantha/.test(name)) score += 60;
  if (/google.*english/.test(name)) score += 34;
  if (voice.localService) score += 8;
  if (/david|mark|zira|desktop/.test(name)) score -= 12;
  return score;
}

export function selectEvaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices
    .filter((voice) => voice.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

/**
 * 单通道浏览器端语音：普通话术顺序播完，紧急话术才允许抢占。
 * 队列最多保留两条待播内容，避免场景快速变化后继续朗读过期旁白。
 */
export function useTts(enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const readyRef = useRef(false);
  const queueRef = useRef<SpeechItem[]>([]);
  const currentRef = useRef<SpeechItem | null>(null);
  const sequenceRef = useRef(0);
  const pumpRef = useRef<() => void>(() => undefined);
  const [, setVoicesTick] = useState(0);

  const cancel = useCallback(() => {
    queueRef.current = [];
    currentRef.current = null;
    sequenceRef.current += 1;
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch { /* 已销毁等 */ }
    }
    setSpeaking(false);
  }, [supported]);

  pumpRef.current = () => {
    if (!enabled || !supported || currentRef.current || queueRef.current.length === 0) return;
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (!readyRef.current || voices.length === 0) return;
    const item = queueRef.current.shift();
    if (!item) return;
    currentRef.current = item;
    const utterance = new SpeechSynthesisUtterance(normalizeSpeechText(item.text));
    utterance.lang = 'en-US';
    utterance.voice = selectEvaVoice(voices) ?? null;
    utterance.rate = item.kind === 'urg' ? 0.97 : item.kind === 'warn' ? 0.93 : 0.9;
    utterance.pitch = item.kind === 'urg' ? 0.98 : 1.04;
    utterance.volume = 0.92;
    const finish = () => {
      if (currentRef.current?.id !== item.id) return;
      currentRef.current = null;
      setSpeaking(false);
      window.setTimeout(() => pumpRef.current(), 130);
    };
    utterance.onstart = () => {
      if (currentRef.current?.id === item.id) setSpeaking(true);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    try {
      synth.speak(utterance);
    } catch {
      finish();
    }
  };

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const refresh = () => {
      readyRef.current = synth.getVoices().length > 0;
      setVoicesTick((value) => value + 1);
      pumpRef.current();
    };
    refresh();
    synth.addEventListener?.('voiceschanged', refresh);
    return () => synth.removeEventListener?.('voiceschanged', refresh);
  }, [supported]);

  const speak = useCallback((text: string, kind: string) => {
    const clean = text.trim();
    if (!enabled || !supported || !TTS_KINDS.has(kind) || !clean) return;
    const duplicate = currentRef.current?.text === clean || queueRef.current.some((item) => item.text === clean);
    if (duplicate) return;

    if (kind === 'urg') {
      queueRef.current = [];
      currentRef.current = null;
      sequenceRef.current += 1;
      try { window.speechSynthesis.cancel(); } catch { /* 不支持抢占时静默继续 */ }
      setSpeaking(false);
    } else if (queueRef.current.length >= 2) {
      queueRef.current.pop();
    }

    queueRef.current.push({ id: ++sequenceRef.current, text: clean, kind });
    pumpRef.current();
  }, [enabled, supported]);

  const pauseSpeech = useCallback(() => {
    if (!supported || !window.speechSynthesis.speaking) return;
    try { window.speechSynthesis.pause(); } catch { /* 语音服务不支持暂停 */ }
  }, [supported]);

  const resumeSpeech = useCallback(() => {
    if (!supported || !window.speechSynthesis.paused) return;
    try { window.speechSynthesis.resume(); } catch { /* 语音服务不支持恢复 */ }
  }, [supported]);

  useEffect(() => {
    if (!enabled) cancel();
  }, [cancel, enabled]);

  useEffect(() => () => {
    queueRef.current = [];
    currentRef.current = null;
    sequenceRef.current += 1;
    if (supported) {
      try { window.speechSynthesis.cancel(); } catch { /* 页面已销毁 */ }
    }
  }, [supported]);

  return { speak, speaking: speaking && enabled, pauseSpeech, resumeSpeech, cancelSpeech: cancel };
}
