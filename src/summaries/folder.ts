import { idb } from '../lib/idb';
import { openPdf } from '../lib/pdf';
import { TOPICS } from '../internship/curriculum';
import { matchTopic, specialtyHint, titleFromPage } from '../lib/summaryTitle';
import { useSummaries, type Summary } from './store';

/**
 * La carpeta de resúmenes, leída en su sitio.
 *
 * No se copia nada: la app se queda con el permiso de la carpeta y abre cada PDF desde tu disco
 * cuando lo pides. Al indexar solo lee **la primera página** de cada archivo, que es donde estos
 * resúmenes traen impreso el tema. Todo ocurre en tu equipo: no se manda nada a ninguna parte.
 */

type DirHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  queryPermission?: (d: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'read' }) => Promise<PermissionState>;
};

const DIR_KEY = 'summaries:dir';
/** Carpetas que no son de resúmenes y solo harían perder tiempo. */
const SKIP = /^(\.|__macosx|node_modules$|\$recycle)/i;

export const folderSupported = () => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

/** Id del documento con el que un resumen entra al lector. El prefijo lo distingue de tus PDFs. */
export const summaryDocId = (path: string) => `sum:${path}`;
export const isSummaryDoc = (docId: string) => docId.startsWith('sum:');
export const summaryPath = (docId: string) => docId.slice(4);

/** La carpeta de esta sesión. Evita ir a IndexedDB por cada página y sirve de respaldo
 *  cuando el navegador se niega a guardar el permiso. */
let open_: DirHandle | undefined;

async function handle(): Promise<DirHandle | undefined> {
  return open_ ?? idb.get<DirHandle>('kv', DIR_KEY);
}

/** ¿Hay carpeta recordada? Se consulta sin pedir permiso, para poder ofrecer reabrirla. */
export async function rememberedFolder(): Promise<string | null> {
  const dir = await handle();
  return dir && typeof dir === 'object' && 'name' in dir ? dir.name : null;
}

/** Pide permiso de lectura sobre la carpeta recordada. Debe salir de un clic del usuario. */
async function ensurePermission(dir: DirHandle): Promise<void> {
  const perm = (await dir.queryPermission?.({ mode: 'read' })) ?? 'granted';
  if (perm === 'granted') return;
  if ((await dir.requestPermission?.({ mode: 'read' })) !== 'granted') {
    throw new Error('No diste permiso para leer la carpeta.');
  }
}

/** Elige la carpeta (selector del sistema) y la recuerda para las próximas veces. */
export async function pickFolder(): Promise<DirHandle> {
  const picker = (window as unknown as { showDirectoryPicker: (o?: object) => Promise<DirHandle> }).showDirectoryPicker;
  const dir = await picker({ id: 'quiron-resumenes', mode: 'read' });
  open_ = dir;
  try {
    await idb.set('kv', DIR_KEY, dir);
  } catch {
    /* el navegador no guarda el permiso: habrá que elegirla de nuevo la próxima vez */
  }
  return dir;
}

/** Todos los PDFs de la carpeta, con su ruta relativa. */
async function listPdfs(dir: DirHandle, prefix = '', out: { path: string; file: FileSystemFileHandle }[] = [], depth = 0) {
  if (depth > 6) return out;
  const it = dir.values?.();
  if (!it) return out;
  for await (const entry of it) {
    if (SKIP.test(entry.name)) continue;
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'directory') await listPdfs(entry as DirHandle, path, out, depth + 1);
    else if (/\.pdf$/i.test(entry.name)) out.push({ path, file: entry as FileSystemFileHandle });
  }
  return out;
}

/** El archivo de un resumen, buscado por su ruta dentro de la carpeta. */
export async function fileOf(path: string): Promise<File> {
  const dir = await handle();
  if (!dir) throw new Error('No hay carpeta de resúmenes elegida.');
  await ensurePermission(dir);
  const parts = path.split('/');
  let cur: DirHandle = dir;
  for (const part of parts.slice(0, -1)) cur = (await cur.getDirectoryHandle(part)) as DirHandle;
  const fh = await cur.getFileHandle(parts[parts.length - 1]);
  return fh.getFile();
}

/** Título y número de páginas de un PDF, leyendo solo su primera página. */
async function readHead(file: File): Promise<{ title: string; pages: number }> {
  const { promise, destroy } = openPdf(await file.arrayBuffer());
  try {
    const doc = await promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const text = (content.items as { str?: string; hasEOL?: boolean }[])
      .map((i) => (i.str ?? '') + (i.hasEOL ? '\n' : ' '))
      .join('');
    return { title: titleFromPage(text), pages: doc.numPages };
  } finally {
    destroy();
  }
}

export interface ScanProgress {
  done: number;
  total: number;
  name: string;
}

/**
 * Recorre la carpeta y arma el índice.
 *
 * Lo ya indexado que no cambió de tamaño no se vuelve a leer, así que la primera pasada tarda
 * (hay que abrir cada PDF una vez) y las siguientes son casi instantáneas.
 */
export async function scanFolder(dir: DirHandle, onProgress?: (p: ScanProgress) => void, signal?: { stop: boolean }): Promise<void> {
  await ensurePermission(dir);
  const files = await listPdfs(dir);
  const before = new Map(useSummaries.getState().summaries.map((s) => [s.path, s]));
  const out: Summary[] = [];
  let done = 0;

  for (const { path, file: fh } of files) {
    if (signal?.stop) break;
    const file = await fh.getFile();
    onProgress?.({ done, total: files.length, name: file.name });
    const old = before.get(path);
    if (old && old.size === file.size && old.title) {
      out.push(old); // sin cambios: se conserva el tema que ya tenía (incluido el que pusiste tú)
    } else {
      let title = '';
      let pages = 0;
      try {
        ({ title, pages } = await readHead(file));
      } catch {
        /* PDF ilegible o protegido: entra sin título y lo asignas a mano */
      }
      const m = matchTopic(title, TOPICS, specialtyHint(path));
      out.push({
        path,
        name: file.name,
        size: file.size,
        title,
        topicId: m.topic?.id ?? null,
        level: m.level,
        score: m.score,
        pages,
        indexedAt: Date.now(),
      });
    }
    done++;
    onProgress?.({ done, total: files.length, name: file.name });
  }

  const seen = new Set(out.map((s) => s.path));
  const missing = [...before.keys()].filter((p) => !seen.has(p));
  useSummaries.getState().setIndex(dir.name, out, missing);
}

/** Vuelve a recorrer la carpeta recordada. */
export async function rescan(onProgress?: (p: ScanProgress) => void, signal?: { stop: boolean }): Promise<void> {
  const dir = await handle();
  if (!dir) throw new Error('No hay carpeta de resúmenes elegida.');
  await scanFolder(dir, onProgress, signal);
}

/**
 * Abre un resumen en el lector de siempre: tinta, resaltados, perlas y Ctrl+F funcionan igual
 * que con cualquier PDF tuyo. El archivo sigue en tu carpeta; aquí solo se registra la ficha
 * para que las anotaciones tengan dónde guardarse.
 */
export async function openSummary(s: { path: string; name: string; size: number; pages: number; title: string }): Promise<void> {
  const { useLibrary } = await import('../store/library');
  const { useSettings } = await import('../store/settings');
  const id = summaryDocId(s.path);
  useLibrary.getState().addExternalDoc({
    id,
    name: s.title || s.name.replace(/\.pdf$/i, ''),
    size: s.size,
    subjectId: null,
    addedAt: Date.now(),
    lastPage: 1,
    pageCount: s.pages,
  });
  useSettings.getState().setActiveDoc(id);
  useSettings.getState().setView('study');
}
