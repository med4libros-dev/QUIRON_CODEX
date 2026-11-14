import { createStore } from '../lib/createStore';
import { idb } from '../lib/idb';
import { uid } from '../lib/id';
import type { Note, Notebook } from '../types';

export interface NotesState {
  notes: Note[];
  notebooks: Notebook[];
  createNote: (p: {
    docId: string | null;
    notebookId?: string | null;
    title?: string;
    kind?: Note['kind'];
    html?: string;
  }) => string;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  deleteNote: (id: string) => void;
  createNotebook: (p: { name: string; subjectId: string | null; color: string }) => string;
  updateNotebook: (id: string, patch: Partial<Omit<Notebook, 'id' | 'createdAt'>>) => void;
  /** Elimina el cuaderno; sus notas se conservan como "sin cuaderno". */
  deleteNotebook: (id: string) => void;
}

/** Los trazos del lienzo viven aparte (idb 'ink') para que escribir texto no reescriba la tinta. */
export const useNotes = createStore<NotesState>(
  (set) => ({
    notes: [],
    notebooks: [],

    createNote: ({ docId, notebookId = null, title, kind = 'manual', html = '' }) => {
      const now = Date.now();
      const note: Note = {
        id: uid(),
        docId,
        notebookId,
        title: title ?? 'Nota sin título',
        html,
        inkPages: 1,
        paper: 'lined',
        kind,
        createdAt: now,
        updatedAt: now,
      };
      set((s) => ({ notes: [...s.notes, note] }));
      return note.id;
    },
    updateNote: (id, patch) =>
      set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) })),
    deleteNote: (id) => {
      void idb.del('ink', id);
      void idb.del('ink', `${id}:img`);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    },

    createNotebook: ({ name, subjectId, color }) => {
      const id = uid();
      set((s) => ({ notebooks: [...s.notebooks, { id, name, subjectId, color, createdAt: Date.now() }] }));
      return id;
    },
    updateNotebook: (id, patch) =>
      set((s) => ({ notebooks: s.notebooks.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
    deleteNotebook: (id) =>
      set((s) => ({
        notebooks: s.notebooks.filter((b) => b.id !== id),
        notes: s.notes.map((n) => (n.notebookId === id ? { ...n, notebookId: null } : n)),
      })),
  }),
  { key: 'notes', storage: 'idb', pick: ({ notes, notebooks }) => ({ notes, notebooks }) },
);
