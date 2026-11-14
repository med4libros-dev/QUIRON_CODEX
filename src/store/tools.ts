import { createStore } from '../lib/createStore';
import type { DrawTool, HighlightColor } from '../types';

export interface ToolSetting {
  color: string;
  size: number;
}

export interface ToolsState {
  /** Color y grosor recordados por instrumento (compartidos entre el lienzo y el PDF). */
  settings: Record<DrawTool, ToolSetting>;
  /** Último instrumento usado en el lienzo y en el PDF. */
  canvasTool: DrawTool;
  pdfTool: DrawTool;
  hlColor: HighlightColor;
  underlineWidth: number;
  stickyColor: string;
  /** Solo el lápiz escribe; la mano/palma (touch) solo desplaza. Activado por defecto. */
  penOnly: boolean;
  setPenOnly: (v: boolean) => void;
  setToolSetting: (tool: DrawTool, patch: Partial<ToolSetting>) => void;
  setCanvasTool: (t: DrawTool) => void;
  setPdfTool: (t: DrawTool) => void;
  setHlColor: (c: HighlightColor) => void;
  setUnderlineWidth: (w: number) => void;
  setStickyColor: (c: string) => void;
}

export const STICKY_COLORS = ['#fef08a', '#bbf7d0', '#fbcfe8', '#bfdbfe', '#fed7aa', '#ddd6fe'];

export const useTools = createStore<ToolsState>(
  (set) => ({
    settings: {
      pen: { color: 'auto', size: 3 },
      pencil: { color: '#6b7280', size: 2 },
      marker: { color: '#2563eb', size: 7 },
      highlighter: { color: '#facc15', size: 20 },
    },
    canvasTool: 'pen',
    pdfTool: 'pen',
    hlColor: 'yellow',
    underlineWidth: 3,
    stickyColor: STICKY_COLORS[0],
    penOnly: true,
    setPenOnly: (penOnly) => set({ penOnly }),
    setToolSetting: (tool, patch) => set((s) => ({ settings: { ...s.settings, [tool]: { ...s.settings[tool], ...patch } } })),
    setCanvasTool: (canvasTool) => set({ canvasTool }),
    setPdfTool: (pdfTool) => set({ pdfTool }),
    setHlColor: (hlColor) => set({ hlColor }),
    setUnderlineWidth: (underlineWidth) => set({ underlineWidth }),
    setStickyColor: (stickyColor) => set({ stickyColor }),
  }),
  {
    key: 'alq:tools',
    storage: 'local',
    pick: ({ settings, canvasTool, pdfTool, hlColor, underlineWidth, stickyColor, penOnly }) => ({
      settings, canvasTool, pdfTool, hlColor, underlineWidth, stickyColor, penOnly,
    }),
  },
);
