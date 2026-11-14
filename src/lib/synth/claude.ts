import { sanitizeHtml } from '../html';
import { HIGHLIGHT_META } from '../../types';
import type { SynthInput } from './types';

/**
 * Motor opcional con Claude (requiere tu API key de Anthropic).
 * La llamada va directo del navegador a la API; la clave se guarda solo en este navegador.
 */
const SYSTEM = `Eres un tutor experto en medicina que prepara hojas de repaso para un estudiante de medicina en México (preparación ENARM).
Responde SOLO con HTML simple (h2, h3, p, ul, ol, li, strong, em). Sin <html>, sin estilos, sin bloques de código.
Estructura: <h2>título</h2>; "Resumen esencial" (5–8 viñetas); "Conceptos clave" con definición breve;
"Perlas clínicas" (diagnóstico, tratamiento de primera línea, datos de alarma) solo si el material las sustenta;
"Autoevaluación" con 5–8 preguntas y la respuesta en <em>.
Usa exclusivamente el material proporcionado. Si algo falta o es ambiguo, indícalo en una sección final "Para verificar".
Escribe en español.`;

export function buildMaterial(input: SynthInput, limit = 90_000): string {
  const parts = [`Tema: ${input.title}`];
  if (input.fragments.length) {
    parts.push(
      '## Fragmentos resaltados por el estudiante\n' +
        input.fragments
          .map((f) => `- [${f.color ? HIGHLIGHT_META[f.color].label : 'Resaltado'}${f.page ? `, p. ${f.page}` : ''}] ${f.text}`)
          .join('\n'),
    );
  }
  if (input.notesText.trim()) parts.push('## Notas del estudiante\n' + input.notesText.trim());
  if (input.sourceText.trim()) parts.push('## Texto del material de estudio\n' + input.sourceText.trim());
  const text = parts.join('\n\n');
  return text.length > limit ? `${text.slice(0, limit)}\n\n[Material truncado por longitud]` : text;
}

export async function synthesizeWithClaude(input: SynthInput, apiKey: string, model: string): Promise<string> {
  if (!apiKey.trim()) throw new Error('Agrega tu API key de Anthropic en «Motor de IA».');
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
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: buildMaterial(input) }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`La API respondió ${res.status}. ${detail.slice(0, 240)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('')
    .replace(/^```(?:html)?\s*|\s*```$/g, '');
  if (!text.trim()) throw new Error('La respuesta llegó vacía.');
  return sanitizeHtml(text);
}
