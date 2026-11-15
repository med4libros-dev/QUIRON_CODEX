import { htmlToText } from './html';
import { idb } from './idb';
import { useNotes } from '../store/notes';

/**
 * Historial de una nota: cada tanto se guarda cómo estaba el texto, para poder volver
 * si borraste algo por error. Se guarda como objeto en IndexedDB (no entra en el respaldo
 * como texto gigante) y solo se conservan las últimas versiones.
 */
export interface NoteVersion {
  at: number;
  html: string;
}

const KEY = (noteId: string) => `hist:${noteId}`;
const MAX = 20;
/** Tiempo mínimo entre versiones: escribir seguido no crea una por cada tecla. */
const GAP_MS = 8 * 60_000;
/** Cambio grande: se guarda aunque no haya pasado el tiempo mínimo (p. ej. borraste medio párrafo). */
const BIG_DIFF = 400;

export const versionsOf = async (noteId: string): Promise<NoteVersion[]> =>
  (await idb.get<NoteVersion[]>('kv', KEY(noteId))) ?? [];

const write = (noteId: string, v: NoteVersion[]) => idb.set('kv', KEY(noteId), v.slice(-MAX));

/**
 * Registra el texto anterior si vale la pena conservarlo.
 * Se llama justo antes de guardar un cambio, con el HTML que estaba antes.
 */
export async function recordVersion(noteId: string, prevHtml: string): Promise<void> {
  if (!prevHtml.trim()) return;
  const v = await versionsOf(noteId);
  const last = v[v.length - 1];
  if (last) {
    if (last.html === prevHtml) return;
    const shrink = Math.abs(htmlToText(last.html).length - htmlToText(prevHtml).length);
    if (Date.now() - last.at < GAP_MS && shrink < BIG_DIFF) return;
  }
  try {
    await write(noteId, [...v, { at: Date.now(), html: prevHtml }]);
  } catch {
    /* sin espacio: el historial es opcional */
  }
}

/** Vuelve a una versión anterior; lo que había ahora se guarda primero para poder deshacerlo. */
export async function restoreVersion(noteId: string, at: number): Promise<boolean> {
  const v = await versionsOf(noteId);
  const target = v.find((x) => x.at === at);
  if (!target) return false;
  const note = useNotes.getState().notes.find((n) => n.id === noteId);
  const rest = v.filter((x) => x.at !== at);
  await write(noteId, note?.html.trim() ? [...rest, { at: Date.now(), html: note.html }] : rest);
  useNotes.getState().updateNote(noteId, { html: target.html });
  return true;
}

export const forgetHistory = (noteId: string) => idb.del('kv', KEY(noteId));
