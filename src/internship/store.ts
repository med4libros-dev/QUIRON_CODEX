import { createStore } from '../lib/createStore';
import type { InternshipConfig } from './types';

export interface InternshipState {
  config: InternshipConfig | null;
  /** Lecciones completadas: id de lección → fecha (YYYY-MM-DD) en que se marcó. */
  done: Record<string, string>;
  /** Días en «Modo supervivencia»: fecha → ids de lecciones que se movieron ese día. */
  survival: Record<string, string[]>;
  /** Lecciones reprogramadas: id de lección → nueva fecha. Se aplican encima del plan anual. */
  shifts: Record<string, string>;
  setConfig: (c: InternshipConfig) => void;
  toggleDone: (lessonId: string, date: string) => void;
  resetPlan: () => void;
  activateSurvival: (date: string, moves: Record<string, string>) => void;
  undoSurvival: (date: string) => void;
}

export const useInternship = createStore<InternshipState>(
  (set) => ({
    config: null,
    done: {},
    survival: {},
    shifts: {},
    setConfig: (config) => set({ config }),
    toggleDone: (id, date) =>
      set((s) => {
        const done = { ...s.done };
        if (done[id]) delete done[id];
        else done[id] = date;
        return { done };
      }),
    // Un plan nuevo descarta los ajustes: las fechas ya no corresponden.
    resetPlan: () => set({ config: null, survival: {}, shifts: {} }),
    activateSurvival: (date, moves) =>
      set((s) => ({
        survival: { ...s.survival, [date]: Object.keys(moves) },
        shifts: { ...s.shifts, ...moves },
      })),
    undoSurvival: (date) =>
      set((s) => {
        const survival = { ...s.survival };
        const shifts = { ...s.shifts };
        for (const id of survival[date] ?? []) delete shifts[id];
        delete survival[date];
        return { survival, shifts };
      }),
  }),
  {
    key: 'alq:internship',
    storage: 'local',
    pick: ({ config, done, survival, shifts }) => ({ config, done, survival, shifts }),
  },
);
