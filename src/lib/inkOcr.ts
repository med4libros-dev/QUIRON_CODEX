import { callAi } from './ai';
import { idb } from './idb';
import { renderInkPage } from './ink';
import { loadInkImages } from './inkImages';
import { useNotes } from '../store/notes';
import { useSettings } from '../store/settings';
import type { Stroke } from '../types';

/**
 * Reconocimiento de tu letra: la hoja del lienzo se dibuja a imagen y se le pide al motor de IA
 * (Claude o Gemini, el que tengas configurado) que la transcriba. El texto se guarda en la nota
 * (`inkText`), así Ctrl+K encuentra lo que escribiste a mano y puedes volcarlo al editor.
 *
 * Solo sale de este equipo la imagen de tu propia hoja, y solo cuando tú lo pides.
 */

const SYSTEM =
  'Transcribes apuntes médicos manuscritos en español (estudiante de medicina en México). ' +
  'Devuelve ÚNICAMENTE la transcripción en texto plano, respetando los saltos de línea, las listas y las flechas (->). ' +
  'No resumas, no corrijas, no agregues nada que no esté escrito. Conserva abreviaturas y siglas tal como aparecen. ' +
  'Si una palabra es ilegible escribe [?]. Si la hoja está vacía responde exactamente: (vacía)';

/**
 * El glosario del usuario (sus abreviaturas) se añade al final del prompt: así deja de
 * equivocarse siempre en las mismas, sin cambiar lo que escribió.
 */
function systemWithGlossary(): string {
  const g = useSettings
    .getState()
    .inkGlossary.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 120);
  if (!g.length) return SYSTEM;
  return `${SYSTEM}\n\nAbreviaturas que usa esta persona (respétalas tal cual si aparecen, no las expandas):\n${g.join('\n')}`;
}

const WIDTH = 1200;

/** Dibuja una hoja de la nota a imagen PNG (fondo blanco), lista para enviar al motor de IA. */
export async function renderNoteSheet(noteId: string, page: number): Promise<string> {
  const [strokes, imgs] = await Promise.all([
    idb.get<Stroke[]>('ink', noteId).then((s) => s ?? []),
    loadInkImages(noteId),
  ]);
  const mine = strokes.filter((s) => s.page === page);
  const pics = imgs.filter((i) => i.page === page);
  if (!mine.length && !pics.length) return '';
  return renderInkPage(mine, WIDTH, pics);
}

/** ¿Qué hojas de esta nota tienen algo escrito o pegado? */
export async function sheetsWithContent(noteId: string): Promise<number[]> {
  const [strokes, imgs] = await Promise.all([
    idb.get<Stroke[]>('ink', noteId).then((s) => s ?? []),
    loadInkImages(noteId),
  ]);
  const set = new Set<number>();
  for (const s of strokes) set.add(s.page);
  for (const i of imgs) set.add(i.page);
  return [...set].sort((a, b) => a - b);
}

const clean = (t: string) => t.replace(/^```[a-z]*\s*|\s*```$/g, '').replace(/^\(vacía\)$/i, '').trim();

/** Transcribe una sola hoja. Devuelve '' si la hoja está vacía. */
export async function recognizeSheet(noteId: string, page: number): Promise<string> {
  const img = await renderNoteSheet(noteId, page);
  if (!img) return '';
  const raw = await callAi({
    system: systemWithGlossary(),
    user: 'Transcribe esta hoja de apuntes.',
    images: [img],
    maxTokens: 2000,
  });
  return clean(raw);
}

export interface OcrProgress {
  (done: number, total: number): void;
}

/**
 * Transcribe toda la nota y guarda el resultado en `inkText` (lo que usa el buscador).
 * Devuelve el texto completo, con «— hoja N —» entre hojas.
 */
export async function recognizeNote(noteId: string, onProgress?: OcrProgress): Promise<string> {
  const pages = await sheetsWithContent(noteId);
  if (!pages.length) throw new Error('Esta nota no tiene nada escrito a mano todavía.');
  const parts: string[] = [];
  for (let i = 0; i < pages.length; i++) {
    onProgress?.(i, pages.length);
    const text = await recognizeSheet(noteId, pages[i]);
    if (text) parts.push(pages.length > 1 ? `— hoja ${pages[i] + 1} —\n${text}` : text);
  }
  onProgress?.(pages.length, pages.length);
  const full = parts.join('\n\n');
  useNotes.getState().updateNote(noteId, { inkText: full, inkTextAt: Date.now() });
  return full;
}

/**
 * Reconoce varias notas seguidas (un cuaderno completo). Avisa del avance por nota y
 * devuelve cuántas quedaron transcritas y cuántas fallaron.
 */
export async function recognizeNotes(
  noteIds: string[],
  onProgress?: (done: number, total: number, title: string) => void,
): Promise<{ done: number; failed: { title: string; error: string }[] }> {
  const notes = useNotes.getState().notes;
  let done = 0;
  const failed: { title: string; error: string }[] = [];
  for (let i = 0; i < noteIds.length; i++) {
    const note = notes.find((n) => n.id === noteIds[i]);
    if (!note) continue;
    onProgress?.(i, noteIds.length, note.title || 'Nota sin título');
    try {
      await recognizeNote(note.id);
      done++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Una nota sin nada escrito no es un fallo: simplemente no hay letra que leer.
      if (!/no tiene nada escrito/i.test(msg)) failed.push({ title: note.title || 'Nota sin título', error: msg });
    }
  }
  onProgress?.(noteIds.length, noteIds.length, '');
  return { done, failed };
}

/** ¿La transcripción quedó vieja respecto a lo último que escribiste? */
export const ocrStale = (note: { inkTextAt?: number; updatedAt: number }) =>
  !!note.inkTextAt && note.updatedAt > note.inkTextAt + 60_000;
