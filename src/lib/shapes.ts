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
