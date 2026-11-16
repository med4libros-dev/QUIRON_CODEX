import { downloadBlob } from './exportPdf';
import { flushPersistence, freezePersistence } from './createStore';
import { changeCount } from './idb';
import { inkBusy } from './inkBusy';
import { useSettings } from '../store/settings';
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
/** Las grabaciones de clase comparten el almacén binario pero quedan fuera del respaldo: pesan mucho y se pueden rehacer. */
const AUDIO_PREFIX = 'audio:';
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
  flushPersistence();
  const local: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('alq:') && k !== LAST_KEY && k !== ENC_FLAG) local[k] = localStorage.getItem(k) ?? '';
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

/* ---------- Red de seguridad: deshacer la última restauración ---------- */

const SAFETY_KEY = 'safety:prerestore';
/** Se guarda como objeto (no como texto), así no entra en los respaldos. */
interface Snapshot {
  at: string;
  data: BackupData;
}

export async function preRestoreInfo(): Promise<string | null> {
  return ((await idb.get<Snapshot>('kv', SAFETY_KEY)) as Snapshot | undefined)?.at ?? null;
}

async function applyData(data: BackupData, opts: { snapshot?: boolean; replace?: boolean } = {}) {
  if (data?.app !== 'quiron-codex' && data?.app !== 'alquimia') throw new Error('El archivo no es un respaldo de Quirón Codex.');
  if (opts.snapshot !== false) {
    // Antes de pisar nada: copia de lo que hay ahora, para poder deshacer.
    flushPersistence();
    await new Promise((r) => setTimeout(r, 50));
    await idb.set('kv', SAFETY_KEY, { at: new Date().toISOString(), data: await collect() } satisfies Snapshot);
  }
  // Que la app abierta no vuelva a escribir su estado anterior encima del restaurado.
  freezePersistence();
  if (opts.replace) {
    // Deshacer = dejar todo exactamente como estaba: se quita lo que la restauración agregó.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('alq:') && k !== LAST_KEY && k !== ENC_FLAG && !(k in (data.local ?? {}))) localStorage.removeItem(k);
    }
    for (const k of await idb.keys('kv')) {
      if (k === HANDLE_KEY || k === SAFETY_KEY) continue;
      if (typeof (await idb.get<unknown>('kv', k)) === 'string' && !(k in (data.kv ?? {}))) await idb.del('kv', k);
    }
    for (const k of await idb.keys('ink')) if (!(k in (data.ink ?? {}))) await idb.del('ink', k);
  }
  for (const [k, v] of Object.entries(data.local ?? {})) localStorage.setItem(k, v);
  for (const [k, v] of Object.entries(data.kv ?? {})) await idb.set('kv', k, v);
  for (const [k, v] of Object.entries(data.ink ?? {})) await idb.set('ink', k, v);
}

/** Vuelve al estado de antes de la última restauración (los PDFs no se tocan). */
export async function undoLastRestore(): Promise<string> {
  const snap = (await idb.get<Snapshot>('kv', SAFETY_KEY)) as Snapshot | undefined;
  if (!snap) throw new Error('No hay ninguna restauración que deshacer.');
  await applyData(snap.data, { snapshot: false, replace: true });
  await idb.del('kv', SAFETY_KEY);
  return snap.at;
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

/* ---------- Cifrado (AES-GCM 256 + PBKDF2-SHA256) ---------- */

const ENC_FLAG = 'alq:backupEnc';
const ITER = 250_000;
/** La contraseña vive solo en memoria: se pide al abrir la app y nunca se guarda. */
let password: string | null = null;

interface EncryptedFile {
  app: 'quiron-codex';
  enc: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string;
  iv: string;
  data: string;
}

export const encryptionOn = () => localStorage.getItem(ENC_FLAG) === '1';
export const encryptionUnlocked = () => password !== null;
/** Activa el cifrado con esta contraseña (o lo desactiva con null). */
export function setEncryption(pw: string | null) {
  if (pw) {
    password = pw;
    localStorage.setItem(ENC_FLAG, '1');
  } else {
    password = null;
    localStorage.removeItem(ENC_FLAG);
  }
}
/** Desbloquea en esta sesión sin cambiar la configuración. */
export const unlockEncryption = (pw: string) => {
  password = pw;
};

const bytesToB64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function deriveKey(pw: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptText(plain: string, pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pw, salt, ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  const f: EncryptedFile = { app: 'quiron-codex', enc: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: bytesToB64(salt), iv: bytesToB64(iv), data: bytesToB64(ct) };
  return JSON.stringify(f);
}

export class PasswordNeeded extends Error {
  constructor(msg = 'Este respaldo está cifrado: escribe su contraseña.') {
    super(msg);
    this.name = 'PasswordNeeded';
  }
}

/** Devuelve el JSON en claro; si el archivo está cifrado usa `pw` (o la de la sesión). */
export async function decryptIfNeeded(text: string, pw?: string | null): Promise<string> {
  let parsed: Partial<EncryptedFile>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un respaldo válido.');
  }
  if (parsed.enc !== 1) return text;
  const usePw = pw ?? password;
  if (!usePw) throw new PasswordNeeded();
  try {
    const key = await deriveKey(usePw, b64ToBytes(parsed.salt!), parsed.iter ?? ITER);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(parsed.iv!) }, key, b64ToBytes(parsed.data!));
    return new TextDecoder().decode(plain);
  } catch {
    throw new PasswordNeeded('Contraseña incorrecta.');
  }
}

/** Serializa los datos, cifrados si el cifrado está activo. null = cifrado activo pero bloqueado. */
async function serialize(data: BackupData): Promise<string | null> {
  const json = JSON.stringify(data);
  if (!encryptionOn()) return json;
  if (!password) return null;
  return encryptText(json, password);
}

/* ---------- Avisos de falla del respaldo automático ---------- */
const ERR_KEY = 'qc:backupError';
export function backupError(): { msg: string; at: string } | null {
  try {
    return JSON.parse(localStorage.getItem(ERR_KEY) ?? 'null');
  } catch {
    return null;
  }
}
function setBackupError(msg: string | null) {
  const had = !!localStorage.getItem(ERR_KEY);
  if (msg) localStorage.setItem(ERR_KEY, JSON.stringify({ msg, at: new Date().toISOString() }));
  else localStorage.removeItem(ERR_KEY);
  if (had !== !!msg) window.dispatchEvent(new Event('qc:backup'));
}

const markBackup = () => localStorage.setItem(LAST_KEY, new Date().toISOString());
export const lastBackup = () => localStorage.getItem(LAST_KEY);

/* ---------- 1) Archivo único ---------- */

export async function downloadBackup(includePdfs: boolean) {
  const data = await collect();
  if (includePdfs) {
    data.pdfs = {};
    for (const id of await idb.keys('pdfs')) {
      if (id.startsWith(AUDIO_PREFIX)) continue;
      const blob = await idb.get<Blob>('pdfs', id);
      if (blob) data.pdfs[id] = { type: blob.type || 'application/pdf', b64: await toB64(blob) };
    }
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const out = await serialize(data);
  if (out === null) throw new PasswordNeeded('El cifrado está activo: desbloquéalo con tu contraseña antes de descargar.');
  downloadBlob(new Blob([out], { type: 'application/json' }), `quiron-codex-respaldo-${stamp}${encryptionOn() ? '-cifrado' : ''}.json`);
  markBackup();
}

export async function restoreFromFile(file: File, pw?: string) {
  const data = JSON.parse(await decryptIfNeeded(await file.text(), pw)) as BackupData;
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
  const out = await serialize(data);
  // Cifrado activo y bloqueado: no se escribe nada (ni en claro) hasta que lo desbloquees.
  if (out === null) return false;
  await writeFile(dir, DATA_FILE, out);
  // Verificación: se vuelve a leer lo escrito; si no coincide, se avisa (no se marca como respaldado).
  const back = await (await dir.getFileHandle(DATA_FILE)).getFile();
  const text = await back.text();
  if (text.length !== out.length) throw new Error('El respaldo en la carpeta quedó incompleto (¿OneDrive sin espacio o sin conexión?).');
  try {
    JSON.parse(text);
  } catch {
    throw new Error('El respaldo en la carpeta quedó dañado. Vuelve a intentarlo.');
  }
  const pdfDir = await dir.getDirectoryHandle(PDF_DIR, { create: true });
  for (const id of await idb.keys('pdfs')) {
    if (id.startsWith(AUDIO_PREFIX)) continue;
    try {
      await pdfDir.getFileHandle(`${id}.pdf`);
    } catch {
      const blob = await idb.get<Blob>('pdfs', id);
      if (blob) await writeFile(pdfDir, `${id}.pdf`, blob);
    }
  }
  markBackup();
  markFolderSeen(data.exportedAt);
  setBackupError(null);
  return true;
}

/** Trae el progreso guardado en la carpeta (por ejemplo, el que dejó la otra computadora). */
export async function loadFromFolder(pw?: string): Promise<string> {
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
  const data = JSON.parse(await decryptIfNeeded(await file.text(), pw)) as BackupData;
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
  let savedAt = -1;
  const tick = async () => {
    // Nada cambió desde el último respaldo, o el lápiz está escribiendo: no se hace nada.
    if (busy || changeCount() === savedAt || inkBusy()) return;
    busy = true;
    try {
      const before = changeCount();
      if (await saveToFolder()) {
        // El propio respaldo escribe (marca de fecha): se descuenta para no respaldar en bucle.
        savedAt = before === changeCount() ? before : changeCount();
        setBackupError(null);
      }
    } catch (e) {
      console.warn('Respaldo automático falló', e);
      setBackupError(e instanceof Error ? e.message : String(e));
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

/* ---------- Sincronización Surface ↔ PC ---------- */

const SEEN_KEY = 'alq:folderSeen';

export interface SyncInfo {
  /** Fecha del respaldo que hay en la carpeta (ISO) o null si no hay. */
  folderAt: string | null;
  /** true = la carpeta trae datos más nuevos que lo último que esta computadora dejó o trajo. */
  newer: boolean;
  /** true = aquí hay cambios sin respaldar (traer lo de la carpeta los reemplazaría). */
  localChanges: boolean;
}

/** Fecha del respaldo de la carpeta, sin tocar nada de lo que tienes aquí. */
export async function folderExportedAt(): Promise<string | null> {
  const dir = await getFolder();
  if (!dir || (await folderStatus()) !== 'granted') return null;
  for (const name of [DATA_FILE, LEGACY_FILE]) {
    try {
      const file = await (await dir.getFileHandle(name)).getFile();
      const head = await file.slice(0, 400).text();
      const m = /"exportedAt"\s*:\s*"([^"]+)"/.exec(head);
      if (m) return m[1];
      // Cifrado: no se puede leer la fecha, se usa la del archivo.
      return new Date(file.lastModified).toISOString();
    } catch {
      /* ese archivo no está */
    }
  }
  return null;
}

/**
 * ¿La otra computadora dejó algo más nuevo en la carpeta compartida?
 * Compara la fecha del respaldo de la carpeta con la última que esta computadora dejó o trajo.
 */
export async function syncCheck(): Promise<SyncInfo> {
  const folderAt = await folderExportedAt();
  const seen = localStorage.getItem(SEEN_KEY) ?? localStorage.getItem(LAST_KEY) ?? '';
  return {
    folderAt,
    newer: !!folderAt && (!seen || folderAt > seen),
    localChanges: changeCount() > 0,
  };
}

/** Marca esta fecha de carpeta como ya vista (se dejó o se trajo). */
export const markFolderSeen = (at: string) => localStorage.setItem(SEEN_KEY, at);

/** Trae lo más nuevo de la carpeta y lo marca como visto. */
export async function syncFromFolder(pw?: string): Promise<string> {
  const at = await loadFromFolder(pw);
  markFolderSeen(at);
  return at;
}

/**
 * Al abrir la app: si la carpeta trae algo más nuevo (lo dejó la otra computadora),
 * avisa con el evento «qc:sync» para que la interfaz te pregunte si quieres traerlo.
 */
const WATCH_EVERY = 120_000;

/**
 * Vigila la carpeta compartida mientras la app está abierta.
 *
 * Con «traer solo» apagado (de fábrica) nada más avisa, como siempre. Encendido, trae lo nuevo
 * sin preguntar **solo cuando no hay nada que perder aquí**: si esta computadora tiene cambios
 * sin respaldar, o el respaldo está cifrado y bloqueado, vuelve a preguntar. Nunca reemplaza
 * en silencio lo que escribiste.
 */
export function startSyncWatch(delay = 4000) {
  const check = async () => {
    try {
      const info = await syncCheck();
      if (!info.newer || !info.folderAt) return;
      const auto = useSettings.getState().syncAuto && !info.localChanges && !(encryptionOn() && !encryptionUnlocked());
      if (auto) {
        await syncFromFolder();
        window.dispatchEvent(new CustomEvent('qc:sync-auto', { detail: info }));
        return;
      }
      window.dispatchEvent(new CustomEvent('qc:sync', { detail: info }));
    } catch {
      /* sin carpeta o sin permiso: no se avisa nada */
    }
  };
  const first = setTimeout(() => void check(), delay);
  const timer = setInterval(() => void check(), WATCH_EVERY);
  watchStop = () => {
    clearTimeout(first);
    clearInterval(timer);
  };
  return check;
}

let watchStop: (() => void) | null = null;
export const stopSyncWatch = () => watchStop?.();
