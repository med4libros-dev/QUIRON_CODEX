import { TOPIC } from '../internship/curriculum';
import { preferredDoc } from '../internship/openLesson';
import { htmlToText } from '../lib/html';
import { pagesOf } from '../lib/pageIndex';
import { useLibrary } from '../store/library';
import { useNotes } from '../store/notes';
import { sanitizeQuestion, type Question } from './store';

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

const MAX_CHARS = 60_000;

async function materialFor(topicId: string): Promise<{ text: string; docId: string | null; docName: string }> {
  const docId = preferredDoc(topicId, 'GER');
  if (docId) {
    const pages = await pagesOf(docId);
    let text = '';
    for (let i = 0; i < pages.length && text.length < MAX_CHARS; i++) if (pages[i]) text += `\n[p. ${i + 1}]\n${pages[i]}\n`;
    const docName = useLibrary.getState().docs.find((d) => d.id === docId)?.name ?? 'GPC';
    if (text.trim().length > 400) return { text: text.slice(0, MAX_CHARS), docId, docName };
  }
  // Sin GPC con texto: los apuntes del tema.
  const t = TOPIC[topicId];
  const notes = useNotes.getState().notes.filter((n) => n.title === t.title);
  const text = notes.map((n) => htmlToText(n.html)).join('\n\n');
  if (text.trim().length < 300) throw new Error(`«${t.title}» no tiene GPC adjunta ni apuntes suficientes. Adjunta la GER en la ficha del tema.`);
  return { text: text.slice(0, MAX_CHARS), docId: null, docName: 'Apuntes' };
}

function parseJson(raw: string): unknown {
  const s = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('La respuesta no traía JSON.');
  return JSON.parse(s.slice(a, b + 1));
}

export async function generateQuestions(
  topicId: string,
  count: number,
  apiKey: string,
  model: string,
): Promise<Omit<Question, 'id' | 'createdAt'>[]> {
  if (!apiKey.trim()) throw new Error('Agrega tu API key de Anthropic (Estudio → Síntesis → Motor de IA) para generar casos.');
  const t = TOPIC[topicId];
  const mat = await materialFor(topicId);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Tema: ${t.title}\nGenera ${count} casos clínicos distintos.\n\n## Material (${mat.docName})\n${mat.text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`La API respondió ${res.status}. ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
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
