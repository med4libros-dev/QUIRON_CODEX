import { downloadBlob } from './exportPdf';
import { freezePersistence } from './createStore';
import { idb } from './idb';

/**
 * Respaldo y restauración de TODO el progreso:
 *  - configuración, calendario, metas, Pomodoro (localStorage, claves «alq:*»)
 *  - biblioteca, resaltados, post-its, marcadores, notas y cuadernos (IndexedDB «kv»)
 *  - escritura a mano de las notas (IndexedDB «ink»)
 *  - los PDFs (IndexedDB «pdfs»)
 *
 * Dos formas:
 *  1) Archivo único (.json) para descargar y restaurar.
 *  2) Carpeta de respaldo automático (p. ej. en OneDrive): se actualiza sola y sirve
 *     para pasar el progreso entre la PC y la Surface.
 */

const DATA_FILE = 'quiron-codex-datos.json';
/** Nombre anterior (cuando la app se llamaba Alquimia): se sigue leyendo. */
const LEGACY_FILE = 'alquimia-datos.json';
const PDF_DIR = 'pdfs';
const HANDLE_KEY = 'backup:dir';
const LAST_KEY = 'alq:lastBackup';

interface BackupData {
  app: 'quiron-codex' | 'alquimia';
  version: 1;
  exportedAt: string;
  local: Record<string, string>;
  kv: Record<string, string>;
  ink: Record<string, unknown>;
  pdfs?: Record<string, { type: string; b64: string }>;
}

async function collect(): Promise<BackupData> {
  const local: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('alq:') && k !== LAST_KEY) local[k] = localStorage.getItem(k) ?? '';
  }
  const kv: Record<string, string> = {};
  for (const k of await idb.keys('kv')) {
    if (k === HANDLE_KEY) continue;
    const v = await idb.get<unknown>('kv', k);
    if (typeof v === 'string') kv[k] = v;
  }
  const ink: Record<string, unknown> = {};
  for (const k of await idb.keys('ink')) ink[k] = await idb.get('ink', k);
  return { app: 'quiron-codex', version: 1, exportedAt: new Date().toISOString(), local, kv, ink };
}

async function applyData(data: BackupData) {
  if (data?.app !== 'quiron-codex' && data?.app !== 'alquimia') throw new Error('El archivo no es un respaldo de Quirón Codex.');
  // Que la app abierta no vuelva a escribir su estado anterior encima del restaurado.
  freezePersistence();
  for (const [k, v] of Object.entries(data.local ?? {})) localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(data.kv ?? {})) await idb.set('kv', k, v);
  for (const [k, v] of Object.entries(data.ink ?? {})) await idb.set('ink', k, v);
}

const toB64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64 = (b64: string, type: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};

const markBackup = () => localStorage.setItem(LAST_KEY, new Date().toISOString());
export const lastBackup = () => localStorage.getItem(LAST_KEY);

/* ---------- 1) Archivo único ---------- */

export async function downloadBackup(includePdfs: boolean) {
  const data = await collect();
  if (includePdfs) {
    data.pdfs = {};
    for (const id of await idb.keys('pdfs')) {
      const blob = await idb.get<Blob>('pdfs', id);
      if (blob) data.pdfs[id] = { type: blob.type || 'application/pdf', b64: await toB64(blob) };
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `quiron-codex-respaldo-${stamp}.json`);
  markBackup();
}

export async function restoreFromFile(file: File) {
  const data = JSON.parse(await file.text()) as BackupData;
  await applyData(data);
  for (const [id, p] of Object.entries(data.pdfs ?? {})) await idb.set('pdfs', id, fromB64(p.b64, p.type));
}

/* ---------- 2) Carpeta de respaldo automático (File System Access API) ---------- */

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
};

export const folderSupported = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

let cachedDir: DirHandle | null | undefined;

export async function getFolder(): Promise<DirHandle | null> {
  if (cachedDir === undefined) cachedDir = ((await idb.get<DirHandle>('kv', HANDLE_KEY)) as DirHandle | undefined) ?? null;
  return cachedDir;
}

/** 'granted' | 'prompt' | 'denied' | 'none' */
export async function folderStatus(): Promise<PermissionState | 'none'> {
  const dir = await getFolder();
  if (!dir) return 'none';
  return (await dir.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
}

export async function chooseFolder(): Promise<string> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  const dir = await picker({ id: 'alquimia-respaldo', mode: 'readwrite' });
  await idb.set('kv', HANDLE_KEY, dir);
  cachedDir = dir;
  return dir.name;
}

/** Debe llamarse desde un clic: el navegador pide permiso de nuevo en cada sesión. */
export async function reconnectFolder(): Promise<boolean> {
  const dir = await getFolder();
  if (!dir) return false;
  return (await dir.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

export async function forgetFolder() {
  await idb.del('kv', HANDLE_KEY);
  cachedDir = null;
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

/** Guarda los datos (siempre) y los PDFs que aún no estén en la carpeta. */
export async function saveToFolder(): Promise<boolean> {
  const dir = await getFolder();
  if (!dir || (await folderStatus()) !== 'granted') return false;
  const data = await collect();
  await writeFile(dir, DATA_FILE, JSON.stringify(data));
  const pdfDir = await dir.getDirectoryHandle(PDF_DIR, { create: true });
  for (const id of await idb.keys('pdfs')) {
    try {
      await pdfDir.getFileHandle(`${id}.pdf`);
    } catch {
      const blob = await idb.get<Blob>('pdfs', id);
      if (blob) await writeFile(pdfDir, `${id}.pdf`, blob);
    }
  }
  markBackup();
  return true;
}

/** Trae el progreso guardado en la carpeta (por ejemplo, el que dejó la otra computadora). */
export async function loadFromFolder(): Promise<string> {
  const dir = await getFolder();
  if (!dir) throw new Error('Primero elige la carpeta de respaldo.');
  if ((await folderStatus()) !== 'granted' && !(await reconnectFolder())) throw new Error('Sin permiso para leer la carpeta.');
  // El más reciente entre el archivo nuevo y el de la versión anterior (otra computadora sin actualizar).
  const read = async (name: string) => {
    try {
      return await (await dir.getFileHandle(name)).getFile();
    } catch {
      return null;
    }
  };
  const [cur, old] = await Promise.all([read(DATA_FILE), read(LEGACY_FILE)]);
  const file = cur && old ? (old.lastModified > cur.lastModified ? old : cur) : cur ?? old;
  if (!file) throw new Error('La carpeta no tiene un respaldo todavía.');
  const data = JSON.parse(await file.text()) as BackupData;
  await applyData(data);
  try {
    const pdfDir = await dir.getDirectoryHandle(PDF_DIR);
    const have = new Set(await idb.keys('pdfs'));
    for await (const [name, handle] of (pdfDir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      const id = name.replace(/\.pdf$/i, '');
      if (handle.kind === 'file' && !have.has(id)) await idb.set('pdfs', id, await (handle as FileSystemFileHandle).getFile());
    }
  } catch {
    /* sin carpeta de PDFs */
  }
  return data.exportedAt;
}

/** Respaldo automático: cada 2 minutos y al ocultar/cerrar la pestaña, si hay carpeta con permiso. */
export function startAutoBackup() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await saveToFolder();
    } catch (e) {
      console.warn('Respaldo automático falló', e);
    } finally {
      busy = false;
    }
  };
  setInterval(() => void tick(), 120_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void tick();
  });
  return tick;
}
