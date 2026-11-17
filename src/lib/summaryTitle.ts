/**
 * De qué trata un resumen, sacado de su primera página.
 *
 * Los PDFs de resúmenes traen el tema impreso arriba, pero cada serie lo pone a su manera y los
 * exportadores ensucian el texto. Esto limpia esa suciedad y devuelve el título, sin internet
 * ni IA: lo único que hace falta es la capa de texto que ya lee pdf.js.
 *
 * Dos estorbos reales, vistos en los archivos del usuario:
 *  - **Encabezado de serie**: «C.O. RESUMEN PED 10» antes del tema.
 *  - **Texto duplicado**: algunos exportadores dibujan el título dos veces y la extracción lo
 *    devuelve intercalado — «ESTENOSIS ESTENOSIS HIPERTRÓFICA DEL HIPERTRÓFICA DEL PÍLORO PÍLORO».
 */

/** Líneas que son del formato, no del tema. */
const JUNK =
  /^(?:c\.?o\.?\s*)?(?:resumen|ultra\s*resumen|resumenes)\b|^dr\.?\s|^dra\.?\s|^apuntes?\s+del?\b|^realiza\s+tus\b|^puntos?\s+enarm\b|^p[áa]gina\s*\d|^\d+\s*$|^_+$/i;

/**
 * Deshace el duplicado intercalado: «A A B C B C D D» → «A B C D».
 *
 * Avanza por la frase buscando, en cada posición, un bloque que se repita justo después, y se
 * queda con una sola copia. Se prueba primero el bloque más largo, para no partir mal frases
 * donde una palabra sí se repite de verdad.
 */
export function undouble(words: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let taken = 0;
    for (let n = Math.min(6, Math.floor((words.length - i) / 2)); n >= 1; n--) {
      const a = words.slice(i, i + n).join(' ').toLowerCase();
      const b = words.slice(i + n, i + n * 2).join(' ').toLowerCase();
      if (a === b) {
        out.push(...words.slice(i, i + n));
        taken = n * 2;
        break;
      }
    }
    if (taken) i += taken;
    else out.push(words[i++]);
  }
  return out;
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Quita la firma o el encabezado de serie cuando vienen pegados al título.
 *
 * Según cómo extraiga el texto cada lector, «Cetoacidosis Diabética» y «Dr Mitch» pueden salir
 * en renglones distintos o en el mismo; esto cubre el segundo caso, que el filtro por líneas no ve.
 */
function stripTail(s: string): string {
  return tidy(s.replace(/\s+(?:dr|dra)\.?\s+\S+(?:\s+\S+)?\s*$/i, ''));
}

/** Quita el encabezado de serie del principio de un renglón: «C.O. RESUMEN PED 10 …». */
function stripHeader(s: string): string {
  return tidy(s.replace(/^(?:c\.?\s*o\.?\s*)?(?:ultra\s*)?res[uú]men(?:es)?\s*[a-záéíóúñ]*\s*\d*\s*/i, ''));
}

/** Mayúsculas sostenidas → Capitalización normal, respetando siglas de 2–4 letras. */
function fromCaps(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (/^(?:de|del|la|las|el|los|y|e|o|u|en|con|por|para|a|al|un|una)$/.test(w) && i > 0) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/**
 * El tema de un resumen a partir del texto de su primera página.
 * Devuelve '' si no encuentra nada que parezca un título.
 */
export function titleFromPage(text: string): string {
  const lines = text
    .split('\n')
    .map((l) => tidy(l.replace(/\t/g, ' ')))
    .filter(Boolean);

  // Se juntan las primeras líneas útiles: hay series que parten el título en varios renglones
  // («Crisis / Hipertensiva: / Urgencia y / Emergencia»).
  const take: string[] = [];
  for (const raw of lines) {
    // El encabezado de serie puede venir en su propio renglón o pegado al título, según cómo
    // extraiga el texto cada lector: se le quita el prefijo y se mira qué queda.
    const l = stripHeader(raw);
    if (!l || JUNK.test(l)) {
      if (take.length) break; // el encabezado ya quedó atrás: lo que sigue es otra sección
      continue;
    }
    if (l.length < 2) continue;
    take.push(l);
    if (take.join(' ').length > 70) break;
    if (take.length >= 4) break;
  }
  if (!take.length) return '';

  const words = undouble(tidy(take.join(' ')).split(' '));
  let title = stripTail(tidy(words.join(' '))).replace(/[:.;,\-\s]+$/, '');
  // Un título no es un párrafo: si se desbordó, se corta en el primer punto o a 80 caracteres.
  if (title.length > 80) title = tidy(title.slice(0, 80).replace(/\s+\S*$/, ''));
  return fromCaps(title);
}

/** Para comparar títulos con temas: sin acentos, sin signos, en minúsculas. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'en', 'con', 'por', 'para', 'a', 'al', 'un', 'una', 'su', 'sus']);

/**
 * Raíz aproximada de una palabra: quita plurales y terminaciones que cambian entre el título de
 * un resumen y el nombre del tema («intoxicación» / «intoxicaciones», «traumatizado» /
 * «politraumatizado»). No es un lematizador: solo lo justo para que no se escapen por la forma.
 */
function stem(w: string): string {
  let x = w;
  if (x.startsWith('poli') && x.length > 8) x = x.slice(4);
  x = x.replace(/(ciones|cion|idades|idad|mientos|miento|ologias|ologia)$/, '');
  x = x.replace(/(es|s)$/, '');
  return x.length >= 3 ? x : w;
}

/**
 * Siglas y sinónimos que usan los resúmenes pero no el temario. Es vocabulario, no contenido
 * clínico: solo dice que dos nombres se refieren a lo mismo.
 */
const SYNONYMS: Record<string, string[]> = {
  rcp: ['reanimacion', 'cardiopulmonar'],
  ecg: ['electrocardiograma'],
  ekg: ['electrocardiograma'],
  evc: ['vascular', 'cerebral'],
  iam: ['infarto', 'miocardio'],
  epoc: ['pulmonar', 'obstructiva'],
  erc: ['renal', 'cronica'],
  lra: ['renal', 'aguda'],
  tep: ['tromboembolia', 'pulmonar'],
  eda: ['diarreica'],
  ira: ['respiratoria'],
  hta: ['hipertension'],
  dm: ['diabetes'],
  ehp: ['estenosis', 'piloro'],
  abcde: ['traumatizado'],
};

const words = (s: string) => {
  const out: string[] = [];
  for (const w of normalize(s).split(' ')) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.push(stem(w));
    for (const alt of SYNONYMS[w] ?? []) out.push(stem(alt));
  }
  return out;
};

/** Qué fracción de `need` aparece en `have`. */
const covers = (have: Set<string>, need: string[]) => (need.length ? need.filter((w) => have.has(w)).length / need.length : 0);

/**
 * Qué tan parecidos son el título de un resumen y el nombre de un tema, de 0 a 1.
 *
 * Se mide en los dos sentidos y gana el mayor, porque cualquiera de los dos puede ser el más
 * largo: «Cetoacidosis Diabética» cabe entera en «Cetoacidosis diabética y estado hiperosmolar»,
 * y «Crisis Hipertensiva: Urgencia y Emergencia» contiene entero a «Crisis hipertensiva».
 */
export function similarity(title: string, topic: string): number {
  const a = words(title);
  const b = words(topic);
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const score = Math.max(covers(setA, b), covers(setB, a));
  // Una sola palabra en común no basta cuando los dos nombres son largos.
  const shared = b.filter((w) => setA.has(w)).length;
  if (shared <= 1 && a.length >= 3 && b.length >= 3) return Math.min(score, 0.45);
  return score;
}

export interface TopicLike {
  id: string;
  /** Como se llama el tema en el temario. */
  title: string;
  specialty?: string;
}

/**
 * El tema que mejor encaja con un título, o null si ninguno llega al mínimo.
 *
 * `hintSpecialty` es la especialidad que sugiere la carpeta («Pedia», «Cirugia»): no decide,
 * pero desempata, porque hay temas que se llaman casi igual en dos especialidades.
 */
export type MatchLevel = 'seguro' | 'probable' | 'ninguno';

export interface Match {
  topic: TopicLike | null;
  score: number;
  level: MatchLevel;
}

/** A partir de dónde se da por bueno un emparejamiento sin preguntar. */
export const SURE = 0.8;
/** A partir de dónde se propone, pero se pide confirmación. */
export const MAYBE = 0.45;

/**
 * El tema que mejor encaja con un título.
 *
 * Devuelve además qué tan seguro es: «seguro» se aplica solo, «probable» se propone para que lo
 * confirmes y «ninguno» se queda sin tema. Nunca se inventa un tema: si nada encaja, lo dice.
 *
 * `hintSpecialty` es la especialidad que sugiere la carpeta («Pedia», «Cirugia»): no decide,
 * pero desempata entre temas que se llaman casi igual en dos especialidades.
 */
export function matchTopic(title: string, topics: TopicLike[], hintSpecialty?: string): Match {
  let best: { topic: TopicLike; score: number } | null = null;
  for (const t of topics) {
    let s = similarity(title, t.title);
    if (hintSpecialty && t.specialty === hintSpecialty) s += 0.08;
    if (!best || s > best.score) best = { topic: t, score: s };
  }
  const score = Math.min(1, best?.score ?? 0);
  if (!best || score < MAYBE) return { topic: null, score, level: 'ninguno' };
  return { topic: best.topic, score, level: score >= SURE ? 'seguro' : 'probable' };
}

/** La especialidad que sugiere la ruta de la carpeta o el nombre del archivo. */
export function specialtyHint(path: string): string | undefined {
  const p = normalize(path);
  if (/\bmed(icina)? interna\b|\bmi\b/.test(p)) return 'mi';
  if (/\bcirug(ia|ía)\b|\bcx\b/.test(p)) return 'cg';
  if (/\bpedia(tria)?\b|\bped\b/.test(p)) return 'ped';
  if (/\bgineco|obstetricia|\bgo\b/.test(p)) return 'go';
  if (/\burgencias?\b|\burg\b/.test(p)) return 'urg';
  if (/\bsalud publica\b|\bmedicina familiar\b|\bsp\b|\bmf\b/.test(p)) return 'sp';
  return undefined;
}
