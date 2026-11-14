import type { Card } from '../flashcards/store';
import { questionStats, type Attempt, type Question } from '../exam/store';

/**
 * Dominio por tema (0–100) a partir de lo que de verdad haces:
 * aciertos en simulacros (pesan más) y facilidad/olvidos de tus flashcards.
 */
export interface Mastery {
  score: number;
  /** Cuánta evidencia hay (preguntas respondidas + tarjetas repasadas). */
  evidence: number;
  exam: { seen: number; right: number };
  cards: { reviewed: number; lapses: number };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function topicMastery(cards: Card[], questions: Question[], attempts: Attempt[]): Map<string, Mastery> {
  const acc = new Map<string, { examW: number; examSum: number; seen: number; right: number; cardW: number; cardSum: number; reviewed: number; lapses: number }>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { examW: 0, examSum: 0, seen: 0, right: 0, cardW: 0, cardSum: 0, reviewed: 0, lapses: 0 }));
    return a;
  };
  const stats = questionStats(attempts, questions);
  for (const q of questions) {
    const s = stats.get(q.id);
    if (!q.topicId || !s) continue;
    const a = get(q.topicId);
    // Proporción de aciertos con más peso al intento más reciente.
    const rate = (s.right / s.seen) * 0.6 + (s.last ? 1 : 0) * 0.4;
    a.examSum += rate * 100;
    a.examW += 1;
    a.seen += s.seen;
    a.right += s.right;
  }
  for (const c of cards) {
    if (!c.topicId || (c.reps === 0 && c.lapses === 0)) continue;
    const a = get(c.topicId);
    const easeScore = ((c.ease - 1.3) / (2.8 - 1.3)) * 100;
    a.cardSum += clamp(easeScore - c.lapses * 8);
    a.cardW += 1;
    a.reviewed += 1;
    a.lapses += c.lapses;
  }
  const out = new Map<string, Mastery>();
  for (const [id, a] of acc) {
    const wE = a.examW * 2;
    const wC = a.cardW;
    const score = (a.examW ? (a.examSum / a.examW) * wE : 0) + (a.cardW ? (a.cardSum / a.cardW) * wC : 0);
    out.set(id, {
      score: Math.round(clamp(score / (wE + wC))),
      evidence: a.seen + a.reviewed,
      exam: { seen: a.seen, right: a.right },
      cards: { reviewed: a.reviewed, lapses: a.lapses },
    });
  }
  return out;
}

/** Temas débiles: dominio bajo con evidencia suficiente para no ser casualidad. */
export function weakTopics(m: Map<string, Mastery>, limit = 5, threshold = 60): string[] {
  return [...m.entries()]
    .filter(([, v]) => v.evidence >= 2 && v.score < threshold)
    .sort((a, b) => a[1].score - b[1].score || b[1].evidence - a[1].evidence)
    .slice(0, limit)
    .map(([id]) => id);
}

export const masteryColor = (score: number | null) =>
  score === null ? 'var(--surface-3)' : score < 40 ? '#e0614d' : score < 60 ? '#e8963c' : score < 80 ? '#d9c24a' : '#7fb35a';
