import { idb } from './idb';

/**
 * Grabar la clase y amarrarla a lo que escribes: cada trazo guarda el segundo en que lo hiciste,
 * así tocar un apunte salta al momento en que el profesor lo estaba explicando.
 *
 * Es para clases y seminarios. **No** para el pase de visita ni para nada con un paciente
 * delante: la app lo dice en pantalla antes de empezar.
 *
 * El audio se queda en este equipo (almacén binario de IndexedDB, con prefijo `audio:`) y
 * queda fuera de los respaldos: pesa mucho y siempre se puede volver a grabar.
 */

export const audioKey = (noteId: string) => `audio:${noteId}`;

export interface ClassRecording {
  blob: Blob;
  /** Duración en segundos, medida al parar. */
  seconds: number;
  recordedAt: number;
}

let rec: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
let activeNote: string | null = null;

/** ¿Se está grabando ahora mismo, y para qué nota? */
export const recordingNote = () => activeNote;
/** Milisegundos desde que empezó la grabación, o null si no hay ninguna. */
export const recordingElapsed = () => (activeNote ? Date.now() - startedAt : null);

export function audioSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function startRecording(noteId: string): Promise<void> {
  if (activeNote) throw new Error('Ya hay una grabación en curso.');
  if (!audioSupported()) throw new Error('Este equipo no permite grabar audio desde la app.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.start(5000);
  startedAt = Date.now();
  activeNote = noteId;
}

/** Para la grabación y la guarda. Devuelve lo grabado, o null si no salió nada. */
export async function stopRecording(): Promise<ClassRecording | null> {
  const r = rec;
  const noteId = activeNote;
  if (!r || !noteId) return null;
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  await new Promise<void>((res) => {
    r.onstop = () => res();
    r.stop();
  });
  r.stream.getTracks().forEach((t) => t.stop());
  rec = null;
  activeNote = null;
  if (!chunks.length) return null;
  const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
  chunks = [];
  const out: ClassRecording = { blob, seconds, recordedAt: Date.now() - seconds * 1000 };
  await idb.set('pdfs', audioKey(noteId), blob);
  return out;
}

export const loadRecording = (noteId: string) => idb.get<Blob>('pdfs', audioKey(noteId));
export const deleteRecording = (noteId: string) => idb.del('pdfs', audioKey(noteId));

/** mm:ss a partir de segundos. */
export const clock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
