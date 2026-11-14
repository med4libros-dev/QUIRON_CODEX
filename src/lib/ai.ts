import { useSettings } from '../store/settings';

/**
 * Motor de IA: funciona con Claude (Anthropic) o con Gemini (Google), a elección tuya.
 * La clave se guarda solo en este equipo y el material se envía directamente al proveedor
 * que elijas; Quirón Codex no tiene servidor propio.
 */
export type AiProvider = 'claude' | 'gemini';
export const AI_LABEL: Record<AiProvider, string> = { claude: 'Claude (Anthropic)', gemini: 'Gemini (Google)' };
export const AI_KEY_HINT: Record<AiProvider, string> = { claude: 'sk-ant-…', gemini: 'AIza…' };
export const AI_DEFAULT_MODEL: Record<AiProvider, string> = { claude: 'claude-sonnet-5-5', gemini: 'gemini-2.5-flash' };

export interface AiCfg {
  provider: AiProvider;
  key: string;
  model: string;
}

/** Configuración activa del motor de IA. */
export function aiCfg(): AiCfg {
  const s = useSettings.getState();
  return s.aiProvider === 'gemini'
    ? { provider: 'gemini', key: s.geminiKey.trim(), model: s.geminiModel.trim() || AI_DEFAULT_MODEL.gemini }
    : { provider: 'claude', key: s.apiKey.trim(), model: s.model.trim() || AI_DEFAULT_MODEL.claude };
}
/** ¿Hay clave guardada para el motor elegido? */
export const aiReady = () => !!aiCfg().key;
/** Aviso para la interfaz cuando falta la clave. */
export const aiMissingMsg = () => `Agrega tu API key de ${AI_LABEL[aiCfg().provider]} en Ajustes → Preferencias → IA.`;

export interface AiCall {
  system: string;
  user: string;
  maxTokens?: number;
}

export async function callAi({ system, user, maxTokens = 4000 }: AiCall): Promise<string> {
  const cfg = aiCfg();
  if (!cfg.key) throw new Error(aiMissingMsg());
  return cfg.provider === 'gemini' ? callGemini(cfg, system, user, maxTokens) : callClaude(cfg, system, user, maxTokens);
}

async function callClaude(cfg: AiCfg, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(await apiError(res, 'Claude'));
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  if (!text.trim()) throw new Error('Claude devolvió una respuesta vacía. Intenta de nuevo.');
  return text;
}

interface GeminiPart {
  text?: string;
}
interface GeminiRes {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

async function callGemini(cfg: AiCfg, system: string, user: string, maxTokens: number): Promise<string> {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens, temperature: 0.6 };
  // Los modelos «flash» razonan antes de responder y eso consume el presupuesto de salida: se desactiva.
  if (/flash/i.test(cfg.model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig,
    }),
  });
  if (!res.ok) throw new Error(await apiError(res, 'Gemini'));
  const data = (await res.json()) as GeminiRes;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini bloqueó la petición (${data.promptFeedback.blockReason}).`);
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!text.trim()) {
    throw new Error(
      cand?.finishReason === 'MAX_TOKENS'
        ? 'Gemini se quedó sin espacio para responder. Prueba con menos preguntas o con otro modelo.'
        : 'Gemini devolvió una respuesta vacía. Intenta de nuevo.',
    );
  }
  return text;
}

async function apiError(res: Response, who: string): Promise<string> {
  const raw = await res.text().catch(() => '');
  let detail = raw.slice(0, 200);
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } };
    if (j.error?.message) detail = j.error.message;
  } catch {
    /* la respuesta no era JSON */
  }
  if (res.status === 401 || res.status === 403) return `${who} rechazó tu API key (${res.status}). Revísala en Ajustes → Preferencias → IA.`;
  if (res.status === 429) return `${who} está limitando las peticiones (429). Espera un momento e intenta otra vez.`;
  return `${who} respondió ${res.status}. ${detail}`;
}

/** Extrae el primer objeto JSON de una respuesta (tolera bloques de código). */
export function parseJson(raw: string): unknown {
  const s = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('La respuesta no traía JSON.');
  return JSON.parse(s.slice(a, b + 1));
}
