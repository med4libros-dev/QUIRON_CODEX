import { TOPIC } from '../internship/curriculum';
import { preferredDoc } from '../internship/openLesson';
import { htmlToText } from '../lib/html';
import { pagesOf } from '../lib/pageIndex';
import { useLibrary } from '../store/library';
import { useNotes } from '../store/notes';
import { sanitizeQuestion, type Question } from './store';
import { callAi, parseJson } from '../lib/ai';

/**
 * Generador de casos clínicos tipo ENARM a partir de TU material:
 * el texto de la GPC adjunta al tema (con número de página) y, si no hay, tus apuntes del tema.
 * Requiere tu API key de Anthropic (la misma de la síntesis). Las preguntas entran «por revisar».
 */
const SYSTEM = `Eres un médico docente que redacta reactivos para el ENARM (Examen Nacional de Aspirantes a Residencias Médicas, México).
Redacta casos clínicos con este formato estricto:
- "vignette": caso clínico de 4 a 6 líneas, con edad, sexo, antecedentes, cuadro clínico, signos vitales y estudios; incluye 1 o 2 datos de distracción plausibles (síntomas que sugieren otra patología).
- "question": una sola pregunta del estilo ENARM (p. ej. «¿Cuál es el siguiente paso diagnóstico más costo-efectivo?», «¿Cuál es el tratamiento de primera elección?», «¿Cuál es la complicación más frecuente?», «¿Cuál es el diagnóstico más probable?»).
- "options": exactamente 4 opciones plausibles y homogéneas; cada una con "text" y "why" (por qué es correcta o por qué es incorrecta, 1–2 frases).
- "correct": índice (0–3) de la opción correcta.
- "page": número de página de la GPC que sustenta la respuesta (el número que aparece en [p. N]); null si sale de los apuntes.
Reglas: usa EXCLUSIVAMENTE el material proporcionado; no inventes dosis, cifras ni criterios que no estén en él. Varía el tipo de pregunta. Escribe en español de México.
Responde SOLO con JSON válido: {"questions":[...]} sin texto adicional ni bloques de código.`;

export const MAX_CHARS = 60_000;

/**
 * ¿Este texto da para trabajar? Contar caracteres no basta: una GPC escaneada —o con la
 * capa de texto rota— deja encabezados, números de página y viñetas sueltas que suman
 * miles de caracteres sin una sola frase clínica. Se cuentan palabras de verdad
 * (3+ letras seguidas) y se exige que el texto sea mayormente letras, no símbolos.
 */
export function materialUsable(text: string): { ok: boolean; palabras: number; razonLetras: number } {
  const palabras = (text.match(/\p{L}{3,}/gu) ?? []).length;
  const letras = (text.match(/\p{L}/gu) ?? []).length;
  const visibles = text.replace(/\s/g, '').length;
  const razonLetras = visibles ? letras / visibles : 0;
  return { ok: palabras >= 150 && razonLetras >= 0.6, palabras, razonLetras };
}

/** Lo que se le dice al usuario cuando el PDF no trae texto que leer. */
export function sinTextoMsg(docName: string, palabras: number): string {
  return `«${docName}» no tiene texto legible (${palabras} palabras aprovechables). Casi siempre significa que el PDF está escaneado: son imágenes de las páginas, no texto, así que ni el buscador ni la IA pueden leerlo. Busca la GER en el sitio del IMSS, que las publica con texto, o usa tus apuntes del tema.`;
}

export async function materialFor(topicId: string): Promise<{ text: string; docId: string | null; docName: string }> {
  const docId = preferredDoc(topicId, 'GER');
  let escaneado: string | null = null;
  if (docId) {
    const pages = await pagesOf(docId);
    let text = '';
    for (let i = 0; i < pages.length && text.length < MAX_CHARS; i++) if (pages[i]) text += `\n[p. ${i + 1}]\n${pages[i]}\n`;
    const docName = useLibrary.getState().docs.find((d) => d.id === docId)?.name ?? 'GPC';
    const u = materialUsable(text);
    if (u.ok) return { text: text.slice(0, MAX_CHARS), docId, docName };
    // Hay PDF pero no da texto aprovechable. Se intentan los apuntes igual; si tampoco
    // hay, el aviso dice que el PDF está escaneado, que es la causa real.
    escaneado = sinTextoMsg(docName, u.palabras);
  }
  // Sin GPC con texto: los apuntes del tema.
  const t = TOPIC[topicId];
  const notes = useNotes.getState().notes.filter((n) => n.title === t.title);
  const text = notes.map((n) => htmlToText(n.html)).join('\n\n');
  if (materialUsable(text).ok) return { text: text.slice(0, MAX_CHARS), docId: null, docName: 'Apuntes' };
  throw new Error(escaneado ?? `«${t.title}» no tiene GPC adjunta ni apuntes suficientes. Adjunta la GER en la ficha del tema.`);
}

export async function generateQuestions(
  topicId: string,
  count: number,
): Promise<Omit<Question, 'id' | 'createdAt'>[]> {
  const t = TOPIC[topicId];
  const mat = await materialFor(topicId);
  const text = await callAi({
    system: SYSTEM,
    maxTokens: 8000,
    user: `Tema: ${t.title}\nGenera ${count} casos clínicos distintos.\n\n## Material (${mat.docName})\n${mat.text}`,
  });
  const parsed = parseJson(text) as { questions?: unknown[] };
  const out: Omit<Question, 'id' | 'createdAt'>[] = [];
  for (const raw of parsed.questions ?? []) {
    const q = sanitizeQuestion(raw);
    if (!q) continue;
    const page = Number((raw as Record<string, unknown>).page);
    out.push({
      ...q,
      topicId,
      cite: mat.docId && Number.isInteger(page) && page > 0 ? { docId: mat.docId, docName: mat.docName, page } : null,
      origin: 'ia',
      reviewed: false,
    });
  }
  if (!out.length) throw new Error('No llegaron preguntas válidas. Intenta de nuevo.');
  return out;
}
