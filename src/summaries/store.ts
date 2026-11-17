import { createStore } from '../lib/createStore';
import type { MatchLevel } from '../lib/summaryTitle';

/**
 * Índice de la carpeta de resúmenes.
 *
 * Aquí **no** viven los PDFs: viven en tu disco, donde los dejaste. De cada uno se guarda el
 * nombre, el título que trae impreso, el tema con el que quedó y la ruta dentro de la carpeta.
 * Son unos kilobytes aunque la carpeta pese gigabytes, y por eso tampoco engorda tus respaldos.
 */
export interface Summary {
  /** Ruta relativa dentro de la carpeta; es lo que identifica al archivo entre sesiones. */
  path: string;
  name: string;
  size: number;
  /** El título impreso en la primera página. Vacío si no se pudo leer. */
  title: string;
  /** Tema del temario con el que quedó, o null si ninguno encajó. */
  topicId: string | null;
  /** Qué tan seguro fue el emparejamiento automático. 'manual' = lo pusiste tú. */
  level: MatchLevel | 'manual';
  score: number;
  pages: number;
  indexedAt: number;
}

interface State {
  /** Nombre de la carpeta elegida, solo para mostrarlo. */
  folderName: string;
  summaries: Summary[];
  /** Resúmenes cuyo archivo ya no está en la carpeta la última vez que se actualizó. */
  missing: string[];
  setFolder: (name: string) => void;
  /** Reemplaza el índice completo tras recorrer la carpeta. */
  setIndex: (folderName: string, summaries: Summary[], missing: string[]) => void;
  /** Cambia a mano el tema de un resumen (o lo deja sin tema con null). */
  assign: (path: string, topicId: string | null) => void;
  /** Da por buenos todos los emparejamientos «probables». */
  confirmAll: () => void;
  clear: () => void;
}

export const useSummaries = createStore<State>(
  (set) => ({
    folderName: '',
    summaries: [],
    missing: [],
    setFolder: (folderName) => set({ folderName }),
    setIndex: (folderName, summaries, missing) => set({ folderName, summaries, missing }),
    assign: (path, topicId) =>
      set((s) => ({
        summaries: s.summaries.map((x) => (x.path === path ? { ...x, topicId, level: 'manual' as const, score: 1 } : x)),
      })),
    confirmAll: () =>
      set((s) => ({
        summaries: s.summaries.map((x) => (x.level === 'probable' && x.topicId ? { ...x, level: 'manual' as const, score: 1 } : x)),
      })),
    clear: () => set({ folderName: '', summaries: [], missing: [] }),
  }),
  { key: 'summaries', storage: 'idb', pick: ({ folderName, summaries, missing }) => ({ folderName, summaries, missing }) },
);

/** Los resúmenes de un tema, los confirmados primero. */
export const summariesOf = (list: Summary[], topicId: string): Summary[] =>
  list.filter((s) => s.topicId === topicId).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'es'));
