import { addDays, monthBounds, toKey, weekBounds } from './date';
import type { FocusLog, Goal, StudySession } from '../types';

export type Range = [string, string];
export const ALL_TIME: Range = ['0000-00-00', '9999-99-99'];
const inRange = (k: string, [a, b]: Range) => k >= a && k <= b;

/** subjectId null/undefined = todas las materias. */
export function focusMinutes(logs: FocusLog[], range: Range, subjectId?: string | null): number {
  return logs.reduce((acc, l) => (inRange(l.date, range) && (subjectId == null || l.subjectId === subjectId) ? acc + l.minutes : acc), 0);
}

export function sessionsIn(sessions: StudySession[], range: Range, subjectId?: string | null): StudySession[] {
  return sessions.filter((s) => inRange(s.date, range) && (subjectId == null || s.subjectId === subjectId));
}

export function goalRange(g: Goal, now = new Date()): Range {
  if (g.period === 'week') return weekBounds(now);
  if (g.period === 'month') return monthBounds(now);
  return ALL_TIME;
}

export function goalValue(g: Goal, logs: FocusLog[], sessions: StudySession[], now = new Date()): number {
  const r = goalRange(g, now);
  return g.metric === 'focusMinutes'
    ? focusMinutes(logs, r, g.subjectId)
    : sessionsIn(sessions, r, g.subjectId).filter((s) => s.done).length;
}

/** Días consecutivos con actividad (Pomodoro o sesión completada). Hoy cuenta si ya hubo actividad. */
export function streak(logs: FocusLog[], sessions: StudySession[], today = new Date()): number {
  const active = new Set<string>([...logs.map((l) => l.date), ...sessions.filter((s) => s.done).map((s) => s.date)]);
  let d = today;
  if (!active.has(toKey(d))) d = addDays(d, -1);
  let n = 0;
  while (active.has(toKey(d))) {
    n += 1;
    d = addDays(d, -1);
  }
  return n;
}

export function minutesByDay(logs: FocusLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) m.set(l.date, (m.get(l.date) ?? 0) + l.minutes);
  return m;
}
