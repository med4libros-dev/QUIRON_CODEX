import type { DrawTool, Stroke } from '../types';

/** Espacio lógico de una hoja del lienzo (proporción A4). Independiente del tamaño de pantalla. */
export const PAGE_W = 1000;
export const PAGE_H = 1414;

export type StrokeLike = Pick<Stroke, 'tool' | 'color' | 'size' | 'points'>;

/** Catálogo de instrumentos: nombre, rango de grosor y paleta sugerida. */
export const DRAW_TOOLS: Record<DrawTool, { label: string; min: number; max: number; palette: string[] }> = {
  pen: {
    label: 'Pluma',
    min: 1,
    max: 16,
    palette: ['auto', '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be185d'],
  },
  pencil: {
    label: 'Lápiz',
    min: 1,
    max: 10,
    palette: ['#6b7280', 'auto', '#1d4ed8', '#b91c1c', '#15803d', '#7e22ce', '#a16207', '#0f766e'],
  },
  marker: {
    label: 'Rotulador',
    min: 3,
    max: 24,
    palette: ['#2563eb', '#dc2626', '#16a34a', '#111827', '#9333ea', '#ea580c', '#0891b2', '#db2777'],
  },
  highlighter: {
    label: 'Marcatextos',
    min: 8,
    max: 48,
    palette: ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c', '#a78bfa', '#f87171', '#2dd4bf'],
  },
};

export function inkColor(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1f2937';
}

/** El mouse reporta presión fija 0.5; un lápiz (Surface Pen) reporta valores variables. */
export const hasRealPressure = (pts: number[][]) => pts.some((p) => p[2] !== undefined && Math.abs(p[2] - 0.5) > 0.02);

function tracePath(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  if (pts.length > 1) ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeLike, autoColor: string) {
  const pts = s.points;
  if (!pts.length) return;
  const color = s.color === 'auto' ? autoColor : s.color;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Rotulador y marcatextos: ancho constante, un solo trazado (sin manchas en las uniones).
  if (s.tool === 'highlighter' || s.tool === 'marker') {
    if (s.tool === 'highlighter') {
      ctx.globalAlpha = 0.32;
      ctx.lineCap = 'butt';
    }
    ctx.lineWidth = s.size;
    tracePath(ctx, pts);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Pluma y lápiz: el grosor sigue la presión del lápiz digital.
  const real = hasRealPressure(pts);
  const pencil = s.tool === 'pencil';
  if (pencil) ctx.globalAlpha = 0.78;
  const widthAt = (p: number | undefined) => {
    if (!real) return s.size;
    const pr = p ?? 0.5;
    return pencil ? s.size * (0.45 + pr * 0.8) : s.size * (0.3 + pr * 1.15);
  };

  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], widthAt(pts[0][2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (!real) {
    ctx.lineWidth = s.size;
    tracePath(ctx, pts);
    ctx.stroke();
    ctx.restore();
    return;
  }
  let px = pts[0][0];
  let py = pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, p0] = pts[i - 1];
    const [x1, y1, p1] = pts[i];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(x0, y0, mx, my);
    ctx.lineWidth = widthAt(((p0 ?? 0.5) + (p1 ?? 0.5)) / 2);
    ctx.stroke();
    px = mx;
    py = my;
  }
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(last[0], last[1]);
  ctx.lineWidth = widthAt(last[2]);
  ctx.stroke();
  ctx.restore();
}

/** ¿El punto (x, y) toca el trazo? Para el borrador. */
export function hitsStroke(s: StrokeLike, x: number, y: number, radius: number): boolean {
  const r = radius + s.size / 2;
  return s.points.some((p) => Math.abs(p[0] - x) < r && Math.abs(p[1] - y) < r);
}

/** Renderiza una hoja a PNG (fondo blanco) para exportar. */
export async function renderInkPage(
  strokes: StrokeLike[],
  widthPx: number,
  images: { x: number; y: number; w: number; h: number; src: string }[] = [],
): Promise<string> {
  const c = document.createElement('canvas');
  const k = widthPx / PAGE_W;
  c.width = widthPx;
  c.height = Math.round(PAGE_H * k);
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  for (const im of images) {
    const el = await new Promise<HTMLImageElement | null>((res) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = im.src;
    });
    if (el) ctx.drawImage(el, im.x, im.y, im.w, im.h);
  }
  for (const s of strokes) drawStroke(ctx, s, '#111827');
  return c.toDataURL('image/png');
}

/* ---------- Trazo en vivo de baja latencia ----------
 * Antes: cada movimiento esperaba al siguiente cuadro (requestAnimationFrame) y redibujaba el trazo
 * completo, cada vez más largo. Ahora cada punto nuevo se dibuja al instante y solo su tramo, en un
 * canvas «desincronizado» (sale a pantalla sin esperar al compositor), y la punta se adelanta con los
 * puntos que predice el sistema. Al soltar, el trazo definitivo se dibuja con drawStroke como siempre.
 */

/** Contexto 2D; los canvas en vivo (data-live) piden el modo de baja latencia. */
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return c.getContext('2d');
}

/** Suavizado adaptable: quita el temblor al escribir despacio y no retrasa nada en trazos rápidos. */
export function stabilize(last: number[], p: number[]) {
  const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
  const a = d >= 5 ? 1 : 0.6 + 0.08 * d;
  p[0] = Math.round((last[0] + (p[0] - last[0]) * a) * 10) / 10;
  p[1] = Math.round((last[1] + (p[1] - last[1]) * a) * 10) / 10;
}

const tipDirty = new WeakMap<CanvasRenderingContext2D, [number, number, number, number]>();

export interface LiveStyle {
  tool: StrokeLike['tool'];
  color: string;
  size: number;
  /** El lápiz digital reporta presión real; el mouse y el dedo no. */
  pressure: boolean;
}

const liveWidth = (st: LiveStyle, p: number | undefined) => {
  if (st.tool === 'highlighter' || st.tool === 'marker' || !st.pressure) return st.size;
  const pr = p ?? 0.5;
  return st.tool === 'pencil' ? st.size * (0.45 + pr * 0.8) : st.size * (0.3 + pr * 1.15);
};

/** Opacidad del trazo en vivo: se aplica al canvas entero para que los tramos no se oscurezcan al encimarse. */
export const liveOpacity = (tool: StrokeLike['tool']) => (tool === 'highlighter' ? 0.32 : tool === 'pencil' ? 0.78 : 1);

const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Dibuja solo los tramos nuevos (desde el índice `from`) con la misma geometría que drawStroke. Devuelve el nuevo `from`. */
export function drawLiveSegments(ctx: CanvasRenderingContext2D, pts: number[][], from: number, st: LiveStyle, color: string): number {
  ctx.lineCap = st.tool === 'highlighter' ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  if (from === 0 && pts.length) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], liveWidth(st, pts[0][2]) / 2, 0, Math.PI * 2);
    if (st.tool !== 'highlighter') ctx.fill();
    from = 1;
  }
  for (let i = Math.max(from, 1); i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const start = i === 1 ? a : mid(pts[i - 2], a);
    const end = mid(a, b);
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.quadraticCurveTo(a[0], a[1], end[0], end[1]);
    ctx.lineWidth = liveWidth(st, ((a[2] ?? 0.5) + (b[2] ?? 0.5)) / 2);
    ctx.stroke();
  }
  return pts.length;
}

/**
 * Punta del trazo: el último medio tramo (de la última mitad al punto real) más los puntos predichos.
 * Va en un canvas aparte que se borra en cada evento, así la predicción nunca queda en el dibujo.
 */
export function drawLiveTip(ctx: CanvasRenderingContext2D, pts: number[][], predicted: number[][], st: LiveStyle, color: string) {
  // Solo se borra la zona que ocupaba la punta anterior (borrar la hoja entera en cada evento era lento).
  const d = tipDirty.get(ctx);
  if (d) ctx.clearRect(d[0], d[1], d[2], d[3]);
  tipDirty.delete(ctx);
  if (pts.length < 2 && !predicted.length) return;
  const last = pts[pts.length - 1];
  const start = pts.length >= 2 ? mid(pts[pts.length - 2], last) : last;
  const lw = liveWidth(st, last[2]);
  ctx.lineCap = st.tool === 'highlighter' ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 1;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  ctx.lineTo(last[0], last[1]);
  let x0 = Math.min(start[0], last[0]);
  let y0 = Math.min(start[1], last[1]);
  let x1 = Math.max(start[0], last[0]);
  let y1 = Math.max(start[1], last[1]);
  for (const p of predicted) {
    ctx.lineTo(p[0], p[1]);
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  ctx.stroke();
  const pad = lw + 3;
  tipDirty.set(ctx, [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2]);
}
