import { createStore } from '../lib/createStore';
import { idb } from '../lib/idb';
import { uid } from '../lib/id';
import type { Bookmark, DocMeta, Highlight, InkImageLike, Note, Sticky, Stroke } from '../types';

/**
 * Papelera de 30 días. Nada de lo que borres se va de inmediato: pasa por aquí con todo lo
 * necesario para volver tal cual (la nota con su tinta, el PDF con sus resaltados, la hoja
 * con sus trazos). Pasados 30 días se limpia sola al abrir la app.
 */
export const TRASH_DAYS = 30;

export interface TrashNote {
  kind: 'note';
  note: Note;
  strokes: Stroke[];
  images: InkImageLike[];
}
export interface TrashDoc {
  kind: 'doc';
  doc: DocMeta;
  highlights: Highlight[];
  inks: Stroke[];
  stickies: Sticky[];
  bookmarks: Bookmark[];
  read: number[];
}
export interface TrashSheet {
  kind: 'sheet';
  noteId: string;
  noteTitle: string;
  page: number;
  strokes: Stroke[];
  images: InkImageLike[];
}
export type TrashPayload = TrashNote | TrashDoc | TrashSheet;

export interface TrashItem {
  id: string;
  /** Lo que se ve en la lista. */
  label: string;
  at: number;
  payload: TrashPayload;
}

export interface TrashState {
  items: TrashItem[];
  /** Guarda algo borrado. Devuelve el id en la papelera. */
  push: (label: string, payload: TrashPayload) => string;
  /** Lo saca de la papelera (ya se restauró o se borró de verdad). */
  drop: (id: string) => void;
  /** Vacía la papelera por completo (borra también los PDFs guardados). */
  empty: () => Promise<void>;
  /** Quita lo que ya pasó de 30 días. */
  purgeOld: () => Promise<void>;
}

const expired = (it: TrashItem) => Date.now() - it.at > TRASH_DAYS * 86_400_000;

/** Un PDF en la papelera conserva su archivo; al vaciarla se borra de verdad. */
async function forget(it: TrashItem) {
  if (it.payload.kind === 'doc') {
    await idb.del('pdfs', it.payload.doc.id).catch(() => undefined);
    void idb.del('kv', `search:${it.payload.doc.id}`);
  }
  // El historial de la nota se va con ella (la clave se borra directo para no enredar módulos).
  if (it.payload.kind === 'note') void idb.del('kv', `hist:${it.payload.note.id}`);
}

export const useTrash = createStore<TrashState>(
  (set, get) => ({
    items: [],
    push: (label, payload) => {
      const id = uid();
      set((s) => ({ items: [{ id, label, at: Date.now(), payload }, ...s.items].slice(0, 200) }));
      return id;
    },
    drop: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    empty: async () => {
      for (const it of get().items) await forget(it);
      set({ items: [] });
    },
    purgeOld: async () => {
      const old = get().items.filter(expired);
      if (!old.length) return;
      for (const it of old) await forget(it);
      set((s) => ({ items: s.items.filter((i) => !expired(i)) }));
    },
  }),
  { key: 'trash', storage: 'idb', pick: ({ items }) => ({ items }) },
);

/** Días que le quedan a un elemento antes de borrarse solo. */
export const daysLeft = (it: TrashItem) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - it.at) / 86_400_000));
