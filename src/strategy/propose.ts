import type { InternshipConfig } from '../internship/types';
import type { Evidence } from './evidence';
import { bestHours, summarize } from './evidence';
import { callAi } from '../lib/ai';

/** Un ajuste concreto que se puede aceptar o rechazar. Nada se aplica sin que lo apruebes. */
export interface Proposal {
  id: string;
  title: string;
  /** Por qué, con el dato que lo sostiene. */
  why: string;
  kind: 'config' | 'retention' | 'reminder' | 'tool';
  /** Cambios al plan (solo para kind='config'). */
  patch?: Partial<InternshipConfig>;
  retention?: number;
  reminderHour?: number;
  /** Vista que abre la sugerencia de herramienta. */
  view?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * Propuestas sin IA, de reglas. Es lo que se usa sin clave de API y también el respaldo
 * si el motor contesta cualquier cosa: la app funciona sin internet, también esto.
 */
export function localProposals(e: Evidence, ans: Record<string, string>, cfg: InternshipConfig): Proposal[] {
  const out: Proposal[] = [];

  // 1. El plan pide más de lo que haces. Lo que no se cumple no es un plan, es una deuda.
  if (e.adherence !== null && e.adherence < 70 && e.planned >= 7) {
    const real = e.medianMinutes ?? Math.round(cfg.dailyMinutes * 0.6);
    const nuevo = clamp(Math.max(real, cfg.dailyMinutes * 0.7), 20, cfg.dailyMinutes);
    if (nuevo < cfg.dailyMinutes) {
      out.push({
        id: 'bajar-minutos',
        kind: 'config',
        title: `Bajar el objetivo diario a ${nuevo} min`,
        why: `Cumples el ${e.adherence}% del plan y en un día típico registras ${e.medianMinutes ?? '—'} min. Un objetivo que no alcanzas te deja deuda todos los días; uno que sí alcanzas se sostiene.`,
        patch: { dailyMinutes: nuevo },
      });
    }
  }

  // 2. Lo contrario: cumples de sobra y hay tiempo sin usar.
  if (e.adherence !== null && e.adherence >= 95 && e.planned >= 10 && (e.medianMinutes ?? 0) > cfg.dailyMinutes * 1.2) {
    out.push({
      id: 'subir-minutos',
      kind: 'config',
      title: `Subir el objetivo diario a ${clamp(cfg.dailyMinutes * 1.25, 20, 240)} min`,
      why: `Cumples el ${e.adherence}% y estudias más de lo que el plan te pide (${e.medianMinutes} min en un día típico). Si subes el objetivo, el temario se reparte con más holgura al final.`,
      patch: { dailyMinutes: clamp(cfg.dailyMinutes * 1.25, 20, 240) },
    });
  }

  // 3. Postguardia: lo que dices que te pasa contra lo que el plan supone.
  const pg = { inservible: 0.2, poco: 0.4, normal: 0.8 }[ans.postguardia ?? ''] ?? null;
  if (pg !== null && Math.abs(pg - cfg.postGuardiaFactor) > 0.15) {
    out.push({
      id: 'postguardia',
      kind: 'config',
      title: `Dejar el postguardia al ${Math.round(pg * 100)}% de la carga`,
      why: `Dijiste que el día después de guardia quedas «${ans.postguardia}», y el plan te está pidiendo el ${Math.round(cfg.postGuardiaFactor * 100)}%. Ese día es el que más deuda genera.`,
      patch: { postGuardiaFactor: pg },
    });
  }

  // 4. Fin de semana desaprovechado.
  const finde = e.byWeekday[0] + e.byWeekday[6];
  const semana = e.byWeekday.slice(1, 6).reduce((a, b) => a + b, 0);
  if (semana > 0 && finde > semana * 0.6 && cfg.weekendMinutes <= cfg.dailyMinutes) {
    out.push({
      id: 'finde',
      kind: 'config',
      title: `Subir el fin de semana a ${clamp(cfg.weekendMinutes * 1.4, 30, 300)} min`,
      why: 'Tus registros dicen que el fin de semana es cuando de verdad estudias. Cargar ahí lo que no cabe entre semana reparte mejor el temario.',
      patch: { weekendMinutes: clamp(cfg.weekendMinutes * 1.4, 30, 300) },
    });
  }

  // 5. Olvidas mucho al repasar: bajar la exigencia antes que acumular tarjetas vencidas.
  if (e.cards.lapseRate !== null && e.cards.lapseRate > 30 && e.cards.total >= 20) {
    out.push({
      id: 'retencion',
      kind: 'retention',
      retention: 0.85,
      title: 'Bajar la exigencia del repaso a 85%',
      why: `Olvidas el ${e.cards.lapseRate}% de las tarjetas al repasarlas. Con una exigencia más baja, cada tarjeta vuelve antes y la cola diaria no se te dispara.`,
    });
  }

  // 6. Se te olvida estudiar: recordatorio a la hora en que de verdad estudias.
  if (ans.abandono === 'olvido') {
    const h = bestHours(e, 1)[0] ?? ({ manana: 7, tarde: 18, noche: 21, huecos: 13 }[ans.cuando ?? ''] ?? 20);
    out.push({
      id: 'recordatorio',
      kind: 'reminder',
      reminderHour: h,
      title: `Recordatorio diario a las ${h}:00`,
      why: e.byHour[h] > 0 ? 'Es la hora a la que ya sueles estudiar, así que el aviso cae cuando puedes hacerle caso.' : 'Es la hora que dijiste que te funciona.',
    });
  }

  // 7. Temas flojos: enfocar menos en la rotación y más en tapar hoyos.
  if (e.weak.length >= 3 && cfg.primaryShare > 0.6) {
    out.push({
      id: 'enfoque',
      kind: 'config',
      title: 'Bajar el enfoque en la rotación a 60%',
      why: `Tienes ${e.weak.length} temas por debajo del 60% (${e.weak.slice(0, 2).map((w) => w.title).join(', ')}…). Con menos enfoque en la rotación actual, el plan intercala más repaso de lo flojo.`,
      patch: { primaryShare: 0.6 },
    });
  }

  // 8. Herramientas: lo que te dijiste que se te hace llevadero y todavía no usas.
  const herramienta: Record<string, { view: string; title: string; why: string }> = {
    preguntas: { view: 'exam', title: 'Usa los simulacros', why: 'Dijiste que se te hace más llevadero contestar preguntas, y es además la forma de estudio con más respaldo: recuperar lo aprendido fija más que releer.' },
    escribir: { view: 'notebooks', title: 'Usa el lienzo con el lápiz', why: 'Dijiste que te acomoda escribir a mano. El lienzo de la Surface transcribe lo que escribes y lo vuelve buscable.' },
    esquemas: { view: 'notebooks', title: 'Usa los flujogramas del lienzo', why: 'Dijiste que te acomodan los esquemas. Hay plantillas de flujograma que se enganchan solas a las cajas.' },
    escuchar: { view: 'hy', title: 'Usa «Escuchar» en tus perlas', why: 'Dijiste que te acomoda escuchar. Las perlas y las notas se leen en voz alta sin internet, y sirven de camino al hospital.' },
    leer: { view: 'summaries', title: 'Engancha tus resúmenes al temario', why: 'Dijiste que lees y subrayas. Tus ultrarresúmenes pueden quedar ligados a cada tema para que lleguen solos a la lección del día.' },
  };
  const h = herramienta[ans.formato ?? ''];
  const yaUsa: Record<string, boolean> = {
    exam: e.used.exams,
    notebooks: e.used.ink,
    hy: e.used.hy,
    summaries: e.used.summaries,
  };
  if (h && !yaUsa[h.view]) out.push({ id: `herramienta-${ans.formato}`, kind: 'tool', view: h.view, title: h.title, why: h.why });

  // 9. En transporte o en huecos: Bolsillo en el teléfono.
  if ((ans.donde === 'transporte' || ans.cuando === 'huecos') && !e.used.flashcards) {
    out.push({
      id: 'bolsillo',
      kind: 'tool',
      view: 'internado',
      title: 'Haz tarjetas para los huecos',
      why: 'Estudias en ratos sueltos y todavía no tienes tarjetas. Son lo único que aprovecha cinco minutos de camión, y en el teléfono están a un toque.',
    });
  }

  return out;
}

const CATALOGO = `
Acciones permitidas (no inventes otras):
- {"kind":"config","patch":{"dailyMinutes":N}}        N entre 20 y 240
- {"kind":"config","patch":{"weekendMinutes":N}}      N entre 20 y 300
- {"kind":"config","patch":{"guardiaMinutes":N}}      N entre 0 y 60
- {"kind":"config","patch":{"postGuardiaFactor":F}}   F entre 0 y 1
- {"kind":"config","patch":{"primaryShare":F}}        F entre 0.4 y 0.9
- {"kind":"config","patch":{"reviewWeeks":N}}         N entre 0 y 8
- {"kind":"retention","retention":F}                  F entre 0.8 y 0.95
- {"kind":"reminder","reminderHour":N}                N entre 0 y 23
- {"kind":"tool","view":"exam|notebooks|hy|summaries|internado"}
`;

const SYSTEM = `Eres un asesor de estudio para un médico interno de pregrado en México.
Te doy datos reales de su app de estudio y sus respuestas a un cuestionario.
Propones entre 2 y 5 ajustes concretos, cada uno con su razón apoyada en un dato que te di.

Reglas:
- No inventes datos. Si algo no te lo di, no lo afirmes.
- Nada de «estilos de aprendizaje» (visual, auditivo, kinestésico): no tienen respaldo. Las
  preferencias de formato solo sirven para elegir qué herramienta de la app sugerir.
- Las técnicas con respaldo son recuperación activa, repaso espaciado e intercalado, y ya están
  construidas en la app; no las propongas como novedad, úsalas para decidir los ajustes.
- Prefiere menos ajustes y mejor justificados. Si los datos no sostienen un cambio, no lo propongas.
- Responde SOLO con JSON: {"proposals":[{"title":"…","why":"…","kind":"…", …}]}
- «title» en imperativo y en menos de 60 caracteres. «why» en una o dos frases, citando el dato.
${CATALOGO}`;

interface RawProposal {
  title?: string;
  why?: string;
  kind?: string;
  patch?: Record<string, unknown>;
  retention?: number;
  reminderHour?: number;
  view?: string;
}

const LIMITS: Record<string, [number, number]> = {
  dailyMinutes: [20, 240],
  weekendMinutes: [20, 300],
  guardiaMinutes: [0, 60],
  postGuardiaFactor: [0, 1],
  primaryShare: [0.4, 0.9],
  reviewWeeks: [0, 8],
};
const VIEWS = ['exam', 'notebooks', 'hy', 'summaries', 'internado'];

/** Se queda solo con lo que cabe en el catálogo y dentro de rango. */
export function sanitize(raw: unknown): Proposal[] {
  const list = (raw as { proposals?: RawProposal[] })?.proposals;
  if (!Array.isArray(list)) return [];
  const out: Proposal[] = [];
  for (const [i, p] of list.entries()) {
    const title = String(p.title || '').trim().slice(0, 90);
    const why = String(p.why || '').trim().slice(0, 400);
    if (!title || !why) continue;
    const base = { id: `ia-${i}`, title, why };
    if (p.kind === 'config' && p.patch) {
      const patch: Record<string, number> = {};
      for (const [k, v] of Object.entries(p.patch)) {
        const lim = LIMITS[k];
        if (!lim || typeof v !== 'number' || Number.isNaN(v)) continue;
        patch[k] = k === 'postGuardiaFactor' || k === 'primaryShare' ? Math.max(lim[0], Math.min(lim[1], v)) : clamp(v, lim[0], lim[1]);
      }
      if (Object.keys(patch).length) out.push({ ...base, kind: 'config', patch: patch as Partial<InternshipConfig> });
    } else if (p.kind === 'retention' && typeof p.retention === 'number') {
      out.push({ ...base, kind: 'retention', retention: Math.max(0.8, Math.min(0.95, p.retention)) });
    } else if (p.kind === 'reminder' && typeof p.reminderHour === 'number') {
      out.push({ ...base, kind: 'reminder', reminderHour: clamp(p.reminderHour, 0, 23) });
    } else if (p.kind === 'tool' && typeof p.view === 'string' && VIEWS.includes(p.view)) {
      out.push({ ...base, kind: 'tool', view: p.view });
    }
  }
  return out.slice(0, 6);
}

/** Pide ajustes al motor de IA configurado. Si no hay clave o falla, caen las reglas locales. */
export async function aiProposals(e: Evidence, ans: Record<string, string>, cfg: InternshipConfig, labels: string): Promise<Proposal[]> {
  const user = `DATOS REALES DE LA APP\n${summarize(e, cfg)}\n\nRESPUESTAS DEL CUESTIONARIO\n${labels}`;
  const txt = await callAi({ system: SYSTEM, user, maxTokens: 1400 });
  const m = /\{[\s\S]*\}/.exec(txt);
  if (!m) return [];
  return sanitize(JSON.parse(m[0]));
}
