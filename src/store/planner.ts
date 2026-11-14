import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';
import { todayKey } from '../lib/date';
import type { FocusLog, Goal, StudySession, Subject } from '../types';

export interface PlannerState {
  subjects: Subject[];
  sessions: StudySession[];
  goals: Goal[];
  logs: FocusLog[];
  addSubject: (name: string, color: string) => string;
  removeSubject: (id: string) => void;
  addSession: (s: Omit<StudySession, 'id' | 'done'> & { done?: boolean }) => string;
  updateSession: (id: string, patch: Partial<Omit<StudySession, 'id'>>) => void;
  removeSession: (id: string) => void;
  addGoal: (g: Omit<Goal, 'id' | 'createdAt'>) => void;
  removeGoal: (id: string) => void;
  logFocus: (minutes: number, subjectId: string | null) => void;
}

const DEFAULT_SUBJECTS: Subject[] = (
  [
    ['Cardiología', '#ef4444'],
    ['Neumología', '#0ea5e9'],
    ['Gastroenterología', '#f59e0b'],
    ['Nefrología', '#8b5cf6'],
    ['Endocrinología', '#14b8a6'],
    ['Infectología', '#22c55e'],
    ['Neurología', '#6366f1'],
    ['Pediatría', '#ec4899'],
    ['Ginecología y Obstetricia', '#d946ef'],
    ['Cirugía', '#64748b'],
  ] as const
).map(([name, color], i) => ({ id: `subj-${i}`, name, color }));

export const usePlanner = createStore<PlannerState>(
  (set) => ({
    subjects: DEFAULT_SUBJECTS,
    sessions: [],
    goals: [],
    logs: [],

    addSubject: (name, color) => {
      const id = uid();
      set((s) => ({ subjects: [...s.subjects, { id, name, color }] }));
      return id;
    },
    removeSubject: (id) =>
      set((s) => ({
        subjects: s.subjects.filter((x) => x.id !== id),
        sessions: s.sessions.map((x) => (x.subjectId === id ? { ...x, subjectId: null } : x)),
      })),

    addSession: (data) => {
      const id = uid();
      set((s) => ({ sessions: [...s.sessions, { done: false, ...data, id }] }));
      return id;
    },
    updateSession: (id, patch) => set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),

    addGoal: (g) => set((s) => ({ goals: [...s.goals, { ...g, id: uid(), createdAt: Date.now() }] })),
    removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

    logFocus: (minutes, subjectId) =>
      set((s) => ({ logs: [...s.logs, { id: uid(), date: todayKey(), minutes, subjectId, at: Date.now() }] })),
  }),
  {
    key: 'alq:planner',
    storage: 'local',
    pick: ({ subjects, sessions, goals, logs }) => ({ subjects, sessions, goals, logs }),
  },
);
