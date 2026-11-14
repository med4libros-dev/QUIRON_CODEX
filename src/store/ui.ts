import { createStore } from '../lib/createStore';
import type { Card } from '../flashcards/store';
import type { NRect } from '../types';

/** Fragmento capturado del PDF (texto seleccionado o recorte) esperando una acción. */
export interface Pearl {
  docId: string;
  page: number;
  /** Zona en coordenadas relativas a la página (0–1). */
  rect: NRect;
  text: string;
  /** Imagen ya recortada (herramienta Recorte). Si falta, se recorta al vuelo. */
  image?: string;
  /** Posición del menú en pantalla. */
  x: number;
  y: number;
}

export type TopicTab = 'docs' | 'guard' | 'cases' | 'cards' | 'hy' | 'sources';

/** Estado de interfaz global (no se guarda): ventanas que se abren desde cualquier parte. */
export interface UIState {
  topicSheet: { topicId: string; tab: TopicTab } | null;
  /** Borrador de flashcard (desde el PDF o manual). */
  cardDraft: (Partial<Pick<Card, 'front' | 'back' | 'image' | 'source'>> & { topicId: string | null }) | null;
  /** Sesión de repaso de flashcards. `minutes` = límite de tiempo (modo supervivencia). */
  review: { cardIds: string[]; title: string; minutes?: number } | null;
  temarioOpen: boolean;
  guardQuickOpen: boolean;
  soapOpen: boolean;
  sourcesDrawer: boolean;
  setSourcesDrawer: (v: boolean) => void;
  setSoapOpen: (v: boolean) => void;
  pearl: Pearl | null;
  setPearl: (p: Pearl | null) => void;
  toast: { text: string; n: number } | null;
  showToast: (text: string) => void;
  openTopic: (topicId: string, tab?: TopicTab) => void;
  closeTopic: () => void;
  setCardDraft: (d: UIState['cardDraft']) => void;
  startReview: (r: UIState['review']) => void;
  setTemarioOpen: (v: boolean) => void;
  setGuardQuickOpen: (v: boolean) => void;
}

export const useUI = createStore<UIState>((set) => ({
  topicSheet: null,
  cardDraft: null,
  review: null,
  temarioOpen: false,
  guardQuickOpen: false,
  soapOpen: false,
  sourcesDrawer: false,
  setSourcesDrawer: (sourcesDrawer) => set({ sourcesDrawer }),
  setSoapOpen: (soapOpen) => set({ soapOpen, topicSheet: null, guardQuickOpen: false }),
  pearl: null,
  setPearl: (pearl) => set({ pearl }),
  toast: null,
  showToast: (text) => set((s) => ({ toast: { text, n: (s.toast?.n ?? 0) + 1 } })),
  openTopic: (topicId, tab = 'docs') => set({ topicSheet: { topicId, tab }, temarioOpen: false, guardQuickOpen: false }),
  closeTopic: () => set({ topicSheet: null }),
  setCardDraft: (cardDraft) => set({ cardDraft }),
  startReview: (review) => set({ review }),
  setTemarioOpen: (temarioOpen) => set({ temarioOpen }),
  setGuardQuickOpen: (guardQuickOpen) => set({ guardQuickOpen }),
}));
