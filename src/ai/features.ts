import { materialFor } from '../exam/generate';
import { sanitizeQuestion, type Question } from '../exam/store';
import { TOPIC } from '../internship/curriculum';
import { topicsForDoc } from '../internship/topicStore';
import { callClaude, parseJson } from '../lib/claude';
import { useLibrary } from '../store/library';

/**
 * Funciones de IA sobre TU material (GPC adjunta, apuntes o subrayados).
 * Todo lo que generan entra como borrador: tú eliges qué se queda.
 */
type Ai = { apiKey: string; model: string };

/* ---------- Mnemotecnias para temas débiles ---------- */

export interface MnemoCandidate {
  title: string;
  text: string;
  explain: string;
}

const MNEMO_SYSTEM = `Eres un médico docente mexicano que prepara a estudiantes para el ENARM.
Crea mnemotecnias en español para memorizar los datos del material que te doy (criterios diagnósticos, factores de riesgo, tratamiento de elección, complicaciones).
Cada una: "title" (la palabra o frase mnemotécnica, p. ej. «CHARCOT»), "text" (qué significa cada letra o parte, en una línea) y "explain" (qué dato del material cubre y cómo usarla, 1–2 frases).
Reglas: usa EXCLUSIVAMENTE el material; no inventes cifras, dosis ni criterios que no estén ahí. Prefiere mnemotecnias cortas y pronunciables.
Responde SOLO con JSON válido: {"mnemonics":[...]}`;

export async function generateMnemonics(topicId: string, ai: Ai, count = 4): Promise<MnemoCandidate[]> {
  const t = TOPIC[topicId];
  const mat = await materialFor(topicId);
  const raw = await callClaude({ ...ai, system: MNEMO_SYSTEM, maxTokens: 3000, user: `Tema: ${t.title}\nCrea ${count} mnemotecnias distintas.\n\n## Material (${mat.docName})\n${mat.text}` });
  const parsed = parseJson(raw) as { mnemonics?: unknown[] };
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const out = (parsed.mnemonics ?? [])
    .map((m) => (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}))
    .map((m) => ({ title: str(m.title, 80), text: str(m.text, 400), explain: str(m.explain, 600) }))
    .filter((m) => m.title && m.text);
  if (!out.length) throw new Error('No llegaron mnemotecnias válidas. Intenta de nuevo.');
  return out;
}

/* ---------- Diagrama / algoritmo del tema ---------- */

export type DiagramKind = 'start' | 'step' | 'decision' | 'end';
export interface DiagramNode {
  id: string;
  label: string;
  kind: DiagramKind;
}
export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}
export interface Diagram {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const DIAGRAM_SYSTEM = `Eres un médico docente. Convierte el material (una GPC mexicana o apuntes) en un algoritmo clínico de diagnóstico y manejo.
Devuelve un grafo dirigido: "nodes" (id corto, "label" de máximo 60 caracteres, "kind": "start" | "step" | "decision" | "end") y "edges" ("from", "to", "label" opcional como «Sí», «No», «>48 h»).
Entre 6 y 16 nodos. Las decisiones tienen 2 o 3 salidas. Sigue el orden del algoritmo de la guía si lo tiene.
Reglas: usa EXCLUSIVAMENTE el material; no inventes dosis ni criterios. Escribe en español.
Responde SOLO con JSON válido: {"title":"...","nodes":[...],"edges":[...]}`;

export function sanitizeDiagram(raw: unknown): Diagram {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kinds: DiagramKind[] = ['start', 'step', 'decision', 'end'];
  const nodes: DiagramNode[] = (Array.isArray(r.nodes) ? r.nodes : [])
    .map((n) => (n && typeof n === 'object' ? (n as Record<string, unknown>) : {}))
    .map((n) => ({ id: String(n.id ?? '').slice(0, 20), label: String(n.label ?? '').trim().slice(0, 80), kind: (kinds.includes(n.kind as DiagramKind) ? n.kind : 'step') as DiagramKind }))
    .filter((n, i, a) => n.id && n.label && a.findIndex((x) => x.id === n.id) === i)
    .slice(0, 24);
  const ids = new Set(nodes.map((n) => n.id));
  const edges: DiagramEdge[] = (Array.isArray(r.edges) ? r.edges : [])
    .map((e) => (e && typeof e === 'object' ? (e as Record<string, unknown>) : {}))
    .map((e) => ({ from: String(e.from ?? ''), to: String(e.to ?? ''), label: typeof e.label === 'string' ? e.label.slice(0, 24) : undefined }))
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  if (nodes.length < 2) throw new Error('El diagrama llegó vacío. Intenta de nuevo.');
  return { title: typeof r.title === 'string' ? r.title.slice(0, 100) : 'Algoritmo', nodes, edges };
}

export async function generateDiagram(topicId: string, ai: Ai): Promise<Diagram> {
  const t = TOPIC[topicId];
  const mat = await materialFor(topicId);
  const raw = await callClaude({ ...ai, system: DIAGRAM_SYSTEM, maxTokens: 3000, user: `Tema: ${t.title}\n\n## Material (${mat.docName})\n${mat.text}` });
  return sanitizeDiagram(parseJson(raw));
}

/* ---------- Preguntas rápidas desde tus subrayados ---------- */

const HL_SYSTEM = `Eres un médico docente. Con los fragmentos que el estudiante subrayó en su guía, redacta preguntas rápidas de opción múltiple tipo ENARM (caso breve de 2–3 líneas).
Formato por pregunta: "vignette", "question", "options" (4, cada una con "text" y "why"), "correct" (0–3), "page" (la página [p. N] del fragmento que la sustenta).
Reglas: usa SOLO los fragmentos; no inventes datos que no estén ahí. Español de México.
Responde SOLO con JSON válido: {"questions":[...]}`;

export async function questionsFromHighlights(docId: string, ai: Ai, count = 4): Promise<Omit<Question, 'id' | 'createdAt'>[]> {
  const lib = useLibrary.getState();
  const doc = lib.docs.find((d) => d.id === docId);
  const hls = (lib.highlights[docId] ?? []).filter((h) => h.text.trim().length > 12).sort((a, b) => a.page - b.page);
  if (!hls.length) throw new Error('Tus resaltados de este PDF no tienen texto (¿PDF escaneado?). Subraya texto seleccionable.');
  let material = '';
  for (const h of hls) {
    const line = `[p. ${h.page}] ${h.text.trim()}\n`;
    if (material.length + line.length > 30_000) break;
    material += line;
  }
  const raw = await callClaude({ ...ai, system: HL_SYSTEM, maxTokens: 5000, user: `Documento: ${doc?.name ?? 'PDF'}\nGenera ${count} preguntas.\n\n## Subrayados\n${material}` });
  const parsed = parseJson(raw) as { questions?: unknown[] };
  const topicId = topicsForDoc(docId)[0] ?? null;
  const out: Omit<Question, 'id' | 'createdAt'>[] = [];
  for (const r of parsed.questions ?? []) {
    const q = sanitizeQuestion(r);
    if (!q) continue;
    const page = Number((r as Record<string, unknown>).page);
    out.push({ ...q, topicId, cite: Number.isInteger(page) && page > 0 ? { docId, docName: doc?.name ?? 'PDF', page } : null, origin: 'ia', reviewed: false });
  }
  if (!out.length) throw new Error('No llegaron preguntas válidas. Intenta de nuevo.');
  return out;
}

/* ---------- Dibujo del diagrama (capas, de arriba abajo) ---------- */

export function layoutDiagram(d: Diagram) {
  const incoming = new Map<string, number>();
  d.nodes.forEach((n) => incoming.set(n.id, 0));
  d.edges.forEach((e) => incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1));
  const level = new Map<string, number>();
  const roots = d.nodes.filter((n) => n.kind === 'start' || !incoming.get(n.id));
  const queue = (roots.length ? roots : [d.nodes[0]]).map((n) => n.id);
  queue.forEach((id) => level.set(id, 0));
  // BFS acotado (tolera ciclos).
  for (let i = 0; i < queue.length && i < 400; i++) {
    const id = queue[i];
    const l = level.get(id)!;
    for (const e of d.edges)
      if (e.from === id && !level.has(e.to)) {
        level.set(e.to, l + 1);
        queue.push(e.to);
      }
  }
  let maxL = Math.max(0, ...level.values());
  for (const n of d.nodes) if (!level.has(n.id)) level.set(n.id, ++maxL);
  const rows: string[][] = [];
  for (const n of d.nodes) (rows[level.get(n.id)!] ??= []).push(n.id);
  return rows.filter(Boolean);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

/** Dibuja el diagrama en un PNG (fondo claro, para pegarlo en el lienzo y rayar encima). */
export function renderDiagram(d: Diagram, scale = 2): string {
  const rows = layoutDiagram(d);
  const BW = 210;
  const BH = 64;
  const GX = 40;
  const GY = 62;
  const cols = Math.max(...rows.map((r) => r.length));
  const W = Math.max(520, cols * BW + (cols - 1) * GX + 80);
  const H = 90 + rows.length * BH + (rows.length - 1) * GY + 40;
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fdfdf8';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f2a1c';
  ctx.font = '600 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.title, W / 2, 34);
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((r, li) => {
    const rowW = r.length * BW + (r.length - 1) * GX;
    r.forEach((id, i) => pos.set(id, { x: (W - rowW) / 2 + i * (BW + GX) + BW / 2, y: 70 + li * (BH + GY) + BH / 2 }));
  });
  // Flechas.
  ctx.strokeStyle = '#5b7f35';
  ctx.fillStyle = '#5b7f35';
  ctx.lineWidth = 1.6;
  ctx.font = '12px "Segoe UI", sans-serif';
  for (const e of d.edges) {
    const a = pos.get(e.from)!;
    const b = pos.get(e.to)!;
    const down = b.y > a.y;
    const y1 = a.y + (down ? BH / 2 : -BH / 2);
    const y2 = b.y + (down ? -BH / 2 : BH / 2);
    ctx.beginPath();
    ctx.moveTo(a.x, y1);
    ctx.bezierCurveTo(a.x, (y1 + y2) / 2, b.x, (y1 + y2) / 2, b.x, y2);
    ctx.stroke();
    const dir = down ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(b.x, y2);
    ctx.lineTo(b.x - 5, y2 + 9 * dir);
    ctx.lineTo(b.x + 5, y2 + 9 * dir);
    ctx.fill();
    if (e.label) {
      const mx = (a.x + b.x) / 2;
      const my = (y1 + y2) / 2;
      const w = ctx.measureText(e.label).width + 10;
      ctx.fillStyle = '#fdfdf8';
      ctx.fillRect(mx - w / 2, my - 9, w, 18);
      ctx.fillStyle = '#4c6c2b';
      ctx.fillText(e.label, mx, my + 4);
      ctx.fillStyle = '#5b7f35';
    }
  }
  // Cajas.
  ctx.font = '13px "Segoe UI", sans-serif';
  for (const n of d.nodes) {
    const p = pos.get(n.id)!;
    const x = p.x - BW / 2;
    const y = p.y - BH / 2;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = n.kind === 'decision' ? '#b0703a' : n.kind === 'end' ? '#4a86a8' : '#5b7f35';
    ctx.fillStyle = n.kind === 'decision' ? '#fbf1e6' : n.kind === 'end' ? '#e9f2f7' : n.kind === 'start' ? '#eef4e6' : '#ffffff';
    ctx.beginPath();
    if (n.kind === 'decision') {
      ctx.moveTo(p.x, y - 6);
      ctx.lineTo(x + BW + 8, p.y);
      ctx.lineTo(p.x, y + BH + 6);
      ctx.lineTo(x - 8, p.y);
      ctx.closePath();
    } else {
      const r = n.kind === 'step' ? 4 : 30;
      ctx.roundRect(x, y, BW, BH, r);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1f2a1c';
    const lines = wrap(ctx, n.label, n.kind === 'decision' ? BW - 50 : BW - 18);
    lines.forEach((l, i) => ctx.fillText(l, p.x, p.y + 4 + (i - (lines.length - 1) / 2) * 15));
  }
  return c.toDataURL('image/png');
}
