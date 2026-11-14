import { useSettings } from '../store/settings';
import { useCards, dueCards } from '../flashcards/store';
import { useExam } from '../exam/store';
import { topicMastery, weakTopics } from '../analytics/mastery';
import { TOPIC } from '../internship/curriculum';
import { useWard } from '../ward/store';
import { todayKey } from './date';
import { notify } from './notify';

/**
 * Recordatorios mientras la app está abierta (también minimizada):
 *  - aviso diario a tu hora: flashcards del día y temas de refuerzo,
 *  - pendientes del turno con hora («BH 14:00»),
 *  - 30 min antes de que termine el turno.
 * Cada aviso sale una sola vez (se anota en este equipo).
 */
const DAILY_KEY = 'qc:remindedDaily';
const SHIFT_KEY = 'qc:shiftWarned';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export function dailySummary(): { title: string; body: string } | null {
  const cards = useCards.getState().cards;
  const { questions, attempts } = useExam.getState();
  const due = dueCards(cards).length;
  const asked = cards.filter((c) => c.asked).length;
  const weak = weakTopics(topicMastery(cards, questions, attempts), 3).map((id) => TOPIC[id]?.title ?? id);
  const parts: string[] = [];
  if (due) parts.push(`${due} flashcard${due === 1 ? '' : 's'} para hoy`);
  if (weak.length) parts.push(`refuerzo: ${weak.join(', ')}`);
  if (asked && !due) parts.push(`${asked} «me lo preguntaron» para repasar`);
  if (!parts.length) return null;
  return { title: 'Quirón Codex · tu repaso de hoy', body: parts.join(' · ') };
}

export function checkReminders(now = new Date()) {
  const s = useSettings.getState();
  if (!s.reminders) return;
  const today = todayKey();
  // 1) Diario.
  if (now.getHours() >= s.reminderHour && localStorage.getItem(DAILY_KEY) !== today) {
    localStorage.setItem(DAILY_KEY, today);
    const d = dailySummary();
    if (d) notify(d.title, d.body);
  }
  // 2) Pendientes del turno con hora.
  const ward = useWard.getState();
  const nowHm = hhmm(now);
  for (const p of ward.patients)
    for (const t of p.tasks)
      if (t.at && !t.done && !t.notified && t.at <= nowHm) {
        ward.markNotified(p.id, t.id);
        notify(`Pendiente · ${p.bed || 'paciente'}`, `${t.at} — ${t.text}`);
      }
  // 3) Fin de turno.
  if (ward.endsAt && ward.patients.length) {
    const left = ward.endsAt - now.getTime();
    if (left > 0 && left <= 30 * 60_000 && localStorage.getItem(SHIFT_KEY) !== String(ward.endsAt)) {
      localStorage.setItem(SHIFT_KEY, String(ward.endsAt));
      const open = ward.patients.reduce((n, p) => n + p.tasks.filter((t) => !t.done).length, 0);
      notify('El turno termina en 30 min', open ? `${open} pendiente${open === 1 ? '' : 's'} sin cerrar. Haz la entrega y registra tus casos.` : 'Registra tus casos antes de que se borre la lista.');
    }
  }
}

export function startReminders() {
  checkReminders();
  const t = setInterval(() => checkReminders(), 30_000);
  return () => clearInterval(t);
}
