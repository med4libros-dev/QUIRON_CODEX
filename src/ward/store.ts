import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';

/**
 * Lista de pacientes del turno. Es TEMPORAL a propósito:
 * - se guarda solo en este equipo (clave «qc:ward», fuera de los respaldos y de la nube),
 * - caduca sola al terminar el turno (o con «Terminar turno»).
 * Usa cama/alias, sexo y edad; nunca nombres.
 */
export type TaskKind = 'lab' | 'ic' | 'estudio' | 'otro';
export const TASK_KINDS: { id: TaskKind; label: string }[] = [
  { id: 'lab', label: 'Laboratorio' },
  { id: 'ic', label: 'Interconsulta' },
  { id: 'estudio', label: 'Estudio' },
  { id: 'otro', label: 'Otro' },
];

export interface WardTask {
  id: string;
  text: string;
  kind: TaskKind;
  done: boolean;
}
export interface WardPatient {
  id: string;
  bed: string;
  sex: 'masculino' | 'femenino' | '';
  age: string;
  weight: string;
  topicId: string | null;
  dx: string;
  note: string;
  tasks: WardTask[];
  createdAt: number;
}

export interface WardState {
  patients: WardPatient[];
  /** Fin del turno (ms). null = sin turno activo. */
  endsAt: number | null;
  startShift: (hours: number) => void;
  extendShift: (hours: number) => void;
  endShift: () => void;
  addPatient: (p?: Partial<WardPatient>) => string;
  updatePatient: (id: string, patch: Partial<WardPatient>) => void;
  removePatient: (id: string) => void;
  addTask: (pid: string, text: string, kind: TaskKind) => void;
  toggleTask: (pid: string, tid: string) => void;
  removeTask: (pid: string, tid: string) => void;
}

const mapP = (s: WardState, id: string, f: (p: WardPatient) => WardPatient) => ({ patients: s.patients.map((p) => (p.id === id ? f(p) : p)) });

export const useWard = createStore<WardState>(
  (set) => ({
    patients: [],
    endsAt: null,
    startShift: (h) => set({ endsAt: Date.now() + h * 3600_000 }),
    extendShift: (h) => set((s) => ({ endsAt: (s.endsAt ?? Date.now()) + h * 3600_000 })),
    endShift: () => set({ patients: [], endsAt: null }),
    addPatient: (p = {}) => {
      const id = uid();
      set((s) => ({
        patients: [...s.patients, { id, bed: '', sex: '', age: '', weight: '', topicId: null, dx: '', note: '', tasks: [], createdAt: Date.now(), ...p }],
        endsAt: s.endsAt ?? Date.now() + 12 * 3600_000,
      }));
      return id;
    },
    updatePatient: (id, patch) => set((s) => mapP(s, id, (p) => ({ ...p, ...patch }))),
    removePatient: (id) => set((s) => ({ patients: s.patients.filter((p) => p.id !== id) })),
    addTask: (pid, text, kind) => set((s) => mapP(s, pid, (p) => ({ ...p, tasks: [...p.tasks, { id: uid(), text, kind, done: false }] }))),
    toggleTask: (pid, tid) => set((s) => mapP(s, pid, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === tid ? { ...t, done: !t.done } : t)) }))),
    removeTask: (pid, tid) => set((s) => mapP(s, pid, (p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== tid) }))),
  }),
  { key: 'qc:ward', storage: 'local', pick: ({ patients, endsAt }) => ({ patients, endsAt }) },
);

/** Borra la lista si el turno ya terminó. Devuelve true si borró. */
export function purgeExpiredShift(now = Date.now()): boolean {
  const { endsAt, patients } = useWard.getState();
  if (endsAt !== null && now >= endsAt && patients.length) {
    useWard.getState().endShift();
    return true;
  }
  if (endsAt !== null && now >= endsAt) useWard.setState({ endsAt: null });
  return false;
}
