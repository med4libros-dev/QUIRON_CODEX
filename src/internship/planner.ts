import { addDays, fromKey, toKey } from '../lib/date';
import { SPECIALTIES } from './curriculum';
import type { DayPlan, InternshipConfig, Lesson, Rotation, SpecialtyId, Topic } from './types';

/**
 * Planificador anual del internado.
 *
 * Reglas:
 *  1. Capacidad diaria realista: minutos de lunes a viernes, fin de semana, día de guardia (solo repaso)
 *     y día postguardia (carga reducida).
 *  2. Ritmo uniforme: el temario se reparte a lo largo de todo el año (no se "acaba" en 4 meses).
 *  3. Durante cada rotación, la mayor parte del tiempo de temas nuevos va a esa especialidad
 *     (lo que ves en el hospital); el resto se intercala con las demás para no olvidarlas.
 *  4. Dentro de cada especialidad, primero los temas de mayor prioridad.
 *  5. Repaso espaciado automático: 10 min a los 3, 10 y 30 días de terminar cada tema.
 *  6. Las últimas semanas: repaso integral de los temas de prioridad alta y media.
 */

export const REVIEW_OFFSETS = [3, 10, 30];
const REVIEW_MIN = 10;
const FINAL_MIN = 20;
const MIN_CHUNK = 15;

export const diffDays = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

export function rotationOn(cfg: InternshipConfig, key: string): Rotation | undefined {
  return cfg.rotations.find((r) => key >= r.start && key <= r.end);
}

export function isGuardia(cfg: InternshipConfig, key: string): boolean {
  if (!cfg.guardiaEvery || !cfg.firstGuardia || key < cfg.start || key > cfg.end) return false;
  const d = diffDays(cfg.firstGuardia, key);
  return d >= 0 && d % cfg.guardiaEvery === 0;
}

export function capacityOn(cfg: InternshipConfig, key: string) {
  const guardia = isGuardia(cfg, key);
  const postGuardia = !guardia && isGuardia(cfg, toKey(addDays(fromKey(key), -1)));
  const dow = fromKey(key).getDay();
  const weekend = dow === 0 || dow === 6;
  let capacity = guardia ? cfg.guardiaMinutes : weekend ? cfg.weekendMinutes : cfg.dailyMinutes;
  if (postGuardia) capacity = Math.round(capacity * cfg.postGuardiaFactor);
  return { capacity, guardia, postGuardia };
}

/** Fecha + n meses, conservando el día (con desborde controlado). */
export function addMonthsKeep(key: string, n: number): string {
  const d = fromKey(key);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toKey(target);
}

/** Configuración inicial: 6 rotaciones bimestrales, guardias ABC. */
export function defaultConfig(start: string, order: SpecialtyId[] = ['mi', 'cg', 'go', 'ped', 'urg', 'sp']): InternshipConfig {
  const end = toKey(addDays(fromKey(addMonthsKeep(start, 12)), -1));
  return {
    start,
    end,
    rotations: buildRotations(start, order, order.map(() => 2)),
    guardiaEvery: 3,
    firstGuardia: toKey(addDays(fromKey(start), 2)),
    dailyMinutes: 60,
    weekendMinutes: 120,
    guardiaMinutes: 20,
    postGuardiaFactor: 0.5,
    reviewWeeks: 4,
    primaryShare: 0.7,
  };
}

export function buildRotations(start: string, order: SpecialtyId[], months: number[]): Rotation[] {
  let cursor = start;
  return order.map((specialty, i) => {
    const next = addMonthsKeep(cursor, months[i] ?? 2);
    const r: Rotation = { id: `rot-${i}`, specialty, start: cursor, end: toKey(addDays(fromKey(next), -1)) };
    cursor = next;
    return r;
  });
}

export interface PlanResult {
  days: Map<string, DayPlan>;
  keys: string[];
  /** Minutos de temas nuevos que no cupieron en el año (si > 0, sube el tiempo diario). */
  unplannedMinutes: number;
  totalNewMinutes: number;
  /** Fecha en la que se termina cada tema (última parte). */
  topicFinish: Map<string, string>;
  /** Número de partes en que quedó dividido cada tema. */
  topicParts: Map<string, number>;
}

interface QueueItem {
  topic: Topic;
  left: number;
}

export function generatePlan(cfg: InternshipConfig, topics: Topic[]): PlanResult {
  const keys: string[] = [];
  for (let d = fromKey(cfg.start), k = cfg.start; k <= cfg.end; d = addDays(d, 1), k = toKey(d)) keys.push(k);
  const finalStart = toKey(addDays(fromKey(cfg.end), -cfg.reviewWeeks * 7 + 1));
  const mainKeys = keys.filter((k) => k < finalStart);
  const finalKeys = keys.filter((k) => k >= finalStart);

  // Colas por especialidad: prioridad alta primero, conservando el orden del temario.
  const order = topics.map((t) => t.id);
  const queues = new Map<SpecialtyId, QueueItem[]>();
  for (const s of SPECIALTIES) queues.set(s.id, []);
  for (const t of [...topics].sort((a, b) => b.yield - a.yield || order.indexOf(a.id) - order.indexOf(b.id))) {
    queues.get(t.specialty)?.push({ topic: t, left: t.minutes });
  }
  const totalNewMinutes = topics.reduce((a, t) => a + t.minutes, 0);

  // Ritmo: reservar ~25% de la capacidad para repasos y repartir lo nuevo en todo el año.
  const mainCapacity = mainKeys.reduce((a, k) => {
    const c = capacityOn(cfg, k);
    return a + (c.guardia ? 0 : c.capacity);
  }, 0);
  const pace = Math.min(1, totalNewMinutes / Math.max(1, mainCapacity * 0.75));

  const days = new Map<string, DayPlan>();
  const topicFinish = new Map<string, string>();
  const topicParts = new Map<string, number>();
  const reviewsDue = new Map<string, { topicId: string; n: number }[]>();
  let carry: { topicId: string; n: number }[] = [];
  let rr = 0;

  const scheduleReviews = (topicId: string, key: string) => {
    REVIEW_OFFSETS.forEach((off, i) => {
      const due = toKey(addDays(fromKey(key), off));
      if (due > cfg.end) return;
      const list = reviewsDue.get(due) ?? [];
      list.push({ topicId, n: i + 1 });
      reviewsDue.set(due, list);
    });
  };

  const takeFrom = (queue: QueueItem[] | undefined, budget: number, lessons: Lesson[], key: string): number => {
    let used = 0;
    while (queue && queue.length && budget - used >= MIN_CHUNK) {
      const item = queue[0];
      const chunk = Math.min(item.left, budget - used);
      if (chunk < MIN_CHUNK && chunk < item.left) break;
      const part = (topicParts.get(item.topic.id) ?? 0) + 1;
      topicParts.set(item.topic.id, part);
      lessons.push({ id: `${item.topic.id}:${part}`, topicId: item.topic.id, minutes: chunk, kind: 'new', part, parts: 0 });
      item.left -= chunk;
      used += chunk;
      if (item.left <= 0) {
        queue.shift();
        topicFinish.set(item.topic.id, key);
        scheduleReviews(item.topic.id, key);
      }
    }
    return used;
  };

  // Reserva: cuánto de cada especialidad se estudiará "en casa" durante su propia rotación.
  // Al intercalar, no se toca esa reserva antes de tiempo (así cada rotación conserva sus temas).
  const reserve = new Map<SpecialtyId, number>();
  for (const r of cfg.rotations) {
    let mins = 0;
    for (const k of mainKeys) {
      if (k < r.start || k > r.end) continue;
      const c = capacityOn(cfg, k);
      if (!c.guardia) mins += Math.round(c.capacity * pace) * cfg.primaryShare;
    }
    reserve.set(r.specialty, (reserve.get(r.specialty) ?? 0) + mins);
  }
  const queueMinutes = (q: QueueItem[]) => q.reduce((a, it) => a + it.left, 0);
  const rotationAhead = (s: SpecialtyId, key: string) => cfg.rotations.some((r) => r.specialty === s && r.start > key);

  /**
   * Siguiente especialidad (distinta de `exclude`) para intercalar, en turno rotativo.
   * Primero las ya rotadas o sin rotación (refuerzo); las futuras solo con lo que exceda su reserva.
   */
  const nextOther = (key: string, exclude?: SpecialtyId): QueueItem[] | undefined => {
    for (const pass of [0, 1, 2]) {
      for (let i = 0; i < SPECIALTIES.length; i++) {
        const s = SPECIALTIES[(rr + i) % SPECIALTIES.length].id;
        const q = queues.get(s);
        if (s === exclude || !q || !q.length) continue;
        const ahead = rotationAhead(s, key);
        const ok = pass === 0 ? !ahead : pass === 1 ? queueMinutes(q) > (reserve.get(s) ?? 0) : true;
        if (!ok || (pass === 2 && key < finalStart && ahead)) continue;
        rr = (rr + i + 1) % SPECIALTIES.length;
        return q;
      }
    }
    return undefined;
  };

  const runReviews = (key: string, capacity: number, lessons: Lesson[]) => {
    const due = [...carry, ...(reviewsDue.get(key) ?? [])];
    let used = 0;
    while (due.length && used + REVIEW_MIN <= capacity) {
      const r = due.shift()!;
      lessons.push({ id: `${r.topicId}:r${r.n}`, topicId: r.topicId, minutes: REVIEW_MIN, kind: 'review', part: r.n, parts: REVIEW_OFFSETS.length });
      used += REVIEW_MIN;
    }
    carry = due; // lo que no cupo pasa al día siguiente
    return used;
  };

  for (const key of mainKeys) {
    const { capacity, guardia, postGuardia } = capacityOn(cfg, key);
    const rotation = rotationOn(cfg, key)?.specialty;
    const lessons: Lesson[] = [];
    const reviewUsed = runReviews(key, capacity, lessons);
    if (!guardia) {
      const budget = Math.max(0, Math.min(capacity - reviewUsed, Math.round(capacity * pace)));
      const primaryBudget = rotation ? Math.round(budget * cfg.primaryShare) : 0;
      let used = takeFrom(rotation ? queues.get(rotation) : undefined, primaryBudget, lessons, key);
      let guard = 0;
      while (budget - used >= MIN_CHUNK && guard++ < 6) {
        const q = nextOther(key, rotation) ?? (rotation ? queues.get(rotation) : undefined);
        if (!q || !q.length) break;
        const got = takeFrom(q, budget - used, lessons, key);
        if (!got) break;
        used += got;
      }
    }
    days.set(key, { date: key, rotation, guardia, postGuardia, capacity, lessons });
  }

  // Repaso integral final: primero lo que quedó pendiente, luego repasos debidos y temas de prioridad alta/media.
  const finalPool = [...topics].filter((t) => t.yield >= 2).sort((a, b) => b.yield - a.yield);
  let fi = 0;
  const finalRound = new Map<string, number>();
  for (const key of finalKeys) {
    const { capacity, guardia, postGuardia } = capacityOn(cfg, key);
    const rotation = rotationOn(cfg, key)?.specialty;
    const lessons: Lesson[] = [];
    let used = runReviews(key, capacity, lessons);
    if (!guardia) {
      let guard = 0;
      while (capacity - used >= MIN_CHUNK && guard++ < 6) {
        const q = nextOther(key);
        if (!q) break;
        const got = takeFrom(q, capacity - used, lessons, key);
        if (!got) break;
        used += got;
      }
      while (finalPool.length && capacity - used >= FINAL_MIN) {
        const t = finalPool[fi++ % finalPool.length];
        const n = (finalRound.get(t.id) ?? 0) + 1;
        finalRound.set(t.id, n);
        lessons.push({ id: `${t.id}:f${n}`, topicId: t.id, minutes: FINAL_MIN, kind: 'final', part: n, parts: 0 });
        used += FINAL_MIN;
      }
    }
    days.set(key, { date: key, rotation, guardia, postGuardia, capacity, lessons });
  }

  // Segunda pasada: total de partes por tema.
  for (const d of days.values()) for (const l of d.lessons) if (l.kind === 'new') l.parts = topicParts.get(l.topicId) ?? 1;

  let unplannedMinutes = 0;
  for (const q of queues.values()) for (const it of q) unplannedMinutes += it.left;

  return { days, keys, unplannedMinutes, totalNewMinutes, topicFinish, topicParts };
}

/* ---------- Ajustes sobre el plan anual (Modo supervivencia) ---------- */

/**
 * Aplica las lecciones reprogramadas encima del plan generado, sin regenerarlo:
 * el resto del año queda idéntico. Devuelve un plan nuevo (no muta el original).
 */
export function applyAdjustments(plan: PlanResult, shifts: Record<string, string>): PlanResult {
  const ids = Object.keys(shifts);
  if (!ids.length) return plan;
  const moving = new Set(ids);
  const days = new Map<string, DayPlan>();
  const found = new Map<string, Lesson>();
  for (const [k, d] of plan.days) {
    if (d.lessons.some((l) => moving.has(l.id))) {
      const keep: Lesson[] = [];
      for (const l of d.lessons) (moving.has(l.id) ? found.set(l.id, { ...l, movedFrom: k }) : keep.push(l));
      days.set(k, { ...d, lessons: keep });
    } else days.set(k, d);
  }
  for (const [id, to] of Object.entries(shifts)) {
    const l = found.get(id);
    const d = days.get(to);
    if (!l) continue; // la lección ya no existe (plan cambiado)
    if (!d) {
      // Destino fuera del periodo: se queda donde estaba.
      const back = days.get(l.movedFrom!);
      if (back) days.set(back.date, { ...back, lessons: [...back.lessons, { ...l, movedFrom: undefined }] });
      continue;
    }
    days.set(to, { ...d, lessons: [...d.lessons, l] });
  }
  return { ...plan, days };
}

const loadOf = (d: DayPlan, done: Record<string, string>) => d.lessons.reduce((a, l) => a + (done[l.id] ? 0 : l.minutes), 0);

/**
 * «Hoy no doy más»: mueve lo pendiente del día a los días con más espacio libre.
 * Primero el resto de la semana (hasta el domingo), luego las 2 semanas siguientes.
 * Nunca a días de guardia ni a otros días en modo supervivencia. Devuelve lección → nueva fecha.
 */
export function survivalMoves(
  plan: PlanResult,
  date: string,
  done: Record<string, string>,
  survival: Record<string, string[]>,
): Record<string, string> {
  const day = plan.days.get(date);
  if (!day) return {};
  const pending = day.lessons.filter((l) => !done[l.id]);
  // Lo pesado primero (temas nuevos, luego repaso integral, luego repasos cortos).
  const order = { new: 0, final: 1, review: 2 } as const;
  pending.sort((a, b) => order[a.kind] - order[b.kind] || b.minutes - a.minutes);

  const d0 = fromKey(date);
  const dow = (d0.getDay() + 6) % 7; // 0 = lunes
  const weekEnd = toKey(addDays(d0, 6 - dow));
  const candidates: { key: string; spare: number; inWeek: boolean }[] = [];
  for (let i = 1; i <= 21; i++) {
    const k = toKey(addDays(d0, i));
    const d = plan.days.get(k);
    if (!d || d.guardia || survival[k]) continue;
    candidates.push({ key: k, spare: d.capacity - loadOf(d, done), inWeek: k <= weekEnd });
  }
  const moves: Record<string, string> = {};
  for (const l of pending) {
    const pick = (pool: typeof candidates) =>
      pool.filter((c) => c.spare >= l.minutes).sort((a, b) => b.spare - a.spare || (a.key < b.key ? -1 : 1))[0];
    // Una lección de repaso no debe alejarse: se queda en la semana o en los 7 días siguientes.
    const near = candidates.filter((c) => l.kind !== 'review' || diffDays(date, c.key) <= 7);
    let c = pick(near.filter((x) => x.inWeek)) ?? pick(near);
    // Sin espacio en ningún lado: al día con más holgura (se acepta exceder un poco).
    if (!c) c = [...near].sort((a, b) => b.spare - a.spare)[0];
    if (!c) continue;
    moves[l.id] = c.key;
    c.spare -= l.minutes;
  }
  return moves;
}
