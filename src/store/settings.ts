import { createStore } from '../lib/createStore';
import type { Theme, View } from '../types';

export interface SettingsState {
  theme: Theme;
  /** Estilo visual: «glass» (cristal líquido) o «pistache» (papel mate). */
  look: 'codice';
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
  /** En pantalla de teléfono, «ver todo» sale de Bolsillo y abre la app completa. */
  pocketFull: boolean;
  /** Recordatorios del sistema (Windows) mientras la app está abierta. */
  reminders: boolean;
  /** Hora del aviso diario de flashcards/refuerzo. */
  reminderHour: number;
  /** Ahorro de batería: «auto» se activa al desconectar el cargador. */
  saver: 'auto' | 'on' | 'off';
  setSaver: (v: 'auto' | 'on' | 'off') => void;
  /** Punta predictiva del lápiz (experimental): adelanta el trazo unos milisegundos. */
  inkPredict: boolean;
  setInkPredict: (v: boolean) => void;
  /** Hojas continuas: en cuanto escribes en la última, aparece otra debajo. */
  inkAuto: boolean;
  setInkAuto: (v: boolean) => void;
  /** Margen en blanco junto a la página del PDF, como fracción de su ancho (0 = sin margen). */
  pdfMargin: number;
  setPdfMargin: (v: number) => void;
  /** Transcribir la letra en segundo plano para que entre sola al buscador. */
  inkOcrAuto: boolean;
  setInkOcrAuto: (v: boolean) => void;
  /** Traer solo lo que la otra computadora dejó en la carpeta, cuando aquí no hay nada que perder. */
  syncAuto: boolean;
  setSyncAuto: (v: boolean) => void;
  /** Tus abreviaturas, una por línea («IAM = infarto agudo de miocardio»): ayudan a leer tu letra. */
  inkGlossary: string;
  setInkGlossary: (v: string) => void;
  /** Exigencia del repaso (FSRS): probabilidad de acierto que quieres mantener. */
  retention: number;
  setRetention: (v: number) => void;
  /** Doble plana: dos páginas del PDF una al lado de la otra. */
  pdfSpread: boolean;
  setPdfSpread: (v: boolean) => void;
  /** Recorte de márgenes del PDF en % de cada lado (0 = página completa). */
  pdfCrop: number;
  setPdfCrop: (v: number) => void;
  /** Guías abiertas en pestañas, en orden. */
  openDocs: string[];
  closeDoc: (id: string) => void;
  /** Guías en oscuro: fondo negro y texto claro (solo cambia cómo se ven, no el archivo). */
  pdfDark: boolean;
  setPdfDark: (v: boolean) => void;
  /** Zoom del lienzo de notas (1 = ancho de la hoja). */
  inkZoom: number;
  setInkZoom: (z: number) => void;
  /** Fecha del ENARM (YYYY-MM-DD) para la cuenta regresiva de Inicio. */
  enarmDate: string | null;
  setEnarmDate: (d: string | null) => void;
  setNight: (n: 'off' | 'auto' | 'on', from?: number, to?: number) => void;
  setPocketFull: (on: boolean) => void;
  setReminders: (on: boolean, hour?: number) => void;
  setTheme: (t: Theme) => void;
  setDark: (d: boolean) => void;
  setView: (v: View) => void;
  setSplitRatio: (r: number) => void;
  toggleSwap: () => void;
  setPaneMode: (m: 'both' | 'pdf' | 'notes') => void;
  setLibraryOpen: (o: boolean) => void;
  setActiveDoc: (id: string | null) => void;
  setActiveNote: (id: string | null) => void;
  setNotebookScope: (id: string | null) => void;
  /** Motor de IA: Claude (Anthropic) o Gemini (Google). */
  aiProvider: 'claude' | 'gemini';
  geminiKey: string;
  geminiModel: string;
  setAiProvider: (p: 'claude' | 'gemini') => void;
  setGeminiKey: (k: string) => void;
  setGeminiModel: (m: string) => void;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
}

export const useSettings = createStore<SettingsState>(
  (set) => ({
    theme: 'dark',
    look: 'codice',
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
    pocketFull: false,
    reminders: false,
    reminderHour: 8,
    enarmDate: null,
    inkPredict: false,
    setInkPredict: (inkPredict) => set({ inkPredict }),
    inkAuto: true,
    setInkAuto: (inkAuto) => set({ inkAuto }),
    pdfMargin: 0,
    setPdfMargin: (pdfMargin) => set({ pdfMargin }),
    inkOcrAuto: false,
    setInkOcrAuto: (inkOcrAuto) => set({ inkOcrAuto }),
    syncAuto: false,
    setSyncAuto: (syncAuto) => set({ syncAuto }),
    pdfDark: false,
    setPdfDark: (pdfDark) => set({ pdfDark }),
    inkGlossary: '',
    setInkGlossary: (inkGlossary) => set({ inkGlossary: inkGlossary.slice(0, 4000) }),
    retention: 0.9,
    setRetention: (retention) => set({ retention: Math.min(0.97, Math.max(0.8, retention)) }),
    pdfSpread: false,
    setPdfSpread: (pdfSpread) => set({ pdfSpread }),
    pdfCrop: 0,
    setPdfCrop: (v) => set({ pdfCrop: Math.min(12, Math.max(0, Math.round(v))) }),
    openDocs: [],
    closeDoc: (id) =>
      set((s) => {
        const openDocs = s.openDocs.filter((d) => d !== id);
        if (s.activeDocId !== id) return { openDocs };
        // Al cerrar la pestaña activa pasa a la vecina.
        const i = s.openDocs.indexOf(id);
        const next = openDocs[Math.min(i, openDocs.length - 1)] ?? null;
        return { openDocs, activeDocId: next, activeNoteId: null };
      }),
    inkZoom: 1,
    setInkZoom: (inkZoom) => set({ inkZoom: Math.min(3, Math.max(0.5, Math.round(inkZoom * 100) / 100)) }),
    saver: 'auto',
    setSaver: (saver) => set({ saver }),
    setEnarmDate: (enarmDate) => set({ enarmDate }),
    setPocketFull: (pocketFull) => set({ pocketFull }),
    setNight: (night, from, to) => set((s) => ({ night, nightFrom: from ?? s.nightFrom, nightTo: to ?? s.nightTo })),
    setReminders: (reminders, hour) => set((s) => ({ reminders, reminderHour: hour ?? s.reminderHour })),
    setTheme: (theme) => set({ theme }),
    setDark: (dark) => set({ dark }),
    setView: (view) => set({ view }),
    setSplitRatio: (r) => set({ splitRatio: Math.min(0.8, Math.max(0.2, r)) }),
    toggleSwap: () => set((s) => ({ swapPanes: !s.swapPanes })),
    setPaneMode: (paneMode) => set({ paneMode }),
    setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
    setActiveDoc: (activeDocId) =>
      set((s) => ({
        activeDocId,
        activeNoteId: null,
        openDocs: !activeDocId || s.openDocs.includes(activeDocId) ? s.openDocs : [...s.openDocs, activeDocId].slice(-8),
      })),
    setActiveNote: (activeNoteId) => set({ activeNoteId }),
    setNotebookScope: (notebookScope) => set({ notebookScope, activeNoteId: null }),
    aiProvider: 'claude',
    geminiKey: '',
    geminiModel: 'gemini-2.5-flash',
    setAiProvider: (aiProvider) => set({ aiProvider }),
    setGeminiKey: (geminiKey) => set({ geminiKey }),
    setGeminiModel: (geminiModel) => set({ geminiModel }),
    setApiKey: (apiKey) => set({ apiKey }),
    setModel: (model) => set({ model }),
  }),
  {
    key: 'alq:settings',
    storage: 'local',
    pick: ({ theme, view, splitRatio, swapPanes, paneMode, activeDocId, activeNoteId, notebookScope, apiKey, model, night, nightFrom, nightTo, reminders, reminderHour, enarmDate, saver, inkZoom, inkPredict, inkAuto, pdfMargin, inkOcrAuto, syncAuto, pdfDark, pdfCrop, pdfSpread, retention, inkGlossary, openDocs, aiProvider, geminiKey, geminiModel, pocketFull }) => ({
      theme, view, splitRatio, swapPanes, paneMode, activeDocId, activeNoteId, notebookScope, apiKey, model, night, nightFrom, nightTo, reminders, reminderHour, enarmDate, saver, inkZoom, inkPredict, inkAuto, pdfMargin, inkOcrAuto, syncAuto, pdfDark, pdfCrop, pdfSpread, retention, inkGlossary, openDocs, aiProvider, geminiKey, geminiModel, pocketFull,
    }),
  },
);
