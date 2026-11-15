/**
 * Dictado por voz: usa el reconocimiento de voz del propio sistema/navegador (en Windows,
 * Edge WebView lo trae). No pasa por ningún servidor nuestro. Si el equipo no lo trae,
 * `dictationSupported()` devuelve false y la app lo dice en lugar de fallar.
 */
interface SpeechResultList {
  length: number;
  item: (i: number) => { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechEvent {
  resultIndex: number;
  results: SpeechResultList;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type Ctor = new () => Recognition;

const ctor = (): Ctor | null => {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const dictationSupported = () => !!ctor();

export interface DictationHandlers {
  /** Texto ya confirmado (listo para escribir en la nota). */
  onText: (text: string) => void;
  /** Lo que se está oyendo ahora mismo, para mostrarlo en gris. */
  onPartial?: (text: string) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}

const MSG: Record<string, string> = {
  'not-allowed': 'Windows no dio permiso del micrófono. Actívalo en Configuración → Privacidad → Micrófono.',
  'service-not-allowed': 'El sistema no permitió el reconocimiento de voz en esta app.',
  'no-speech': 'No se escuchó nada. Acércate al micrófono e intenta de nuevo.',
  network: 'El reconocimiento de voz necesita conexión y no la hubo.',
  'audio-capture': 'No se encontró micrófono.',
};

/** Arranca el dictado. Devuelve la función para detenerlo. */
export function startDictation({ onText, onPartial, onError, onEnd }: DictationHandlers): () => void {
  const C = ctor();
  if (!C) {
    onError?.('Este equipo no trae reconocimiento de voz.');
    return () => undefined;
  }
  const rec = new C();
  rec.lang = 'es-MX';
  rec.continuous = true;
  rec.interimResults = true;
  let stopped = false;
  rec.onresult = (e) => {
    let partial = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results.item(i);
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) onText(t.trim());
      else partial += t;
    }
    onPartial?.(partial.trim());
  };
  rec.onerror = (e) => onError?.(MSG[e.error ?? ''] ?? `El dictado se detuvo (${e.error ?? 'error'}).`);
  rec.onend = () => {
    // El sistema corta cada cierto tiempo: mientras no lo detengas tú, se reanuda.
    if (stopped) return onEnd?.();
    try {
      rec.start();
    } catch {
      onEnd?.();
    }
  };
  try {
    rec.start();
  } catch {
    onError?.('No se pudo iniciar el dictado.');
  }
  return () => {
    stopped = true;
    try {
      rec.stop();
    } catch {
      /* ya estaba detenido */
    }
  };
}
