import type { Card } from '../flashcards/store';
import type { FocusLog } from '../types';
import type { Attempt, Question } from '../exam/store';
import type { InternshipConfig, Lesson } from '../internship/types';
import { SPECIALTY, TOPIC } from '../internship/curriculum';
import { topicMastery, weakTopics } from '../analytics/mastery';

/**
 * Lo que la app ya sabe de cómo estudias de verdad. Todo sale de tus datos:
 * nada de esto se pregunta ni se supone.
 */
export interface Evidence {
  /** Lecciones marcadas vs. programadas hasta hoy, en porcentaje. */
  adherence: number | null;
  planned: number;
  done: number;
  late: number;
  /** Minutos registrados por día de la semana (0 = domingo) y por hora del día. */
  byWeekday: number[];
  byHour: number[];
  medianMinutes: number | null;
  /** Días de los últimos 21 con algo de estudio registrado. */
  activeDays: number;
  /** Especialidades más flojas, con su puntaje. */
  weak: { specialty: string; title: string; score: number }[];
  cards: { total: number; due: number; lapseRate: number | null };
  exam: { answered: number; right: number };
  /** Herramientas que ya usas, para no recomendarte lo que ya haces. */
  used: { flashcards: boolean; exams: boolean; ink: boolean; audio: boolean; hy: boolean; summaries: boolean };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

export function gather(input: {
  config: InternshipConfig | null;
  plan: { key: string; lessons: Lesson[] }[];
  /** Lecciones marcadas: id → fecha en que se marcó. */
  done: Record<string, string>;
  today: string;
  logs: FocusLog[];
  cards: Card[];
  questions: Question[];
  attempts: Attempt[];
  inkNotes: number;
  audioNotes: number;
  hyItems: number;
  summaries: number;
}): Evidence {
  const past = input.plan.filter((d) => d.key <= input.today);
  const planned = past.reduce((n, d) => n + d.lessons.length, 0);
  const done = past.reduce((n, d) => n + d.lessons.filter((l) => !!input.done[l.id]).length, 0);

  const byWeekday = Array(7).fill(0) as number[];
  const byHour = Array(24).fill(0) as number[];
  const perDay = new Map<string, number>();
  for (const l of input.logs) {
    const d = new Date(`${l.date}T12:00:00`);
    byWeekday[d.getDay()] += l.minutes;
    byHour[new Date(l.at).getHours()] += l.minutes;
    perDay.set(l.date, (perDay.get(l.date) || 0) + l.minutes);
  }
  const mins = [...perDay.values()].sort((a, b) => a - b);
  const medianMinutes = mins.length ? mins[Math.floor(mins.length / 2)] : null;

  const hace21 = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const activeDays = [...perDay.keys()].filter((k) => k >= hace21).length;

  const mastery = topicMastery(input.cards, input.questions, input.attempts);
  const weak = weakTopics(mastery, 5).map((id) => ({
    specialty: SPECIALTY[TOPIC[id].specialty].short,
    title: TOPIC[id].title,
    score: Math.round(mastery.get(id)?.score ?? 0),
  }));

  const reviewed = input.cards.reduce((n, c) => n + (c.reps || 0), 0);
  const lapses = input.cards.reduce((n, c) => n + (c.lapses || 0), 0);
  const answered = input.attempts.reduce((n, a) => n + a.answers.filter((x) => x !== null).length, 0);
  const right = input.attempts.reduce((n, a) => {
    return (
      n +
      a.answers.filter((ans, i) => {
        const q = input.questions.find((x) => x.id === a.questionIds[i]);
        return q && ans !== null && ans === q.correct;
      }).length
    );
  }, 0);

  return {
    adherence: pct(done, planned),
    planned,
    done,
    late: planned - done,
    byWeekday,
    byHour,
    medianMinutes,
    activeDays,
    weak,
    cards: { total: input.cards.length, due: 0, lapseRate: reviewed > 0 ? Math.round((lapses / reviewed) * 100) : null },
    exam: { answered, right },
    used: {
      flashcards: input.cards.length > 0,
      exams: answered > 0,
      ink: input.inkNotes > 0,
      audio: input.audioNotes > 0,
      hy: input.hyItems > 0,
      summaries: input.summaries > 0,
    },
  };
}

/** Las horas en las que de verdad estudias, de mayor a menor. */
export function bestHours(e: Evidence, n = 3): number[] {
  return e.byHour
    .map((m, h) => ({ m, h }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m)
    .slice(0, n)
    .map((x) => x.h);
}

/** Resumen en texto para mandárselo al motor de IA. Sin datos de pacientes: solo tu estudio. */
export function summarize(e: Evidence, cfg: InternshipConfig | null): string {
  const L: string[] = [];
  if (e.adherence !== null) L.push(`Cumplimiento del plan: ${e.adherence}% (${e.done} de ${e.planned} lecciones; ${e.late} pendientes).`);
  if (e.medianMinutes !== null) L.push(`Minutos de estudio registrados en un día típico: ${e.medianMinutes}.`);
  L.push(`Días con estudio en las últimas 3 semanas: ${e.activeDays} de 21.`);
  const hrs = bestHours(e);
  if (hrs.length) L.push(`Horas en que más estudia: ${hrs.map((h) => `${h}:00`).join(', ')}.`);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const flojo = e.byWeekday.map((m, i) => ({ m, i })).sort((a, b) => a.m - b.m)[0];
  if (e.byWeekday.some((m) => m > 0)) L.push(`Día de la semana con menos estudio: ${dias[flojo.i]}.`);
  if (e.cards.lapseRate !== null) L.push(`Tarjetas: ${e.cards.total}, con ${e.cards.lapseRate}% de olvidos al repasar.`);
  if (e.exam.answered > 0) L.push(`Simulacros: ${e.exam.right} aciertos de ${e.exam.answered} preguntas.`);
  if (e.weak.length) L.push(`Temas más flojos: ${e.weak.map((w) => `${w.title} (${w.specialty}, ${w.score}%)`).join('; ')}.`);
  const sin = Object.entries(e.used)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (sin.length) L.push(`Herramientas de la app que todavía no usa: ${sin.join(', ')}.`);
  if (cfg) {
    L.push(
      `Plan actual: ${cfg.dailyMinutes} min entre semana, ${cfg.weekendMinutes} el fin de semana, ${cfg.guardiaMinutes} el día de guardia, ` +
        `postguardia al ${Math.round(cfg.postGuardiaFactor * 100)}%, enfoque en la rotación ${Math.round(cfg.primaryShare * 100)}%, ` +
        `${cfg.reviewWeeks} semanas de repaso final, guardias cada ${cfg.guardiaEvery || 'sin guardias'}.`,
    );
  }
  return L.join('\n');
}
