import { createStore } from '../../lib/createStore';
import { idb } from '../../lib/idb';

/** Formatos de audio admitidos (Chromium/Edge reproducen los cuatro). */
export const AUDIO_EXT = /\.(mp3|wav|flac|ogg|oga|m4a|aac|opus)$/i;
const SHOWN_EXT = ['.mp3', '.wav', '.flac', '.ogg'];
export const ACCEPTED_LABEL = SHOWN_EXT.join(' ');

export interface Track {
  id: string;
  /** Ruta relativa dentro de la carpeta (para ordenar y mostrar). */
  path: string;
  name: string;
  url: string;
  size: number;
}

type DirHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  queryPermission?: (d: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'read' }) => Promise<PermissionState>;
};

const DIR_KEY = 'music:dir';

export interface MusicState {
  tracks: Track[];
  folder: string;
  index: number;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: boolean;
  expanded: boolean;
  /** Hay una carpeta recordada de la sesión anterior (requiere tocar para dar permiso). */
  canReopen: string | null;
  error: string | null;
}

/**
 * Un solo <audio> para toda la app: la música sigue al cambiar de vista.
 * Los archivos nunca se copian: se leen de tu carpeta con URL.createObjectURL().
 */
let audio: HTMLAudioElement | null = null;
const el = () => {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'metadata';
  audio.addEventListener('timeupdate', () => useMusic.setState({ time: audio!.currentTime }));
  audio.addEventListener('durationchange', () => useMusic.setState({ duration: Number.isFinite(audio!.duration) ? audio!.duration : 0 }));
  audio.addEventListener('play', () => useMusic.setState({ playing: true }));
  audio.addEventListener('pause', () => useMusic.setState({ playing: false }));
  audio.addEventListener('ended', () => {
    const s = useMusic.getState();
    if (s.repeat && s.tracks.length === 1) void playAt(s.index);
    else if (s.repeat || s.shuffle || s.index < s.tracks.length - 1) next();
  });
  audio.addEventListener('error', () => {
    const s = useMusic.getState();
    const t = s.tracks[s.index];
    useMusic.setState({ error: t ? `No se pudo reproducir «${t.name}» (formato no compatible).` : null, playing: false });
    // Salta al siguiente para no quedarse trabado en un archivo dañado.
    if (s.tracks.length > 1) setTimeout(next, 600);
  });
  return audio;
};

export const useMusic = createStore<MusicState>(
  () => ({
    tracks: [],
    folder: '',
    index: 0,
    playing: false,
    time: 0,
    duration: 0,
    volume: 0.7,
    muted: false,
    shuffle: false,
    repeat: false,
    expanded: false,
    canReopen: null,
    error: null,
  }),
  // Solo preferencias: la lista vive en memoria y se reconstruye desde la carpeta.
  { key: 'alq:music', storage: 'local', pick: ({ volume, muted, shuffle, repeat }) => ({ volume, muted, shuffle, repeat }) },
);

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
const cleanName = (file: string) => file.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

/** Reemplaza la lista: libera las URLs anteriores para no fugar memoria. */
function setTracks(files: { file: File; path: string }[], folder: string) {
  const prev = useMusic.getState().tracks;
  const a = el();
  a.pause();
  a.removeAttribute('src');
  prev.forEach((t) => URL.revokeObjectURL(t.url));
  const tracks = files
    .filter((f) => AUDIO_EXT.test(f.file.name))
    .sort((x, y) => collator.compare(x.path, y.path))
    .map((f, i) => ({ id: `${i}:${f.path}`, path: f.path, name: cleanName(f.file.name), url: URL.createObjectURL(f.file), size: f.file.size }));
  useMusic.setState({ tracks, folder, index: 0, time: 0, duration: 0, playing: false, error: tracks.length ? null : 'La carpeta no tiene audio (.mp3, .wav, .flac u .ogg).', canReopen: null });
  if (tracks.length) {
    a.src = tracks[0].url;
    applyVolume();
    updateSession();
  }
  return tracks.length;
}

/** Archivos de un <input webkitdirectory>. */
export function loadFromInput(list: FileList | File[]) {
  const files = Array.from(list).map((file) => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }));
  const folder = files[0]?.path.split('/')[0] ?? 'Música';
  return setTracks(files, folder);
}

async function walk(dir: DirHandle, prefix: string, out: { file: File; path: string }[], depth: number) {
  if (depth > 5 || !dir.values) return;
  for await (const h of dir.values()) {
    if (out.length > 2000) return;
    if (h.kind === 'file' && AUDIO_EXT.test(h.name)) out.push({ file: await (h as FileSystemFileHandle).getFile(), path: `${prefix}${h.name}` });
    else if (h.kind === 'directory') await walk(h as DirHandle, `${prefix}${h.name}/`, out, depth + 1);
  }
}

export const canPickDirectory = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

/** Selector de carpeta del sistema (Edge/Chrome). Recuerda la carpeta para la próxima vez. */
export async function pickDirectory(): Promise<number> {
  const picker = (window as unknown as { showDirectoryPicker: (o?: object) => Promise<DirHandle> }).showDirectoryPicker;
  const dir = await picker({ id: 'alquimia-music', mode: 'read' });
  const n = await loadDir(dir);
  try {
    await idb.set('kv', DIR_KEY, dir);
  } catch {
    /* el navegador no guarda permisos: no pasa nada */
  }
  return n;
}

async function loadDir(dir: DirHandle) {
  const out: { file: File; path: string }[] = [];
  await walk(dir, '', out, 0);
  return setTracks(out, dir.name);
}

/** ¿Hay una carpeta recordada? (Se consulta sin pedir permiso.) */
export async function checkRemembered() {
  try {
    const dir = await idb.get<DirHandle>('kv', DIR_KEY);
    if (dir && typeof dir === 'object' && 'name' in dir) useMusic.setState({ canReopen: dir.name });
  } catch {
    /* sin carpeta guardada */
  }
}

/** Reabre la carpeta recordada (debe llamarse desde un clic: el navegador pide permiso). */
export async function reopenRemembered(): Promise<number> {
  const dir = await idb.get<DirHandle>('kv', DIR_KEY);
  if (!dir) return 0;
  const perm = (await dir.queryPermission?.({ mode: 'read' })) ?? 'granted';
  if (perm !== 'granted' && (await dir.requestPermission?.({ mode: 'read' })) !== 'granted') throw new Error('Permiso denegado');
  return loadDir(dir);
}

export function applyVolume() {
  const s = useMusic.getState();
  const a = el();
  a.volume = s.volume;
  a.muted = s.muted;
}

export async function playAt(i: number) {
  const s = useMusic.getState();
  const t = s.tracks[i];
  if (!t) return;
  const a = el();
  if (a.src !== t.url) a.src = t.url;
  useMusic.setState({ index: i, time: 0, error: null });
  applyVolume();
  updateSession();
  try {
    await a.play();
  } catch (e) {
    if ((e as { name?: string }).name !== 'AbortError') useMusic.setState({ playing: false });
  }
}

export function toggle() {
  const s = useMusic.getState();
  if (!s.tracks.length) return;
  const a = el();
  if (!a.src) a.src = s.tracks[s.index].url;
  if (a.paused) void playAt(s.index);
  else a.pause();
}

export function next() {
  const s = useMusic.getState();
  if (!s.tracks.length) return;
  let i = s.shuffle && s.tracks.length > 1 ? Math.floor(Math.random() * (s.tracks.length - 1)) : s.index + 1;
  if (s.shuffle && i >= s.index) i += 1; // nunca la misma
  void playAt(i % s.tracks.length);
}

export function prev() {
  const s = useMusic.getState();
  if (!s.tracks.length) return;
  const a = el();
  // Como en cualquier reproductor: si ya avanzó, «anterior» reinicia la canción.
  if (a.currentTime > 3) {
    a.currentTime = 0;
    return;
  }
  void playAt((s.index - 1 + s.tracks.length) % s.tracks.length);
}

export function seek(t: number) {
  const a = el();
  if (Number.isFinite(t)) a.currentTime = Math.max(0, Math.min(t, a.duration || t));
  useMusic.setState({ time: a.currentTime });
}

export function setVolume(v: number) {
  useMusic.setState({ volume: Math.max(0, Math.min(1, v)), muted: false });
  applyVolume();
}
export function toggleMute() {
  useMusic.setState((s) => ({ muted: !s.muted }));
  applyVolume();
}

/** Teclas multimedia del teclado de la Surface y controles del sistema. */
function updateSession() {
  const ms = navigator.mediaSession;
  if (!ms) return;
  const s = useMusic.getState();
  const t = s.tracks[s.index];
  try {
    if (t && typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: t.name, artist: s.folder, album: 'Quirón Codex' });
    ms.setActionHandler('play', toggle);
    ms.setActionHandler('pause', toggle);
    ms.setActionHandler('previoustrack', prev);
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('seekto', (d) => d.seekTime !== undefined && seek(d.seekTime));
  } catch {
    /* acción no soportada */
  }
}

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
