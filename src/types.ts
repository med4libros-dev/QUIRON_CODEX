export type Theme = 'light' | 'dark' | 'system';
export type View = 'internado' | 'study' | 'notebooks' | 'calendar' | 'progress' | 'hy' | 'exam' | 'ward' | 'logbook';

/* ---------- Biblioteca / PDF ---------- */
export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple' | 'red';
/** Rectángulo normalizado (0–1) relativo a la página: no depende del zoom. */
export interface NRect { x: number; y: number; w: number; h: number }
export interface Highlight {
  id: string;
  page: number;
  rect: NRect;
  color: HighlightColor;
  /** Texto detectado bajo el resaltado (vacío en PDFs escaneados). */
  text: string;
  /** 'box' = resaltado de área; 'underline' = subrayado. */
  style?: 'box' | 'underline';
  /** Grosor del subrayado en px (a 100% de zoom). */
  thickness?: number;
  createdAt: number;
}

/** Marcador de página del PDF. */
export type KeyPageKind = 'algoritmo' | 'tabla' | 'dosis' | 'criterios';
export const KEY_PAGE_LABEL: Record<KeyPageKind, string> = { algoritmo: 'Algoritmo', tabla: 'Tabla', dosis: 'Dosis', criterios: 'Criterios' };
export interface Bookmark {
  id: string;
  page: number;
  label: string;
  /** Página clave de la GPC (algoritmo, tabla…). Sin tipo = marcador normal. */
  kind?: KeyPageKind;
  createdAt: number;
}

/** Post-it sobre una página del PDF (posición normalizada 0–1). */
export interface Sticky {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  color: string;
  open: boolean;
  createdAt: number;
}
export interface DocMeta {
  id: string;
  name: string;
  size: number;
  subjectId: string | null;
  addedAt: number;
  lastPage: number;
  pageCount: number;
}

/* ---------- Notas ---------- */
/** Instrumentos de escritura: cada uno conserva su propio color y grosor. */
export type DrawTool = 'pen' | 'pencil' | 'marker' | 'highlighter';
export type InkTool = DrawTool | 'eraser' | 'lasso';
/** Trazo en coordenadas lógicas de página (ancho 1000). points: [x, y, presión]. */
export interface Stroke {
  id: string;
  page: number;
  tool: DrawTool;
  color: string;
  size: number;
  points: number[][];
}
export type PaperStyle = 'blank' | 'lined' | 'grid' | 'cornell' | 'columns';
/** Cuaderno: agrupa notas por materia o por tema, sin importar de qué PDF vengan. */
export interface Notebook {
  id: string;
  name: string;
  subjectId: string | null;
  color: string;
  createdAt: number;
}

export interface Note {
  id: string;
  /** PDF de origen (null = nota sin PDF). */
  docId: string | null;
  /** Cuaderno al que pertenece (null = sin cuaderno). */
  notebookId?: string | null;
  title: string;
  html: string;
  inkPages: number;
  paper: PaperStyle;
  kind: 'manual' | 'synth';
  createdAt: number;
  updatedAt: number;
}

/* ---------- Planeación y progreso ---------- */
export interface Subject { id: string; name: string; color: string }
export interface StudySession {
  id: string;
  /** Fecha local en formato YYYY-MM-DD. */
  date: string;
  topic: string;
  subjectId: string | null;
  minutes: number;
  done: boolean;
  docId: string | null;
}
export type GoalMetric = 'focusMinutes' | 'sessionsDone';
export type GoalPeriod = 'week' | 'month' | 'total';
export interface Goal {
  id: string;
  title: string;
  metric: GoalMetric;
  target: number;
  period: GoalPeriod;
  subjectId: string | null;
  createdAt: number;
}
export interface FocusLog { id: string; date: string; minutes: number; subjectId: string | null; at: number }

export const HIGHLIGHT_ORDER: HighlightColor[] = ['yellow', 'green', 'pink', 'blue', 'orange', 'purple', 'red'];
export const HIGHLIGHT_META: Record<HighlightColor, { label: string; fill: string; solid: string }> = {
  yellow: { label: 'Concepto clave', fill: 'rgba(250, 204, 21, 0.38)', solid: '#eab308' },
  green: { label: 'Definición', fill: 'rgba(74, 222, 128, 0.36)', solid: '#22c55e' },
  pink: { label: 'Perla clínica / ENARM', fill: 'rgba(244, 114, 182, 0.36)', solid: '#ec4899' },
  blue: { label: 'Duda / repasar', fill: 'rgba(96, 165, 250, 0.36)', solid: '#3b82f6' },
  orange: { label: 'Fisiopatología', fill: 'rgba(251, 146, 60, 0.36)', solid: '#f97316' },
  purple: { label: 'Fármacos / dosis', fill: 'rgba(167, 139, 250, 0.38)', solid: '#8b5cf6' },
  red: { label: 'Urgencia / dato de alarma', fill: 'rgba(248, 113, 113, 0.36)', solid: '#ef4444' },
};
