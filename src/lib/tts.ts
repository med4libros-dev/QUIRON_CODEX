import { createStore } from './createStore';

/**
 * Lectura en voz alta con las voces del sistema (Windows trae voces en español que funcionan sin internet).
 * Cola de fragmentos: título + texto, con pausa, velocidad y detener.
 */
export interface TtsItem {
  title?: string;
  text: string;
}
interface TtsState {
  queue: TtsItem[];
  index: number;
  speaking: boolean;
  paused: boolean;
  rate: number;
  label: string;
}

export const useTts = createStore<TtsState>(
  () => ({ queue: [], index: 0, speaking: false, paused: false, rate: 1, label: '' }),
  { key: 'alq:tts', storage: 'local', pick: ({ rate }) => ({ rate }) },
);

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function spanishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'es-MX') ?? voices.find((v) => v.lang.startsWith('es-US')) ?? voices.find((v) => v.lang.startsWith('es')) ?? null;
}

let token = 0;
function speakAt(i: number, my: number) {
  const s = useTts.getState();
  const it = s.queue[i];
  if (!it || my !== token) {
    if (my === token) useTts.setState({ speaking: false, paused: false, index: 0 });
    return;
  }
  useTts.setState({ index: i });
  const u = new SpeechSynthesisUtterance(it.title ? `${it.title}. ${it.text}` : it.text);
  const v = spanishVoice();
  if (v) u.voice = v;
  u.lang = v?.lang ?? 'es-MX';
  u.rate = s.rate;
  u.onend = () => my === token && setTimeout(() => speakAt(i + 1, my), 350);
  u.onerror = () => my === token && speakAt(i + 1, my);
  window.speechSynthesis.speak(u);
}

export function speak(items: TtsItem[], label: string) {
  if (!ttsSupported() || !items.length) return false;
  stopTts();
  const my = ++token;
  useTts.setState({ queue: items.filter((x) => x.text.trim()), index: 0, speaking: true, paused: false, label });
  speakAt(0, my);
  return true;
}

export function stopTts() {
  token++;
  if (ttsSupported()) window.speechSynthesis.cancel();
  useTts.setState({ speaking: false, paused: false, queue: [], index: 0 });
}

export function togglePauseTts() {
  if (!ttsSupported()) return;
  const s = useTts.getState();
  if (s.paused) window.speechSynthesis.resume();
  else window.speechSynthesis.pause();
  useTts.setState({ paused: !s.paused });
}

export function skipTts(delta: number) {
  const s = useTts.getState();
  const my = ++token;
  window.speechSynthesis.cancel();
  speakAt(Math.max(0, Math.min(s.queue.length - 1, s.index + delta)), my);
}

export function setTtsRate(rate: number) {
  useTts.setState({ rate });
}

/** Divide un texto largo en trozos cortos (algunas voces se cortan con textos muy largos). */
export function chunkText(text: string, max = 240): string[] {
  const parts = text.replace(/\s+/g, ' ').split(/(?<=[.!?;:])\s+/);
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length > max && cur) {
      out.push(cur.trim());
      cur = p;
    } else cur = `${cur} ${p}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
