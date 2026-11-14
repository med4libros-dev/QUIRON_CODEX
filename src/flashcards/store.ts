import { createStore } from '../lib/createStore';
import { addDays, fromKey, toKey, todayKey } from '../lib/date';
import { uid } from '../lib/id';

/**
 * Flashcards con repaso espaciado (algoritmo tipo SM-2 / Anki).
 * Fase 4 lo cambiará por FSRS; el formato de las tarjetas ya guarda lo necesario.
 */
export type Grade = 0 | 1 | 2 | 3; // Otra vez · Difícil · Bien · Fácil
export const GRADE_LABEL: Record<Grade, string> = { 0: 'Otra vez', 1: 'Difícil', 2: 'Bien', 3: 'Fácil' };

export interface Card {
  id: string;
  topicId: string | null;
  front: string;
  back: string;
  /** Recorte del PDF (data URL) para el reverso. */
  image?: string;
  source?: { docId: string; docName: string; page: number };
  createdAt: number;
  due: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReview?: string;
}

/** Calcula el siguiente repaso. Devuelve los campos a actualizar. */
export function schedule(c: Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses'>, g: Grade, today = todayKey()) {
  let { interval, ease, reps, lapses } = c;
  if (g === 0) {
    reps = 0;
    lapses += 1;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (g === 1) {
    interval = Math.max(1, Math.round(interval * 1.2));
    ease = Math.max(1.3, ease - 0.15);
    reps += 1;
  } else if (g === 2) {
    interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
    reps += 1;
  } else {
    interval = reps === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3);
    ease = Math.min(3, ease + 0.15);
    reps += 1;
  }
  interval = Math.min(interval, 365);
  return { interval, ease, reps, lapses, due: toKey(addDays(fromKey(today), interval)), lastReview: today };
}

export interface CardsState {
  cards: Card[];
  addCard: (c: Pick<Card, 'front' | 'back' | 'topicId' | 'image' | 'source'>) => string;
  updateCard: (id: string, patch: Partial<Card>) => void;
  removeCard: (id: string) => void;
  grade: (id: string, g: Grade) => void;
}

export const useCards = createStore<CardsState>(
  (set) => ({
    cards: [],
    addCard: (c) => {
      const id = uid();
      const card: Card = { ...c, id, createdAt: Date.now(), due: todayKey(), interval: 0, ease: 2.5, reps: 0, lapses: 0 };
      set((s) => ({ cards: [...s.cards, card] }));
      return id;
    },
    updateCard: (id, patch) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    removeCard: (id) => set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
    grade: (id, g) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...schedule(c, g) } : c)) })),
  }),
  { key: 'cards', storage: 'idb', pick: ({ cards }) => ({ cards }) },
);

export const dueCards = (cards: Card[], today = todayKey()) => cards.filter((c) => c.due <= today).sort((a, b) => a.due.localeCompare(b.due));
