/** Llamada mínima a la API de Anthropic desde el navegador (con tu API key, guardada solo en este equipo). */
export async function callClaude(opts: { apiKey: string; model: string; system: string; user: string; maxTokens?: number }): Promise<string> {
  if (!opts.apiKey.trim()) throw new Error('Agrega tu API key de Anthropic (Ajustes → Preferencias → IA) para usar esta función.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`La API respondió ${res.status}. ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
}

/** Extrae el primer objeto JSON de una respuesta (tolera bloques de código). */
export function parseJson(raw: string): unknown {
  const s = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('La respuesta no traía JSON.');
  return JSON.parse(s.slice(a, b + 1));
}
