import { createStore } from '../lib/createStore';
import { applyCurriculumEdits, TOPICS } from './curriculum';
import type { SpecialtyId, Topic } from './types';

/**
 * Temario editable. El temario base vive en `curriculum.ts` y no se toca: aquí se guardan
 * solo *tus* cambios (temas que agregaste, los que ocultaste y los que repriorizaste o partiste).
 * Así, si el temario base cambia en una actualización, tus cambios siguen encima.
 *
 * Los ids se conservan, que es lo que mantiene marcado lo ya estudiado.
 */
export interface CurriculumEdits {
  /** Cambios sobre temas del temario base, por id. */
  patch: Record<string, Partial<Pick<Topic, 'title' | 'minutes' | 'yield' | 'gpc' | 'specialty'>>>;
  /** Temas tuyos (ids `u-…`). */
  added: Topic[];
  /** Temas del base que no quieres estudiar. */
  hidden: string[];
}

export interface CurriculumState extends CurriculumEdits {
  /** Sube con cada cambio: las vistas lo observan para volver a dibujarse. */
  rev: number;
  editTopic: (id: string, patch: CurriculumEdits['patch'][string]) => void;
  addTopic: (t: Omit<Topic, 'id'>) => string;
  removeTopic: (id: string) => void;
  restoreTopic: (id: string) => void;
  resetAll: () => void;
}

const apply = (s: CurriculumEdits) => applyCurriculumEdits(s);

export const useCurriculum = createStore<CurriculumState>(
  (set, get) => ({
    patch: {},
    added: [],
    hidden: [],
    rev: 0,
    editTopic: (id, patch) =>
      set((s) => {
        const next = s.added.some((t) => t.id === id)
          ? { added: s.added.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
          : { patch: { ...s.patch, [id]: { ...s.patch[id], ...patch } } };
        const merged = { ...s, ...next };
        apply(merged);
        return { ...next, rev: s.rev + 1 };
      }),
    addTopic: (t) => {
      const id = `u-${Date.now().toString(36)}`;
      set((s) => {
        const added = [...s.added, { ...t, id }];
        apply({ ...s, added });
        return { added, rev: s.rev + 1 };
      });
      return id;
    },
    removeTopic: (id) =>
      set((s) => {
        const next = id.startsWith('u-')
          ? { added: s.added.filter((t) => t.id !== id) }
          : { hidden: [...new Set([...s.hidden, id])] };
        apply({ ...s, ...next });
        return { ...next, rev: s.rev + 1 };
      }),
    restoreTopic: (id) =>
      set((s) => {
        const hidden = s.hidden.filter((x) => x !== id);
        apply({ ...s, hidden });
        return { hidden, rev: s.rev + 1 };
      }),
    resetAll: () =>
      set((s) => {
        apply({ patch: {}, added: [], hidden: [] });
        return { patch: {}, added: [], hidden: [], rev: s.rev + 1 };
      }),
  }),
  {
    key: 'curriculum',
    storage: 'idb',
    pick: ({ patch, added, hidden }) => ({ patch, added, hidden }),
    // Al cargar del disco se aplican los cambios al temario en memoria y se avisa a las vistas.
    onHydrate: (s) => {
      apply(s as CurriculumEdits);
      queueMicrotask(() => useCurriculum.setState((p) => ({ rev: p.rev + 1 })));
    },
  },
);

/** ¿Cuántos temas tiene el temario ahora mismo? (para avisos y pruebas) */
export const topicCount = () => TOPICS.length;

/** Especialidades con al menos un tema, en el orden del temario. */
export const usedSpecialties = () => [...new Set(TOPICS.map((t) => t.specialty))] as SpecialtyId[];
