import { createStore } from '../lib/createStore';
import type { Theme, View } from '../types';

export interface SettingsState {
  theme: Theme;
  /** Estilo visual: «glass» (cristal líquido) o «pistache» (papel mate). */
  look: 'glass' | 'pistache';
  /** Tema efectivo (resuelto desde 'system'); no se guarda. */
  dark: boolean;
  view: View;
  splitRatio: number;
  /** true = notas a la izquierda y PDF a la derecha. */
  swapPanes: boolean;
  /** Qué se muestra en Estudio: ambos paneles, solo el PDF o solo las notas. */
  paneMode: 'both' | 'pdf' | 'notes';
  libraryOpen: boolean;
  activeDocId: string | null;
  activeNoteId: string | null;
  /** Qué notas muestra el panel: null = las del PDF abierto; id = un cuaderno. */
  notebookScope: string | null;
  apiKey: string;
  model: string;
  /** Modo noche: tonos cálidos sin azul. «auto» lo activa entre nightFrom y nightTo (horas). */
  night: 'off' | 'auto' | 'on';
  nightFrom: number;
  nightTo: number;
  /** Recordatorios del sistema (Windows) mientras la app está abierta. */
  reminders: boolean;
  /** Hora del aviso diario de flashcards/refuerzo. */
  reminderHour: number;
  /** Fecha del ENARM (YYYY-MM-DD) para la cuenta regresiva de Inicio. */
  enarmDate: string | null;
  setEnarmDate: (d: string | null) => void;
  setNight: (n: 'off' | 'auto' | 'on', from?: number, to?: number) => void;
  setReminders: (on: boolean, hour?: number) => void;
  setTheme: (t: Theme) => void;
  setLook: (l: 'glass' | 'pistache') => void;
  setDark: (d: boolean) => void;
  setView: (v: View) => void;
  setSplitRatio: (r: number) => void;
  toggleSwap: () => void;
  setPaneMode: (m: 'both' | 'pdf' | 'notes') => void;
  setLibraryOpen: (o: boolean) => void;
  setActiveDoc: (id: string | null) => void;
  setActiveNote: (id: string | null) => void;
  setNotebookScope: (id: string | null) => void;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
}

export const useSettings = createStore<SettingsState>(
  (set) => ({
    theme: 'dark',
    look: 'glass',
    dark: false,
    view: 'internado',
    splitRatio: 0.56,
    swapPanes: false,
    paneMode: 'both',
    libraryOpen: false,
    activeDocId: null,
    activeNoteId: null,
    notebookScope: null,
    apiKey: '',
    model: 'claude-sonnet-5-5',
    night: 'off',
    nightFrom: 22,
    nightTo: 6,
    reminders: false,
    reminderHour: 8,
    enarmDate: null,
    setEnarmDate: (enarmDate) => set({ enarmDate }),
    setNight: (night, from, to) => set((s) => ({ night, nightFrom: from ?? s.nightFrom, nightTo: to ?? s.nightTo })),
    setReminders: (reminders, hour) => set((s) => ({ reminders, reminderHour: hour ?? s.reminderHour })),
    setTheme: (theme) => set({ theme }),
    setLook: (look) => set({ look }),
    setDark: (dark) => set({ dark }),
    setView: (view) => set({ view }),
    setSplitRatio: (r) => set({ splitRatio: Math.min(0.8, Math.max(0.2, r)) }),
    toggleSwap: () => set((s) => ({ swapPanes: !s.swapPanes })),
    setPaneMode: (paneMode) => set({ paneMode }),
    setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
    setActiveDoc: (activeDocId) => set({ activeDocId, activeNoteId: null }),
    setActiveNote: (activeNoteId) => set({ activeNoteId }),
    setNotebookScope: (notebookScope) => set({ notebookScope, activeNoteId: null }),
    setApiKey: (apiKey) => set({ apiKey }),
    setModel: (model) => set({ model }),
  }),
  {
    key: 'alq:settings',
    storage: 'local',
    pick: ({ theme, look, view, splitRatio, swapPanes, paneMode, activeDocId, activeNoteId, notebookScope, apiKey, model, night, nightFrom, nightTo, reminders, reminderHour, enarmDate }) => ({
      theme, look, view, splitRatio, swapPanes, paneMode, activeDocId, activeNoteId, notebookScope, apiKey, model, night, nightFrom, nightTo, reminders, reminderHour, enarmDate,
    }),
  },
);
