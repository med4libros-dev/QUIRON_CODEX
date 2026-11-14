import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';
import type { SpecialtyId } from '../internship/types';

/**
 * Hub de NotebookLM: tus cuadernos de fuentes (Gemini / NotebookLM) y los fragmentos
 * que traes de ellos. NotebookLM no ofrece una API pública para cuentas personales,
 * así que la consulta se hace en su página y el fragmento se pega aquí con su cita.
 */
export interface SourceNotebook {
  id: string;
  title: string;
  url: string;
  emoji: string;
  description: string;
  specialty: SpecialtyId | null;
  topicIds: string[];
  createdAt: number;
  lastOpened?: number;
}

export interface Snippet {
  id: string;
  notebookId: string;
  /** Lo que preguntaste en NotebookLM (opcional). */
  question: string;
  /** El fragmento o respuesta, pegado tal cual. */
  text: string;
  /** Cita o fuente que mostró NotebookLM (documento, página…). */
  cite: string;
  topicId: string | null;
  createdAt: number;
}

/** Solo enlaces de NotebookLM / cuadernos de Gemini (https). */
export function isNotebookUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return (
      u.protocol === 'https:' &&
      ((u.hostname === 'gemini.google.com' && u.pathname.startsWith('/notebook/')) ||
        (u.hostname === 'notebooklm.google.com' && u.pathname.startsWith('/notebook/')))
    );
  } catch {
    return false;
  }
}

const SEED: SourceNotebook[] = [
  {
    id: 'nb-mi',
    title: 'Guía de Medicina Interna',
    url: 'https://gemini.google.com/notebook/d670ff3a-e269-49d5-8539-ca554570ba2a',
    emoji: '📄',
    description: '',
    specialty: 'mi',
    topicIds: [],
    createdAt: 0,
  },
  {
    id: 'nb-gi-bleed',
    title: 'Comprehensive Clinical Guide to Gastrointestinal Bleeding',
    url: 'https://gemini.google.com/notebook/4a9aa4e5-3aee-4eed-846a-658018f8a5f9',
    emoji: '🩺',
    description: '',
    specialty: 'mi',
    topicIds: [],
    createdAt: 0,
  },
];

export interface SourcesState {
  notebooks: SourceNotebook[];
  snippets: Snippet[];
  addNotebook: (p: Omit<SourceNotebook, 'id' | 'createdAt'>) => string;
  updateNotebook: (id: string, patch: Partial<SourceNotebook>) => void;
  removeNotebook: (id: string) => void;
  touch: (id: string) => void;
  addSnippet: (p: Omit<Snippet, 'id' | 'createdAt'>) => string;
  updateSnippet: (id: string, patch: Partial<Snippet>) => void;
  removeSnippet: (id: string) => void;
}

export const useSources = createStore<SourcesState>(
  (set) => ({
    notebooks: SEED,
    snippets: [],
    addNotebook: (p) => {
      const id = uid();
      set((s) => ({ notebooks: [...s.notebooks, { ...p, id, createdAt: Date.now() }] }));
      return id;
    },
    updateNotebook: (id, patch) => set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),
    // Los fragmentos se conservan aunque quites el cuaderno: son tus apuntes.
    removeNotebook: (id) => set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) })),
    touch: (id) => set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...n, lastOpened: Date.now() } : n)) })),
    addSnippet: (p) => {
      const id = uid();
      set((s) => ({ snippets: [{ ...p, id, createdAt: Date.now() }, ...s.snippets] }));
      return id;
    },
    updateSnippet: (id, patch) => set((s) => ({ snippets: s.snippets.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeSnippet: (id) => set((s) => ({ snippets: s.snippets.filter((x) => x.id !== id) })),
  }),
  { key: 'sources', storage: 'idb', pick: ({ notebooks, snippets }) => ({ notebooks, snippets }) },
);

/** Cuadernos relacionados con un tema: vinculados explícitamente o de su especialidad. */
export function notebooksForTopic(notebooks: SourceNotebook[], topicId: string, specialty: SpecialtyId): SourceNotebook[] {
  const linked = notebooks.filter((n) => n.topicIds.includes(topicId));
  const bySp = notebooks.filter((n) => !n.topicIds.includes(topicId) && n.specialty === specialty);
  return [...linked, ...bySp];
}
