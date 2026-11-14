import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';
import type { SpecialtyId } from '../internship/types';

/** Bitácora de procedimientos y diario de reflexión del internado. Sin datos de pacientes. */
export type ProcRole = 'observé' | 'asistí' | 'realicé';
export const PROC_ROLES: ProcRole[] = ['observé', 'asistí', 'realicé'];

export interface ProcType {
  id: string;
  name: string;
  /** Meta personal de veces «realicé» (opcional). */
  target: number | null;
  /** Tus pasos, material y complicaciones a vigilar (los capturas tú). */
  steps: string;
}
export interface ProcEntry {
  id: string;
  typeId: string;
  date: string;
  specialty: SpecialtyId | null;
  role: ProcRole;
  note: string;
  createdAt: number;
}
export interface JournalEntry {
  id: string;
  date: string;
  learned: string;
  hard: string;
  differently: string;
  createdAt: number;
}

export interface LogbookState {
  types: ProcType[];
  entries: ProcEntry[];
  journal: JournalEntry[];
  addType: (name: string, target?: number | null) => string;
  updateType: (id: string, patch: Partial<ProcType>) => void;
  removeType: (id: string) => void;
  addEntry: (e: Omit<ProcEntry, 'id' | 'createdAt'>) => string;
  removeEntry: (id: string) => void;
  saveJournal: (e: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  removeJournal: (id: string) => void;
}

/** Lista inicial editable: solo nombres (sin metas ni pasos: esos los defines tú). */
const DEFAULT_TYPES = ['Venopunción', 'Gasometría arterial', 'Sonda nasogástrica', 'Sonda vesical', 'Sutura', 'Curación de herida', 'Atención de parto', 'Toma de citología', 'Electrocardiograma', 'Reanimación neonatal'];

export const useLogbook = createStore<LogbookState>(
  (set) => ({
    types: DEFAULT_TYPES.map((name, i) => ({ id: `pt-${i}`, name, target: null, steps: '' })),
    entries: [],
    journal: [],
    addType: (name, target = null) => {
      const id = uid();
      set((s) => ({ types: [...s.types, { id, name, target, steps: '' }] }));
      return id;
    },
    updateType: (id, patch) => set((s) => ({ types: s.types.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    removeType: (id) => set((s) => ({ types: s.types.filter((t) => t.id !== id), entries: s.entries.filter((e) => e.typeId !== id) })),
    addEntry: (e) => {
      const id = uid();
      set((s) => ({ entries: [{ ...e, id, createdAt: Date.now() }, ...s.entries] }));
      return id;
    },
    removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    // Una entrada por día: si ya existe la de esa fecha, se reemplaza.
    saveJournal: (e) =>
      set((s) => {
        const prev = s.journal.find((j) => j.date === e.date);
        const entry = { ...e, id: prev?.id ?? uid(), createdAt: prev?.createdAt ?? Date.now() };
        return { journal: [entry, ...s.journal.filter((j) => j.date !== e.date)].sort((a, b) => (a.date < b.date ? 1 : -1)) };
      }),
    removeJournal: (id) => set((s) => ({ journal: s.journal.filter((j) => j.id !== id) })),
  }),
  { key: 'logbook', storage: 'idb', pick: ({ types, entries, journal }) => ({ types, entries, journal }) },
);

export function procCounts(entries: ProcEntry[], typeId: string) {
  const c = { observé: 0, asistí: 0, realicé: 0 };
  for (const e of entries) if (e.typeId === typeId) c[e.role]++;
  return c;
}
