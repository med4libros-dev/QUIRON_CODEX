import { HIGHLIGHT_META, HIGHLIGHT_ORDER } from '../../types';
import { escapeHtml as esc } from '../html';
import type { SynthInput } from './types';

/**
 * Motor de síntesis local (sin internet, sin costo): extractivo.
 * Prioriza lo que TÚ resaltaste (peso ×3) y tus notas (×2) sobre el texto bruto del PDF,
 * y arma una hoja de repaso: conceptos clave, ideas principales, resaltados por categoría
 * y preguntas de autoevaluación tipo "completa el espacio".
 */
const STOP = new Set(
  `a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque cada casi como con contra cual
  cuales cualquier cuando cuanto de del desde donde dos durante el ella ellas ellos en entre era eran es esa esas
  ese eso esos esta estaba estan estar estas este esto estos fue fueron gran ha haber habia han hasta hay hace hacen
  la las le les lo los mas me menos mi mientras mismo misma muy nada ni no nos o otra otras otro otros para pero
  poco por porque puede pueden pues que quien se sea sean segun ser si sido sin sobre solo son su sus tal tambien
  tan tanto te tiene tienen todo todos tras tu un una unas uno unos usted y ya ademas debe deben dicho entonces
  forma general generalmente incluso mayor menor mediante parte partes primer primera tipo tipos traves vez veces
  ver vease tabla figura cuadro caso casos ejemplo nivel niveles the and of to in is are for with as by on that
  this from be or an at`.split(/\s+/),
);

const norm = (w: string) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const WORD = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9-]{2,}/g;
const words = (t: string) => t.match(WORD) ?? [];
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Abreviaturas que no terminan oración ("p. 12", "Fig. 3", "aprox. 5 mg").
const ABBR = /\b(p|pp|fig|figs|dr|dra|sr|sra|vs|etc|aprox|cap|ej|n[úu]m|art|vol|ed|m[áa]x|m[íi]n|mg|ml|kg|seg|hrs?|cols?|aa)\.(?=\s)/gi;
const DOT = '․';

function splitSentences(text: string): string[] {
  return text
    .replace(ABBR, `$1${DOT}`)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9(])/)
    .map((s) => s.replaceAll(DOT, '.').trim())
    .filter((s) => s.length >= 25 && s.length <= 420);
}

/** Texto del PDF: une palabras cortadas con guion y descarta títulos/encabezados sueltos. */
function cleanSource(text: string): string {
  const lines = text.replace(/-\n(?=[a-záéíóúñ])/g, '').split('\n');
  return lines
    .filter((l, i) => {
      const t = l.trim();
      const next = (lines[i + 1] ?? '').trim();
      const heading = t.length > 0 && t.length < 70 && !/[.:;?!,]$/.test(t) && (!next || /^[A-ZÁÉÍÓÚÑ0-9]/.test(next));
      return !heading;
    })
    .join('\n');
}

/** Notas: cada línea (viñeta, párrafo) es una idea completa aunque no termine en punto. */
function noteLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[•\-–*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((l) => (/[.!?;:]$/.test(l) ? l : `${l}.`))
    .join(' ');
}

export function synthesizeLocal(input: SynthInput): string {
  const hl = input.fragments.filter((f) => f.text.trim());
  const hlText = hl.map((f) => f.text.trim().replace(/[.;:,]?$/, '.')).join(' ');
  const notes = noteLines(input.notesText);
  const source = cleanSource(input.sourceText);
  const corpus = [hlText, notes, source].filter((t) => t.trim()).join('\n');
  if (!corpus.trim()) {
    throw new Error('No hay material todavía: resalta fragmentos del PDF, escribe notas o indica un rango de páginas.');
  }

  // Frecuencia ponderada de términos.
  const tf = new Map<string, number>();
  const surface = new Map<string, Map<string, number>>();
  const add = (text: string, weight: number) => {
    for (const raw of words(text)) {
      const k = norm(raw);
      if (k.length < 4 || STOP.has(k)) continue;
      tf.set(k, (tf.get(k) ?? 0) + weight);
      const m = surface.get(k) ?? new Map<string, number>();
      m.set(raw, (m.get(raw) ?? 0) + 1);
      surface.set(k, m);
    }
  };
  add(hlText, 3);
  add(notes, 2);
  add(source, 1);

  const label = (k: string) => {
    let best = k;
    let n = -1;
    for (const [w, c] of surface.get(k) ?? []) {
      if (c > n) {
        best = w;
        n = c;
      }
    }
    return best;
  };

  const keyTerms = [...tf.entries()]
    .filter(([, v]) => v >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
    .map(([k]) => k);

  // Oraciones puntuadas por densidad de términos clave (+ bono si vienen de un resaltado).
  const hlNorm = norm(hlText);
  // Sin duplicados: si dos oraciones empiezan igual, se queda la versión más completa.
  const byKey = new Map<string, { s: string }>();
  for (const s of splitSentences(corpus)) {
    const key = norm(s).replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60);
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, { s });
    else if (s.length > prev.s.length) prev.s = s;
  }
  const sentences = [...byKey.values()].map((x) => x.s);
  const scored = sentences.map((s, i) => {
    const ks = words(s)
      .map(norm)
      .filter((k) => !STOP.has(k));
    const base = ks.reduce((a, k) => a + (tf.get(k) ?? 0), 0) / Math.sqrt(ks.length || 1);
    const bonus = hlNorm.includes(norm(s).slice(0, 50)) ? 1.5 : 1;
    return { s, i, score: base * bonus };
  });
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  const summary = byScore
    .slice(0, 8)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);

  // Autoevaluación: oculta un término clave de las mejores oraciones.
  const questions: { q: string; a: string }[] = [];
  const used = new Set<string>();
  for (const { s } of byScore) {
    if (questions.length >= 6) break;
    const toks = words(s);
    const k = keyTerms.find((t) => !used.has(t) && toks.some((w) => norm(w) === t));
    if (!k) continue;
    const w = toks.find((x) => norm(x) === k);
    if (!w) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(w)}(?=[^\\p{L}\\p{N}]|$)`, 'u');
    if (!re.test(s)) continue;
    questions.push({ q: s.replace(re, '$1_____'), a: w });
    used.add(k);
  }

  const sources = [
    `${hl.length} resaltado${hl.length === 1 ? '' : 's'}`,
    input.notesText.trim() ? 'tus notas' : '',
    input.sourceText.trim() ? 'el texto del PDF' : '',
  ].filter(Boolean);
  const date = new Date().toLocaleDateString('es-MX', { dateStyle: 'medium' });

  let html = `<h2>Hoja de repaso — ${esc(input.title)}</h2>`;
  html += `<p><em>${esc(date)} · síntesis local a partir de ${esc(sources.join(', '))}.</em></p>`;
  if (keyTerms.length) html += `<h3>Conceptos clave</h3><p>${keyTerms.map((k) => `<strong>${esc(label(k))}</strong>`).join(' · ')}</p>`;
  if (summary.length) html += `<h3>Ideas principales</h3><ul>${summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
  for (const c of HIGHLIGHT_ORDER) {
    const group = hl.filter((f) => (f.color ?? 'yellow') === c);
    if (!group.length) continue;
    html += `<h3>${esc(HIGHLIGHT_META[c].label)}</h3><ul>${group
      .map((f) => `<li>${esc(f.text.trim())}${f.page ? ` <em>(p. ${f.page})</em>` : ''}</li>`)
      .join('')}</ul>`;
  }
  if (questions.length) {
    html += `<h3>Autoevaluación</h3><ol>${questions
      .map((x) => `<li>${esc(x.q)}<br><em>Respuesta: ${esc(x.a)}</em></li>`)
      .join('')}</ol>`;
  }
  return html;
}
