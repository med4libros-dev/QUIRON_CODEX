import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';
import { TOPICS } from '../internship/curriculum';

/** Pregunta tipo ENARM: viñeta clínica + pregunta + 4–5 opciones, cada una con su porqué. */
export interface ExamOption {
  text: string;
  /** Por qué es correcta o incorrecta. */
  why: string;
}
export interface Question {
  id: string;
  topicId: string | null;
  vignette: string;
  question: string;
  options: ExamOption[];
  correct: number;
  /** Página de la GPC que sustenta la respuesta. */
  cite: { docId: string; docName: string; page: number } | null;
  origin: 'ia' | 'manual' | 'importada';
  /** Las generadas con IA empiezan «por revisar» hasta que el estudiante las valida. */
  reviewed: boolean;
  createdAt: number;
}

export interface Attempt {
  id: string;
  date: string;
  title: string;
  questionIds: string[];
  /** Índice elegido por pregunta (null = sin responder). */
  answers: (number | null)[];
  seconds: number;
}

export interface ExamState {
  questions: Question[];
  attempts: Attempt[];
  addQuestions: (qs: Omit<Question, 'id' | 'createdAt'>[]) => string[];
  updateQuestion: (id: string, patch: Partial<Question>) => void;
  removeQuestion: (id: string) => void;
  addAttempt: (a: Omit<Attempt, 'id'>) => string;
  importQuestions: (list: unknown) => number;
}

/** Valida una pregunta venida de fuera (IA o archivo). Devuelve null si no sirve. */
export function sanitizeQuestion(raw: unknown): Omit<Question, 'id' | 'createdAt' | 'origin' | 'reviewed' | 'cite' | 'topicId'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const vignette = str(r.vignette ?? r.viñeta ?? r.caso, 2000);
  const question = str(r.question ?? r.pregunta, 600);
  const opts = Array.isArray(r.options ?? r.opciones) ? ((r.options ?? r.opciones) as unknown[]) : [];
  const options = opts
    .map((o) => (typeof o === 'string' ? { text: o.trim().slice(0, 400), why: '' } : o && typeof o === 'object' ? { text: str((o as Record<string, unknown>).text ?? (o as Record<string, unknown>).texto, 400), why: str((o as Record<string, unknown>).why ?? (o as Record<string, unknown>).porque, 900) } : null))
    .filter((o): o is ExamOption => !!o && !!o.text);
  const correct = Number(r.correct ?? r.correcta);
  if (!vignette || !question || options.length < 3 || options.length > 6 || !Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
  return { vignette, question, options, correct };
}

export const useExam = createStore<ExamState>(
  (set) => ({
    questions: [],
    attempts: [],
    addQuestions: (qs) => {
      const now = Date.now();
      const withIds = qs.map((q) => ({ ...q, id: uid(), createdAt: now }));
      set((s) => ({ questions: [...withIds, ...s.questions] }));
      return withIds.map((q) => q.id);
    },
    updateQuestion: (id, patch) => set((s) => ({ questions: s.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),
    removeQuestion: (id) => set((s) => ({ questions: s.questions.filter((q) => q.id !== id) })),
    addAttempt: (a) => {
      const id = uid();
      set((s) => ({ attempts: [{ ...a, id }, ...s.attempts].slice(0, 300) }));
      return id;
    },
    importQuestions: (list) => {
      if (!Array.isArray(list)) throw new Error('El archivo no contiene una lista de preguntas.');
      const fresh: Question[] = [];
      for (const raw of list) {
        const q = sanitizeQuestion(raw);
        if (!q) continue;
        const r = raw as Record<string, unknown>;
        fresh.push({
          ...q,
          id: uid(),
          createdAt: Date.now(),
          topicId: typeof r.topicId === 'string' && TOPICS.some((t) => t.id === r.topicId) ? r.topicId : null,
          cite: null,
          origin: 'importada',
          reviewed: false,
        });
      }
      if (fresh.length) set((s) => ({ questions: [...fresh, ...s.questions] }));
      return fresh.length;
    },
  }),
  { key: 'exam', storage: 'idb', pick: ({ questions, attempts }) => ({ questions, attempts }) },
);

/** Desempeño por pregunta (último intento de cada una cuenta más). */
export function questionStats(attempts: Attempt[], questions: Question[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const stats = new Map<string, { seen: number; right: number; last: boolean }>();
  // attempts vienen del más nuevo al más viejo: recorrer al revés para que «last» sea el más reciente.
  for (const a of [...attempts].reverse()) {
    a.questionIds.forEach((qid, i) => {
      const q = byId.get(qid);
      if (!q || a.answers[i] === null) return;
      const ok = a.answers[i] === q.correct;
      const s = stats.get(qid) ?? { seen: 0, right: 0, last: false };
      s.seen += 1;
      if (ok) s.right += 1;
      s.last = ok;
      stats.set(qid, s);
    });
  }
  return stats;
}
