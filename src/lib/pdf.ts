import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { idb } from './idb';
import type { NRect } from '../types';

// El parseo y render pesado ocurre en un Web Worker: la UI no se congela con PDFs grandes.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type { PDFDocumentProxy, PDFPageProxy };
export const TextLayer = pdfjs.TextLayer;

export function openPdf(data: ArrayBuffer) {
  const task = pdfjs.getDocument({ data });
  return {
    promise: task.promise,
    destroy: () => {
      void task.destroy();
    },
  };
}

export async function loadPdfData(docId: string): Promise<ArrayBuffer> {
  const blob = await idb.get<Blob>('pdfs', docId);
  if (!blob) throw new Error('No se encontró el archivo en este navegador.');
  return blob.arrayBuffer();
}

interface TextLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}
const isText = (it: unknown): it is TextLike => typeof it === 'object' && it !== null && 'str' in it;

/** Texto de la capa de texto del PDF que cae dentro de un rectángulo normalizado. */
export async function extractTextInRect(page: PDFPageProxy, r: NRect): Promise<string> {
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const parts: { x: number; y: number; s: string }[] = [];
  for (const item of content.items) {
    if (!isText(item) || !item.str.trim()) continue;
    const [x, y] = vp.convertToViewportPoint(item.transform[4], item.transform[5]) as number[];
    const h = item.height || Math.abs(item.transform[3]) || 10;
    const nx = x / vp.width;
    const nxEnd = (x + item.width) / vp.width;
    const nyMid = (y - h * 0.35) / vp.height;
    if (nyMid >= r.y && nyMid <= r.y + r.h && nxEnd >= r.x && nx <= r.x + r.w) parts.push({ x: nx, y: nyMid, s: item.str });
  }
  parts.sort((a, b) => (Math.abs(a.y - b.y) > 0.004 ? a.y - b.y : a.x - b.x));
  return parts
    .map((p) => p.s)
    .join(' ')
    .replace(/-\s+(?=[a-záéíóúñ])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto plano de un rango de páginas (para la síntesis). */
export async function extractPagesText(docId: string, from: number, to: number): Promise<string> {
  const { promise, destroy } = openPdf(await loadPdfData(docId));
  try {
    const doc = await promise;
    const a = Math.max(1, Math.min(from, doc.numPages));
    const b = Math.max(a, Math.min(to, doc.numPages));
    const out: string[] = [];
    for (let i = a; i <= b; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let s = '';
      for (const it of tc.items) if (isText(it)) s += it.str + (it.hasEOL ? '\n' : ' ');
      out.push(s);
      page.cleanup();
    }
    return out.join('\n\n');
  } finally {
    destroy();
  }
}

/** Texto de cada página (índice 0 = página 1). Para búsqueda global y generación de preguntas. */
export async function extractAllPages(docId: string, maxPages = 2000, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const { promise, destroy } = openPdf(await loadPdfData(docId));
  try {
    const doc = await promise;
    const n = Math.min(doc.numPages, maxPages);
    const out: string[] = [];
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let s = '';
      for (const it of tc.items) if (isText(it)) s += it.str + (it.hasEOL ? '\n' : ' ');
      out.push(s.replace(/[ \t]+/g, ' ').trim());
      page.cleanup();
      if (onProgress && i % 10 === 0) onProgress(i, n);
    }
    return out;
  } finally {
    destroy();
  }
}

/* ---------- Índice del archivo (marcadores que trae el propio PDF) ---------- */

export interface OutlineItem {
  title: string;
  /** Página destino (1-based) o null si el PDF no la resuelve. */
  page: number | null;
  depth: number;
}

const outlineCache = new Map<string, OutlineItem[]>();

interface RawOutline {
  title: string;
  dest: string | unknown[] | null;
  items?: RawOutline[];
}

/**
 * Índice que trae el propio PDF (las GPC suelen traerlo). Se resuelve una vez y se guarda
 * en memoria; si el archivo no tiene índice devuelve una lista vacía.
 */
export async function outlineOf(docId: string, max = 400): Promise<OutlineItem[]> {
  const hit = outlineCache.get(docId);
  if (hit) return hit;
  const task = openPdf(await loadPdfData(docId));
  const out: OutlineItem[] = [];
  try {
    const pdf = await task.promise;
    const raw = (await pdf.getOutline()) as RawOutline[] | null;
    const pageOf = async (dest: RawOutline['dest']): Promise<number | null> => {
      try {
        const arr = typeof dest === 'string' ? ((await pdf.getDestination(dest)) as unknown[] | null) : dest;
        if (!Array.isArray(arr) || !arr.length) return null;
        return (await pdf.getPageIndex(arr[0] as never)) + 1;
      } catch {
        return null;
      }
    };
    const walk = async (items: RawOutline[], depth: number) => {
      for (const it of items) {
        if (out.length >= max) return;
        const title = (it.title ?? '').replace(/\s+/g, ' ').trim();
        if (title) out.push({ title, page: await pageOf(it.dest), depth });
        if (it.items?.length) await walk(it.items, depth + 1);
      }
    };
    if (raw?.length) await walk(raw, 0);
  } finally {
    task.destroy();
  }
  outlineCache.set(docId, out);
  return out;
}
