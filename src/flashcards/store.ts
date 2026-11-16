import { createStore } from '../lib/createStore';
import { addDays, fromKey, toKey, todayKey } from '../lib/date';
import { uid } from '../lib/id';
import { fromSm2, intervalFor, next, type FsrsGrade } from './fsrs';
import { useSettings } from '../store/settings';
import type { NRect } from '../types';

/**
 * Flashcards con repaso espaciado **FSRS**: en vez de un «factor de facilidad» arrastrado,
 * cada tarjeta guarda su estabilidad (días que aguanta la memoria) y su dificultad, y de ahí
 * sale el día exacto del siguiente repaso para la retención que pidas en Preferencias.
 * Las tarjetas creadas con SM-2 se convierten solas la primera vez que las repasas.
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
  /** Oclusión de imagen: cajas que tapan etiquetas y cuál toca adivinar en esta tarjeta. */
  occlusion?: { boxes: NRect[]; target: number };
  source?: { docId: string; docName: string; page: number };
  createdAt: number;
  due: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** FSRS: estabilidad en días y dificultad 1–10 (ausentes en tarjetas viejas de SM-2). */
  s?: number;
  d?: number;
  lastReview?: string;
  /** «Me lo preguntaron». */
  asked?: boolean;
}

/**
 * Calcula el siguiente repaso con FSRS. Devuelve los campos a actualizar.
 * `retention` es la probabilidad de acierto que quieres mantener (0.9 por defecto).
 */
export function schedule(
  c: Pick<Card, 'interval' | 'ease' | 'reps' | 'lapses' | 's' | 'd' | 'lastReview'>,
  g: Grade,
  today = todayKey(),
  retention = 0.9,
) {
  const grade = (g + 1) as FsrsGrade;
  // Tarjeta vieja de SM-2: su intervalo y facilidad se traducen a estabilidad y dificultad.
  const mem = c.s != null && c.d != null ? { s: c.s, d: c.d } : c.reps > 0 ? fromSm2(c.interval, c.ease) : null;
  const elapsed = c.lastReview ? Math.max(0, Math.round((fromKey(today).getTime() - fromKey(c.lastReview).getTime()) / 86_400_000)) : 0;
  const m = next(mem, grade, elapsed);
  const interval = intervalFor(m.s, retention);
  return {
    interval,
    ease: c.ease,
    reps: g === 0 ? 0 : c.reps + 1,
    lapses: c.lapses + (g === 0 ? 1 : 0),
    s: m.s,
    d: m.d,
    due: toKey(addDays(fromKey(today), interval)),
    lastReview: today,
  };
}

export interface CardsState {
  cards: Card[];
  addCard: (c: Pick<Card, 'front' | 'back' | 'topicId' | 'image' | 'source' | 'occlusion'>) => string;
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
    grade: (id, g) => {
      const retention = useSettings.getState().retention;
      set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...schedule(c, g, todayKey(), retention) } : c)) }));
    },
  }),
  { key: 'cards', storage: 'idb', pick: ({ cards }) => ({ cards }) },
);

/** Vencidas; las marcadas «me lo preguntaron» van primero. */
export const dueCards = (cards: Card[], today = todayKey()) =>
  cards.filter((c) => c.due <= today).sort((a, b) => Number(!!b.asked) - Number(!!a.asked) || a.due.localeCompare(b.due));
