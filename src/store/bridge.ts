import { createStore } from '../lib/createStore';
import { escapeHtml } from '../lib/html';

/**
 * Puente entre módulos → notas: cualquier parte de la app puede pedir insertar HTML
 * en una nota (marcadores, perlas clínicas…) o avisar que el lienzo de una nota cambió.
 * El panel de notas lo consume.
 */
export interface Pending {
  html: string;
  n: number;
  /** Nota destino. null = la nota abierta. */
  noteId: string | null;
  /** true = al final de la nota (perlas); false = donde está el cursor. */
  append: boolean;
}

export interface BridgeState {
  pending: Pending | null;
  /** Pestaña que el panel de notas debe mostrar. */
  tabRequest: { tab: 'text' | 'ink'; n: number } | null;
  /** Se incrementa cuando cambia el lienzo de una nota desde fuera (p. ej. recorte del PDF). */
  inkRev: { noteId: string; n: number } | null;
  insertIntoNote: (html: string, opts?: { noteId?: string | null; append?: boolean }) => void;
  take: (noteId: string) => string | null;
  requestTab: (tab: 'text' | 'ink') => void;
  bumpInk: (noteId: string) => void;
}

export const useBridge = createStore<BridgeState>((set, get) => ({
  pending: null,
  tabRequest: null,
  inkRev: null,
  insertIntoNote: (html, opts) =>
    set((s) => ({ pending: { html, n: (s.pending?.n ?? 0) + 1, noteId: opts?.noteId ?? null, append: !!opts?.append } })),
  take: (noteId) => {
    const p = get().pending;
    if (!p || (p.noteId && p.noteId !== noteId)) return null;
    set({ pending: null });
    return p.html;
  },
  requestTab: (tab) => set((s) => ({ tabRequest: { tab, n: (s.tabRequest?.n ?? 0) + 1 } })),
  bumpInk: (noteId) => set((s) => ({ inkRev: { noteId, n: (s.inkRev?.n ?? 0) + 1 } })),
}));

/** Enlace a una página de un PDF, como "chip" dentro de la nota. Clic → abre esa página. */
export function pdfRefHtml(docId: string, docName: string, page: number, label?: string): string {
  const text = `📑 ${docName} · p. ${page}${label ? ` — ${label}` : ''}`;
  return `<a class="pdf-ref" href="#p${page}" data-doc="${escapeHtml(docId)}" data-page="${page}" contenteditable="false">${escapeHtml(text)}</a>&nbsp;`;
}
