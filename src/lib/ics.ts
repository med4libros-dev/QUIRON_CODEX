import { downloadBlob } from './exportPdf';
import { addDays, fromKey, toKey, todayKey } from './date';
import { SPECIALTY } from '../internship/curriculum';
import { isGuardia } from '../internship/planner';
import { useInternship } from '../internship/store';
import { usePlanner } from '../store/planner';

/**
 * Exporta el plan a un archivo .ics: se abre en el calendario del teléfono (Google, Outlook,
 * Apple) y ahí ves tus rotaciones, guardias y sesiones de estudio junto a todo lo demás.
 * Es una foto del plan de hoy: si lo cambias, vuelves a exportar.
 */
export interface IcsOptions {
  rotations: boolean;
  guardias: boolean;
  sessions: boolean;
}

const stamp = (d: Date) => `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
const dateVal = (key: string) => key.replace(/-/g, '');
/** Las líneas del formato .ics no deben pasar de 75 octetos; se parten con un espacio al inicio. */
const fold = (line: string) => line.match(/.{1,73}/g)?.join('\r\n ') ?? line;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

interface Ev {
  uid: string;
  start: string;
  endExclusive: string;
  summary: string;
  description?: string;
}

const allDay = (e: Ev, now: Date) =>
  [
    'BEGIN:VEVENT',
    `UID:${e.uid}@quiron-codex`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${dateVal(e.start)}`,
    `DTEND;VALUE=DATE:${dateVal(e.endExclusive)}`,
    fold(`SUMMARY:${esc(e.summary)}`),
    ...(e.description ? [fold(`DESCRIPTION:${esc(e.description)}`)] : []),
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].join('\r\n');

export function buildIcs(opts: IcsOptions): string {
  const now = new Date();
  const evs: Ev[] = [];
  const cfg = useInternship.getState().config;

  if (opts.rotations && cfg) {
    for (const r of cfg.rotations) {
      evs.push({
        uid: `rot-${r.id}`,
        start: r.start,
        endExclusive: toKey(addDays(fromKey(r.end), 1)),
        summary: `Rotación: ${SPECIALTY[r.specialty]?.name ?? r.specialty}`,
        description: 'Plan del internado · Quirón Codex',
      });
    }
  }

  if (opts.guardias && cfg) {
    // Solo de hoy en adelante: el calendario no necesita las guardias ya pasadas.
    const from = todayKey() > cfg.start ? todayKey() : cfg.start;
    for (let k = from, guard = 0; k <= cfg.end && guard < 800; k = toKey(addDays(fromKey(k), 1)), guard++) {
      if (!isGuardia(cfg, k)) continue;
      evs.push({ uid: `gua-${k}`, start: k, endExclusive: toKey(addDays(fromKey(k), 1)), summary: 'Guardia', description: 'Plan del internado · Quirón Codex' });
    }
  }

  if (opts.sessions) {
    const { sessions, subjects } = usePlanner.getState();
    for (const s of sessions) {
      const subj = subjects.find((x) => x.id === s.subjectId)?.name;
      evs.push({
        uid: `ses-${s.id}`,
        start: s.date,
        endExclusive: toKey(addDays(fromKey(s.date), 1)),
        summary: `Estudio: ${s.topic}`,
        description: [subj, `${s.minutes} min`, s.done ? 'Hecha' : ''].filter(Boolean).join(' · '),
      });
    }
  }

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quirón Codex//Plan//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Quirón Codex',
    ...evs.map((e) => allDay(e, now)),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Cuántos eventos saldrían con estas opciones (para avisarlo antes de descargar). */
export const icsCount = (opts: IcsOptions) => (buildIcs(opts).match(/BEGIN:VEVENT/g) ?? []).length;

export function exportIcs(opts: IcsOptions) {
  const text = buildIcs(opts);
  downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), 'quiron-codex-plan.ics');
}
