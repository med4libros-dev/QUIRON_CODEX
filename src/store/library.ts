import { createStore } from '../lib/createStore';
import { idb } from '../lib/idb';
import { uid } from '../lib/id';
import type { Bookmark, DocMeta, Highlight, Sticky, Stroke } from '../types';

type AnnKind = 'highlight' | 'ink' | 'sticky';

export interface LibraryState {
  docs: DocMeta[];
  highlights: Record<string, Highlight[]>;
  /** Trazos a mano sobre el PDF. Coordenadas: x en [0,1000] del ancho de página, y en la misma escala. */
  inks: Record<string, Stroke[]>;
  stickies: Record<string, Sticky[]>;
  bookmarks: Record<string, Bookmark[]>;
  /** Páginas leídas por PDF (te quedaste ≥ 8 s en ellas). */
  read: Record<string, number[]>;
  markRead: (docId: string, page: number) => void;
  setBookmarkKind: (docId: string, id: string, kind: Bookmark['kind']) => void;
  /** Petición de navegación al visor (no se guarda). */
  nav: { docId: string; page: number; n: number } | null;
  /** Historial para deshacer anotaciones del PDF (no se guarda). */
  history: { docId: string; kind: AnnKind; ids: string[]; removed?: Stroke[] }[];

  addFiles: (files: File[]) => Promise<string | null>;
  /** Igual que addFiles pero devuelve todos los PDFs agregados (id + nombre de archivo). */
  addFilesAll: (files: File[]) => Promise<{ id: string; fileName: string }[]>;
  removeDoc: (id: string) => Promise<void>;
  renameDoc: (id: string, name: string) => void;
  setDocSubject: (id: string, subjectId: string | null) => void;
  setLastPage: (id: string, page: number) => void;
  setPageCount: (id: string, n: number) => void;

  addHighlight: (docId: string, h: Omit<Highlight, 'id' | 'createdAt'>) => string;
  updateHighlight: (docId: string, id: string, patch: Partial<Highlight>) => void;
  removeHighlight: (docId: string, id: string) => void;

  addPdfStroke: (docId: string, s: Stroke) => void;
  erasePdfStrokes: (docId: string, ids: string[]) => void;

  addSticky: (docId: string, s: Omit<Sticky, 'id' | 'createdAt'>) => string;
  updateSticky: (docId: string, id: string, patch: Partial<Sticky>) => void;
  removeSticky: (docId: string, id: string) => void;

  /** Agrega o quita el marcador de una página. Devuelve true si quedó marcada. */
  toggleBookmark: (docId: string, page: number, label?: string) => boolean;
  renameBookmark: (docId: string, id: string, label: string) => void;
  removeBookmark: (docId: string, id: string) => void;

  /** Deshace la última anotación hecha en este PDF. */
  undoLast: (docId: string) => void;
  goTo: (docId: string, page: number) => void;
}

const patchDoc = (docs: DocMeta[], id: string, patch: Partial<DocMeta>) =>
  docs.map((d) => (d.id === id ? { ...d, ...patch } : d));

export const useLibrary = createStore<LibraryState>(
  (set, get) => {
    const remember = (entry: LibraryState['history'][number]) =>
      set((s) => ({ history: [...s.history.slice(-99), entry] }));

    return {
      docs: [],
      highlights: {},
      inks: {},
      stickies: {},
      bookmarks: {},
      read: {},
      markRead: (docId, page) =>
        set((s) => {
          const cur = s.read[docId] ?? [];
          if (cur.includes(page)) return {};
          return { read: { ...s.read, [docId]: [...cur, page] } };
        }),
      setBookmarkKind: (docId, id, kind) =>
        set((s) => ({ bookmarks: { ...s.bookmarks, [docId]: (s.bookmarks[docId] ?? []).map((b) => (b.id === id ? { ...b, kind } : b)) } })),
      nav: null,
      history: [],

      addFiles: async (files) => (await get().addFilesAll(files))[0]?.id ?? null,

      addFilesAll: async (files) => {
        const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
        const added: { id: string; fileName: string }[] = [];
        for (const file of pdfs) {
          const id = uid();
          await idb.set('pdfs', id, file);
          added.push({ id, fileName: file.name });
          const meta: DocMeta = {
            id,
            name: file.name.replace(/\.pdf$/i, ''),
            size: file.size,
            subjectId: null,
            addedAt: Date.now(),
            lastPage: 1,
            pageCount: 0,
          };
          set((s) => ({ docs: [meta, ...s.docs] }));
        }
        return added;
      },

      removeDoc: async (id) => {
        await idb.del('pdfs', id);
        void idb.del('kv', `search:${id}`);
        set((s) => {
          const highlights = { ...s.highlights };
          const inks = { ...s.inks };
          const stickies = { ...s.stickies };
          delete highlights[id];
          delete inks[id];
          delete stickies[id];
          const bookmarks = { ...s.bookmarks };
          delete bookmarks[id];
          const read = { ...s.read };
          delete read[id];
          return { docs: s.docs.filter((d) => d.id !== id), highlights, inks, stickies, bookmarks, read, history: s.history.filter((h) => h.docId !== id) };
        });
      },

      renameDoc: (id, name) => set((s) => ({ docs: patchDoc(s.docs, id, { name }) })),
      setDocSubject: (id, subjectId) => set((s) => ({ docs: patchDoc(s.docs, id, { subjectId }) })),
      setLastPage: (id, lastPage) => set((s) => ({ docs: patchDoc(s.docs, id, { lastPage }) })),
      setPageCount: (id, pageCount) => {
        if (get().docs.find((d) => d.id === id)?.pageCount === pageCount) return;
        set((s) => ({ docs: patchDoc(s.docs, id, { pageCount }) }));
      },

      addHighlight: (docId, h) => {
        const id = uid();
        set((s) => ({
          highlights: { ...s.highlights, [docId]: [...(s.highlights[docId] ?? []), { ...h, id, createdAt: Date.now() }] },
        }));
        remember({ docId, kind: 'highlight', ids: [id] });
        return id;
      },
      updateHighlight: (docId, id, patch) =>
        set((s) => ({
          highlights: {
            ...s.highlights,
            [docId]: (s.highlights[docId] ?? []).map((h) => (h.id === id ? { ...h, ...patch } : h)),
          },
        })),
      removeHighlight: (docId, id) =>
        set((s) => ({
          highlights: { ...s.highlights, [docId]: (s.highlights[docId] ?? []).filter((h) => h.id !== id) },
        })),

      addPdfStroke: (docId, stroke) => {
        set((s) => ({ inks: { ...s.inks, [docId]: [...(s.inks[docId] ?? []), stroke] } }));
        remember({ docId, kind: 'ink', ids: [stroke.id] });
      },
      erasePdfStrokes: (docId, ids) => {
        const drop = new Set(ids);
        const removed = (get().inks[docId] ?? []).filter((s) => drop.has(s.id));
        if (!removed.length) return;
        set((s) => ({ inks: { ...s.inks, [docId]: (s.inks[docId] ?? []).filter((x) => !drop.has(x.id)) } }));
        remember({ docId, kind: 'ink', ids: [], removed });
      },

      addSticky: (docId, st) => {
        const id = uid();
        set((s) => ({ stickies: { ...s.stickies, [docId]: [...(s.stickies[docId] ?? []), { ...st, id, createdAt: Date.now() }] } }));
        remember({ docId, kind: 'sticky', ids: [id] });
        return id;
      },
      updateSticky: (docId, id, patch) =>
        set((s) => ({
          stickies: { ...s.stickies, [docId]: (s.stickies[docId] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)) },
        })),
      removeSticky: (docId, id) =>
        set((s) => ({ stickies: { ...s.stickies, [docId]: (s.stickies[docId] ?? []).filter((x) => x.id !== id) } })),

      toggleBookmark: (docId, page, label = '') => {
        const list = get().bookmarks[docId] ?? [];
        const existing = list.find((b) => b.page === page);
        const next = existing
          ? list.filter((b) => b.id !== existing.id)
          : [...list, { id: uid(), page, label, createdAt: Date.now() }].sort((a, b) => a.page - b.page);
        set((s) => ({ bookmarks: { ...s.bookmarks, [docId]: next } }));
        return !existing;
      },
      renameBookmark: (docId, id, label) =>
        set((s) => ({ bookmarks: { ...s.bookmarks, [docId]: (s.bookmarks[docId] ?? []).map((b) => (b.id === id ? { ...b, label } : b)) } })),
      removeBookmark: (docId, id) =>
        set((s) => ({ bookmarks: { ...s.bookmarks, [docId]: (s.bookmarks[docId] ?? []).filter((b) => b.id !== id) } })),

      undoLast: (docId) => {
        const hist = get().history;
        let i = hist.length - 1;
        while (i >= 0 && hist[i].docId !== docId) i--;
        if (i < 0) return;
        const entry = hist[i];
        const ids = new Set(entry.ids);
        set((s) => {
          const history = s.history.filter((_, k) => k !== i);
          if (entry.kind === 'highlight')
            return { history, highlights: { ...s.highlights, [docId]: (s.highlights[docId] ?? []).filter((h) => !ids.has(h.id)) } };
          if (entry.kind === 'sticky')
            return { history, stickies: { ...s.stickies, [docId]: (s.stickies[docId] ?? []).filter((h) => !ids.has(h.id)) } };
          // Tinta: deshacer un trazo nuevo lo quita; deshacer un borrado lo restaura.
          const current = (s.inks[docId] ?? []).filter((x) => !ids.has(x.id));
          return { history, inks: { ...s.inks, [docId]: entry.removed ? [...current, ...entry.removed] : current } };
        });
      },

      goTo: (docId, page) => set((s) => ({ nav: { docId, page, n: (s.nav?.n ?? 0) + 1 } })),
    };
  },
  {
    key: 'library',
    storage: 'idb',
    pick: ({ docs, highlights, inks, stickies, bookmarks, read }) => ({ docs, highlights, inks, stickies, bookmarks, read }),
  },
);
