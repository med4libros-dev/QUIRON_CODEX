import { callAi } from './ai';
import { idb } from './idb';
import { useNotes } from '../store/notes';

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
  // 32 kbps: una clase de una hora cabe en ~14 MB, que es lo que admite una petición con audio.
  rec = new MediaRecorder(stream, { audioBitsPerSecond: 32000 });
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

/** Límite práctico de una petición con audio en línea. Más largo que eso, no se manda. */
const MAX_BYTES = 16 * 1024 * 1024;

const SYSTEM_TRANSCRIBE =
  'Transcribes la grabación de una clase de medicina en español (México). Devuelve ÚNICAMENTE la transcripción, ' +
  'en párrafos, con marcas de tiempo [mm:ss] al principio de cada párrafo o cuando cambie de tema. ' +
  'No resumas, no corrijas los datos, no agregues nada que no se diga. Conserva las siglas tal como se pronuncian. ' +
  'Si un tramo es inaudible escribe [inaudible].';

/**
 * Transcribe la clase grabada. Solo con el motor Gemini: la API de Claude no recibe audio.
 * La transcripción se guarda en la nota (`classText`) y entra en la búsqueda global.
 */
export async function transcribeClass(noteId: string): Promise<string> {
  const blob = await loadRecording(noteId);
  if (!blob) throw new Error('Esta nota no tiene ninguna clase grabada.');
  if (blob.size > MAX_BYTES) {
    throw new Error(`La grabación pesa ${Math.round(blob.size / 1024 / 1024)} MB y el límite para transcribir es ${MAX_BYTES / 1024 / 1024} MB. Graba la clase en partes.`);
  }
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('No se pudo leer la grabación'));
    r.readAsDataURL(blob);
  });
  const raw = await callAi({ system: SYSTEM_TRANSCRIBE, user: 'Transcribe esta clase.', audio: [dataUrl], maxTokens: 8000 });
  const text = raw.replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
  useNotes.getState().updateNote(noteId, { classText: text, classTextAt: Date.now() });
  return text;
}
export const deleteRecording = (noteId: string) => idb.del('pdfs', audioKey(noteId));

/** mm:ss a partir de segundos. */
export const clock = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
