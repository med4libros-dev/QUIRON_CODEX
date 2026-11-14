import { idb } from './idb';
import { extractAllPages } from './pdf';

/**
 * Índice de texto por página de cada PDF. Se guarda en IndexedDB como objeto (no como texto),
 * así no infla los respaldos: si se pierde, se reconstruye desde el PDF.
 */
const key = (docId: string) => `search:${docId}`;
const mem = new Map<string, string[]>();

export async function pagesOf(docId: string, onProgress?: (d: number, t: number) => void): Promise<string[]> {
  const hit = mem.get(docId);
  if (hit) return hit;
  const stored = await idb.get<{ pages: string[] }>('kv', key(docId));
  if (stored && Array.isArray(stored.pages)) {
    mem.set(docId, stored.pages);
    return stored.pages;
  }
  const pages = await extractAllPages(docId, 2000, onProgress);
  mem.set(docId, pages);
  try {
    await idb.set('kv', key(docId), { pages });
  } catch {
    /* sin espacio: queda en memoria */
  }
  return pages;
}

export function forgetIndex(docId: string) {
  mem.delete(docId);
  void idb.del('kv', key(docId));
}
