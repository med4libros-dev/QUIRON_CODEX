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

export type TopicTab = 'docs' | 'guard' | 'cases' | 'cards' | 'hy' | 'hl';

/** Estado de interfaz global (no se guarda): ventanas que se abren desde cualquier parte. */
export interface UIState {
  topicSheet: { topicId: string; tab: TopicTab } | null;
  /** Borrador de flashcard (desde el PDF o manual). */
  cardDraft: (Partial<Pick<Card, 'front' | 'back' | 'image' | 'source'>> & { topicId: string | null }) | null;
  /** Sesión de repaso de flashcards. `minutes` = límite de tiempo (modo supervivencia). */
  review: { cardIds: string[]; title: string; minutes?: number; oneHand?: boolean } | null;
  temarioOpen: boolean;
  guardQuickOpen: boolean;
  /** Pestaña de la Vista de Guardia y peso precargado para el cálculo de dosis. */
  guardTab: 'topics' | 'drugs' | 'vitals';
  drugWeight: number | null;
  openDrugs: (weight?: number | null) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  /** Comparador de dos guías (ids de documento). */
  compare: { a: string; b: string } | null;
  setCompare: (c: { a: string; b: string } | null) => void;
  /** Ensayo del pase de visita para un paciente del turno. */
  rounds: string | null;
  setRounds: (pid: string | null) => void;
  /** Diagrama del tema (id de tema). */
  diagram: string | null;
  setDiagram: (topicId: string | null) => void;
  /** Preguntas desde subrayados (id de documento). */
  hlQuiz: string | null;
  setHlQuiz: (docId: string | null) => void;
  /** Flashcards de huecos: de los subrayados de un PDF o de un fragmento suelto. */
  cloze: { docId: string; items?: { text: string; page: number }[]; topicId?: string | null } | null;
  setCloze: (c: UIState['cloze']) => void;
  /** Recorte que se va a convertir en tarjetas de oclusión. */
  occlusion: { src: string; topicId?: string | null; source?: { docId: string; docName: string; page: number } } | null;
  setOcclusion: (o: UIState['occlusion']) => void;
  shortcutsOpen: boolean;
  /** Lectura a pantalla completa: sin barra lateral ni barras superiores. */
  focus: boolean;
  setFocus: (v: boolean) => void;
  /** El modo noche está activo ahora (lo calcula App). */
  nightOn: boolean;
  soapOpen: boolean;
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
  guardTab: 'topics',
  drugWeight: null,
  openDrugs: (weight = null) => set({ guardQuickOpen: true, guardTab: 'drugs', drugWeight: weight, topicSheet: null }),
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  compare: null,
  setCompare: (compare) => set({ compare, topicSheet: null }),
  rounds: null,
  setRounds: (rounds) => set({ rounds }),
  diagram: null,
  setDiagram: (diagram) => set({ diagram, topicSheet: null }),
  hlQuiz: null,
  setHlQuiz: (hlQuiz) => set({ hlQuiz }),
  cloze: null,
  setCloze: (cloze) => set({ cloze }),
  occlusion: null,
  setOcclusion: (occlusion) => set({ occlusion }),
  shortcutsOpen: false,
  focus: false,
  setFocus: (focus) => {
    set({ focus });
    try {
      if (focus) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    } catch {
      /* pantalla completa no disponible: queda el modo sin barras */
    }
  },
  nightOn: false,
  soapOpen: false,
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
  setGuardQuickOpen: (guardQuickOpen) => set(guardQuickOpen ? { guardQuickOpen, guardTab: 'topics' as const } : { guardQuickOpen }),
}));
