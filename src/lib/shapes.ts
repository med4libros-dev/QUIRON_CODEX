import type { Stroke } from '../types';

/**
 * Formas rectas: si dejas el lápiz quieto al final de un trazo, se reconoce línea, flecha,
 * rectángulo o elipse y se sustituye por la forma limpia. Los puntos se generan densos
 * (cada ~8 unidades) para que el borrador y el lazo los toquen igual que a un trazo normal.
 */
export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';
type P = number[];

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = (n: number) => Math.round(n * 10) / 10;

function segment(a: P, b: P, out: P[]) {
  const n = Math.max(1, Math.ceil(dist(a, b) / 8));
  for (let i = out.length ? 1 : 0; i <= n; i++) out.push([r1(a[0] + ((b[0] - a[0]) * i) / n), r1(a[1] + ((b[1] - a[1]) * i) / n), 0.5]);
}
const poly = (pts: P[]) => {
  const out: P[] = [];
  for (let i = 1; i < pts.length; i++) segment(pts[i - 1], pts[i], out);
  return out;
};

export function recognizeShape(pts: P[]): { kind: ShapeKind; points: P[] } | null {
  if (pts.length < 8) return null;
  let len = 0;
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push((len += dist(pts[i - 1], pts[i])));
  if (len < 40) return null;
  const a = pts[0];
  const b = pts[pts.length - 1];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  const w = x1 - x0;
  const h = y1 - y0;
  const diag = Math.hypot(w, h);

  // Línea: casi todo el recorrido va directo del inicio al final.
  if (dist(a, b) / len > 0.93) return { kind: 'line', points: poly([a, b]) };

  // Flecha: recta hasta la punta y un regreso corto que dibuja la cabeza.
  let tip = 0;
  for (let i = 1; i < pts.length; i++) if (dist(a, pts[i]) > dist(a, pts[tip])) tip = i;
  const shaft = dist(a, pts[tip]);
  const tail = len - acc[tip];
  if (tip > 3 && shaft / acc[tip] > 0.93 && tail > shaft * 0.06 && tail < shaft * 0.6) {
    const t = pts[tip];
    const ang = Math.atan2(t[1] - a[1], t[0] - a[0]);
    const hl = Math.min(34, Math.max(14, shaft * 0.16));
    const wing = (s: number): P => [t[0] - hl * Math.cos(ang + s * 0.45), t[1] - hl * Math.sin(ang + s * 0.45)];
    return { kind: 'arrow', points: poly([a, t, wing(1), t, wing(-1)]) };
  }

  // Figura cerrada: el final vuelve cerca del inicio.
  if (dist(a, b) < Math.max(24, diag * 0.22) && w > 16 && h > 16) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    let eErr = 0;
    let rErr = 0;
    for (const p of pts) {
      const nx = (p[0] - cx) / (w / 2);
      const ny = (p[1] - cy) / (h / 2);
      eErr += Math.abs(Math.hypot(nx, ny) - 1);
      rErr += Math.min(Math.abs(p[0] - x0), Math.abs(p[0] - x1), Math.abs(p[1] - y0), Math.abs(p[1] - y1)) / (Math.min(w, h) / 2);
    }
    eErr /= pts.length;
    rErr /= pts.length;
    if (Math.min(eErr, rErr) > 0.24) return null;
    if (rErr < eErr) return { kind: 'rect', points: poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]) };
    const n = Math.max(40, Math.ceil((Math.PI * (w + h)) / 2 / 8));
    const out: P[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      out.push([r1(cx + (w / 2) * Math.cos(t)), r1(cy + (h / 2) * Math.sin(t)), 0.5]);
    }
    return { kind: 'ellipse', points: out };
  }
  return null;
}

/* ---------- Lazo ---------- */

export function pointInPolygon(x: number, y: number, poly: P[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Trazos con al menos el 60 % de sus puntos dentro del lazo. */
export function strokesInLasso(strokes: Stroke[], lasso: P[]): string[] {
  if (lasso.length < 3) return [];
  return strokes
    .filter((s) => {
      let n = 0;
      for (const p of s.points) if (pointInPolygon(p[0], p[1], lasso)) n++;
      return n >= s.points.length * 0.6;
    })
    .map((s) => s.id);
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function strokesBox(strokes: Stroke[]): Box | null {
  if (!strokes.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of strokes)
    for (const p of s.points) {
      x0 = Math.min(x0, p[0] - s.size / 2);
      y0 = Math.min(y0, p[1] - s.size / 2);
      x1 = Math.max(x1, p[0] + s.size / 2);
      y1 = Math.max(y1, p[1] + s.size / 2);
    }
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Mover (dx, dy) y escalar (s) alrededor del origen (ox, oy). */
export interface Xf {
  dx: number;
  dy: number;
  s: number;
  ox: number;
  oy: number;
}
export const applyXf = (st: Stroke, f: Xf): Stroke => ({
  ...st,
  size: Math.max(0.5, r1(st.size * f.s)),
  points: st.points.map((p) => [r1(f.ox + (p[0] - f.ox) * f.s + f.dx), r1(f.oy + (p[1] - f.oy) * f.s + f.dy), p[2] ?? 0.5]),
});

/* ---------- Flujogramas ---------- */

/** Caja de un trazo, en coordenadas de hoja. */
const boxOf = (pts: P[]) => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[1] > y1) y1 = p[1];
  }
  return { x0, y0, x1, y1 };
};

/** ¿Este trazo parece una caja (rectángulo cerrado) de al menos 60 × 30? */
function looksLikeBox(s: Stroke): boolean {
  const b = boxOf(s.points);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w < 60 || h < 30) return false;
  const a = s.points[0];
  const z = s.points[s.points.length - 1];
  return Math.hypot(a[0] - z[0], a[1] - z[1]) < Math.min(w, h) * 0.4;
}

/** Punto del borde de la caja más cercano a `p` (sin entrar en la caja). */
function edgePoint(b: { x0: number; y0: number; x1: number; y1: number }, p: P): P {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const dx = p[0] - cx;
  const dy = p[1] - cy;
  // El lado al que apunta: el eje con mayor desplazamiento relativo manda.
  const rx = Math.abs(dx) / Math.max(1, (b.x1 - b.x0) / 2);
  const ry = Math.abs(dy) / Math.max(1, (b.y1 - b.y0) / 2);
  if (rx > ry) return [dx > 0 ? b.x1 : b.x0, Math.min(b.y1, Math.max(b.y0, p[1])), 0.5];
  return [Math.min(b.x1, Math.max(b.x0, p[0])), dy > 0 ? b.y1 : b.y0, 0.5];
}

/**
 * Engancha una flecha recién reconocida a las cajas que tenga cerca: si su punta o su cola
 * caen a menos de `snap` de una caja, se pegan al borde de esa caja. Así un algoritmo
 * dibujado a mano queda conectado de verdad y no con flechas que no llegan.
 *
 * Devuelve los puntos corregidos, o los mismos si no había nada cerca.
 */
export function snapArrowToBoxes(points: P[], others: Stroke[], snap = 46): P[] {
  if (points.length < 2) return points;
  const boxes = others.filter(looksLikeBox).map((s) => boxOf(s.points));
  if (!boxes.length) return points;
  const near = (p: P) =>
    boxes
      .map((b) => ({ b, d: Math.hypot(p[0] - Math.min(b.x1, Math.max(b.x0, p[0])), p[1] - Math.min(b.y1, Math.max(b.y0, p[1]))) }))
      .filter((x) => x.d <= snap)
      .sort((a, z) => a.d - z.d)[0]?.b;

  const tail = points[0];
  const head = points[points.length - 1];
  const bTail = near(tail);
  const bHead = near(head);
  if (!bTail && !bHead) return points;
  const a = bTail ? edgePoint(bTail, head) : tail;
  const z = bHead ? edgePoint(bHead, tail) : head;
  if (Math.hypot(a[0] - z[0], a[1] - z[1]) < 12) return points;
  return arrowPoints(a, z);
}

/** Flecha limpia entre dos puntos (línea + punta). */
function arrowPoints(a: P, b: P): P[] {
  const out: P[] = [];
  segment(a, b, out);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const len = Math.min(26, dist(a, b) * 0.3);
  for (const s of [1, -1]) {
    const tip: P[] = [];
    segment(b, [r1(b[0] - len * Math.cos(ang - (s * Math.PI) / 7)), r1(b[1] - len * Math.sin(ang - (s * Math.PI) / 7)), 0.5], tip);
    out.push(...tip);
  }
  return out;
}

export type FlowTemplate = 'algoritmo' | 'si-no' | 'tres-pasos';

export const FLOW_TEMPLATES: { id: FlowTemplate; label: string; hint: string }[] = [
  { id: 'algoritmo', label: 'Algoritmo diagnóstico', hint: 'Sospecha → prueba → rombo sí/no → dos ramas' },
  { id: 'si-no', label: 'Decisión sí / no', hint: 'Un rombo con dos salidas' },
  { id: 'tres-pasos', label: 'Tres pasos en columna', hint: 'Tres cajas encadenadas' },
];

const rect = (x: number, y: number, w: number, h: number): P[] =>
  poly([
    [x, y, 0.5],
    [x + w, y, 0.5],
    [x + w, y + h, 0.5],
    [x, y + h, 0.5],
    [x, y, 0.5],
  ]);

const diamond = (cx: number, cy: number, w: number, h: number): P[] =>
  poly([
    [cx, cy - h / 2, 0.5],
    [cx + w / 2, cy, 0.5],
    [cx, cy + h / 2, 0.5],
    [cx - w / 2, cy, 0.5],
    [cx, cy - h / 2, 0.5],
  ]);

/**
 * Esqueleto de flujograma en tinta: cajas, rombos y flechas vacíos para que escribas dentro.
 * Son trazos normales, así que el lazo los mueve y el borrador los quita como a todo lo demás.
 */
export function flowTemplate(kind: FlowTemplate, pageW = 1000): P[][] {
  const m = pageW * 0.12;
  const w = pageW - m * 2;
  const bw = Math.min(360, w * 0.46);
  const cx = pageW / 2;
  if (kind === 'tres-pasos') {
    const out: P[][] = [];
    for (let i = 0; i < 3; i++) {
      const y = 140 + i * 190;
      out.push(rect(cx - bw / 2, y, bw, 100));
      if (i < 2) out.push(arrowPoints([cx, y + 100, 0.5], [cx, y + 185, 0.5]));
    }
    return out;
  }
  if (kind === 'si-no') {
    return [
      diamond(cx, 220, bw, 170),
      arrowPoints([cx - bw / 2, 220, 0.5], [cx - bw / 2 - 90, 220, 0.5]),
      arrowPoints([cx + bw / 2, 220, 0.5], [cx + bw / 2 + 90, 220, 0.5]),
      rect(m, 160, 150, 120),
      rect(pageW - m - 150, 160, 150, 120),
    ];
  }
  return [
    rect(cx - bw / 2, 110, bw, 90),
    arrowPoints([cx, 200, 0.5], [cx, 265, 0.5]),
    rect(cx - bw / 2, 265, bw, 90),
    arrowPoints([cx, 355, 0.5], [cx, 420, 0.5]),
    diamond(cx, 500, bw, 160),
    arrowPoints([cx - bw / 2, 500, 0.5], [m + 160, 500, 0.5]),
    arrowPoints([cx + bw / 2, 500, 0.5], [pageW - m - 160, 500, 0.5]),
    rect(m, 580, 170, 110),
    rect(pageW - m - 170, 580, 170, 110),
  ];
}
