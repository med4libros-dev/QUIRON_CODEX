import { createStore } from '../lib/createStore';
import { usePlanner } from './planner';

export type Phase = 'focus' | 'short' | 'long';
export const PHASE_LABEL: Record<Phase, string> = { focus: 'Enfoque', short: 'Descanso', long: 'Descanso largo' };

export interface PomodoroState {
  focusMin: number;
  shortMin: number;
  longMin: number;
  longEvery: number;
  phase: Phase;
  running: boolean;
  /** Marca de tiempo de fin: el temporizador es exacto aunque recargues o la pestaña duerma. */
  endAt: number | null;
  remainingMs: number;
  completedFocus: number;
  subjectId: string | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  complete: () => void;
  setDurations: (p: Partial<Pick<PomodoroState, 'focusMin' | 'shortMin' | 'longMin' | 'longEvery'>>) => void;
  setSubject: (id: string | null) => void;
}

type Durations = Pick<PomodoroState, 'focusMin' | 'shortMin' | 'longMin'>;
export const phaseMs = (s: Durations, p: Phase) =>
  (p === 'focus' ? s.focusMin : p === 'short' ? s.shortMin : s.longMin) * 60_000;

export const usePomodoro = createStore<PomodoroState>(
  (set, get) => {
    const advance = (countFocus: boolean) =>
      set((s) => {
        if (s.phase === 'focus') {
          const done = s.completedFocus + (countFocus ? 1 : 0);
          const next: Phase = countFocus && done % s.longEvery === 0 ? 'long' : 'short';
          return { phase: next, completedFocus: done, running: false, endAt: null, remainingMs: phaseMs(s, next) };
        }
        return { phase: 'focus', running: false, endAt: null, remainingMs: phaseMs(s, 'focus') };
      });

    return {
      focusMin: 25,
      shortMin: 5,
      longMin: 15,
      longEvery: 4,
      phase: 'focus',
      running: false,
      endAt: null,
      remainingMs: 25 * 60_000,
      completedFocus: 0,
      subjectId: null,

      start: () => set((s) => (s.running ? {} : { running: true, endAt: Date.now() + s.remainingMs })),
      pause: () =>
        set((s) =>
          !s.running || !s.endAt ? {} : { running: false, endAt: null, remainingMs: Math.max(0, s.endAt - Date.now()) },
        ),
      reset: () => set((s) => ({ running: false, endAt: null, remainingMs: phaseMs(s, s.phase) })),
      skip: () => {
        const s = get();
        if (s.phase === 'focus') {
          // Registra el tiempo de enfoque real aunque se salte el bloque.
          const remaining = s.running && s.endAt ? s.endAt - Date.now() : s.remainingMs;
          const minutes = Math.floor((phaseMs(s, 'focus') - remaining) / 60_000);
          if (minutes >= 1) usePlanner.getState().logFocus(minutes, s.subjectId);
        }
        advance(false);
      },
      complete: () => {
        const s = get();
        if (s.phase === 'focus') usePlanner.getState().logFocus(s.focusMin, s.subjectId);
        advance(true);
      },
      setDurations: (p) =>
        set((s) => {
          const merged = { ...s, ...p };
          return s.running ? p : { ...p, remainingMs: phaseMs(merged, s.phase) };
        }),
      setSubject: (subjectId) => set({ subjectId }),
    };
  },
  {
    key: 'alq:pomodoro',
    storage: 'local',
    pick: ({ focusMin, shortMin, longMin, longEvery, phase, running, endAt, remainingMs, completedFocus, subjectId }) => ({
      focusMin, shortMin, longMin, longEvery, phase, running, endAt, remainingMs, completedFocus, subjectId,
    }),
  },
);
