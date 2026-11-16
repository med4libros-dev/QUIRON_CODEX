import { inkIsDown } from './inkBusy';
import { ocrStale, recognizeNote, sheetsWithContent } from './inkOcr';
import { useNotes } from '../store/notes';
import { useSettings } from '../store/settings';
import type { Note } from '../types';

/**
 * Reconocimiento en segundo plano: lo que escribes a mano entra solo al buscador, sin que
 * tengas que pedirlo hoja por hoja.
 *
 * Reglas, para que nunca estorbe ni gaste de más:
 *  - solo con el motor de IA configurado y el ajuste encendido (apagado de fábrica);
 *  - una nota a la vez, y nunca mientras el lápiz está escribiendo;
 *  - solo notas en reposo (nada escrito en los últimos 3 min), así no transcribe a medias;
 *  - una nota que falla espera media hora antes de reintentarse, y a la tercera se deja en paz.
 *
 * Sale de este equipo únicamente la imagen de tus hojas, igual que al pedirlo a mano.
 */

const EVERY = 90_000;
const QUIET = 180_000;
const BACKOFF = 1_800_000;
const MAX_TRIES = 3;

const tries = new Map<string, { n: number; next: number }>();
let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

/** Notas con tinta cuya transcripción falta o quedó vieja, más antigua primero. */
function candidates(notes: Note[], now: number): Note[] {
  return notes
    .filter((n) => {
      if (n.updatedAt > now - QUIET) return false;
      if (n.inkText !== undefined && !ocrStale(n)) return false;
      const t = tries.get(n.id);
      if (t && (t.n >= MAX_TRIES || now < t.next)) return false;
      return true;
    })
    .sort((a, b) => a.updatedAt - b.updatedAt);
}

async function tick(): Promise<void> {
  if (running || inkIsDown()) return;
  const st = useSettings.getState();
  if (!st.inkOcrAuto || !st.apiKey) return;
  const now = Date.now();
  running = true;
  try {
    for (const note of candidates(useNotes.getState().notes, now)) {
      // Una nota sin tinta no se reintenta: se marca como vista y se pasa a la siguiente.
      if (!(await sheetsWithContent(note.id)).length) {
        tries.set(note.id, { n: MAX_TRIES, next: 0 });
        continue;
      }
      try {
        await recognizeNote(note.id);
        tries.delete(note.id);
      } catch {
        const t = tries.get(note.id);
        tries.set(note.id, { n: (t?.n ?? 0) + 1, next: Date.now() + BACKOFF });
      }
      return; // una por vuelta
    }
  } finally {
    running = false;
  }
}

export function startInkOcrAuto(): () => void {
  clearInterval(timer);
  timer = setInterval(() => void tick(), EVERY);
  return () => clearInterval(timer);
}

/** Para las pruebas y para «reintentar ahora» desde Preferencias. */
export const runInkOcrAutoOnce = tick;
export const resetInkOcrAuto = () => tries.clear();
