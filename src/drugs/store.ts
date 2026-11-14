import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';

/**
 * Fichas de fármacos que TÚ capturas desde la GPC. La app solo hace la aritmética
 * (dosis por peso, volumen según presentación) y avisa si se rebasa el máximo que registraste.
 * No trae dosis precargadas.
 */
export interface Drug {
  id: string;
  name: string;
  /** Presentación, p. ej. «Suspensión 250 mg / 5 mL». */
  presentation: string;
  /** Concentración: mg en `concMl` mL (si es sólido, deja mL vacío). */
  concMg: number | null;
  concMl: number | null;
  /** «dose» = mg/kg por dosis · «day» = mg/kg/día dividido en `divisions` tomas. */
  basis: 'dose' | 'day';
  mgPerKg: number;
  divisions: number;
  maxMgPerDose: number | null;
  maxMgPerDay: number | null;
  route: string;
  frequency: string;
  notes: string;
  source: string;
  createdAt: number;
}

export interface DoseResult {
  perDoseMg: number;
  perDayMg: number;
  perDoseMl: number | null;
  capped: boolean;
  warnings: string[];
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Cálculo puro (probado en las pruebas). */
export function computeDose(d: Pick<Drug, 'basis' | 'mgPerKg' | 'divisions' | 'maxMgPerDose' | 'maxMgPerDay' | 'concMg' | 'concMl'>, kg: number): DoseResult | null {
  if (!(kg > 0) || !(d.mgPerKg > 0)) return null;
  const div = d.basis === 'day' ? Math.max(1, Math.round(d.divisions || 1)) : Math.max(1, Math.round(d.divisions || 1));
  let perDose = d.basis === 'dose' ? d.mgPerKg * kg : (d.mgPerKg * kg) / div;
  let perDay = perDose * div;
  const warnings: string[] = [];
  let capped = false;
  if (d.maxMgPerDose && perDose > d.maxMgPerDose) {
    warnings.push(`La dosis calculada (${round(perDose)} mg) rebasa tu máximo por dosis: se ajusta a ${d.maxMgPerDose} mg.`);
    perDose = d.maxMgPerDose;
    perDay = perDose * div;
    capped = true;
  }
  if (d.maxMgPerDay && perDay > d.maxMgPerDay) {
    warnings.push(`El total diario (${round(perDay)} mg) rebasa tu máximo por día (${d.maxMgPerDay} mg): se ajusta.`);
    perDay = d.maxMgPerDay;
    perDose = perDay / div;
    capped = true;
  }
  if (kg > 150) warnings.push('Peso muy alto: revisa si corresponde usar peso ideal o ajustado.');
  const perDoseMl = d.concMg && d.concMl ? (perDose * d.concMl) / d.concMg : null;
  return { perDoseMg: round(perDose), perDayMg: round(perDay), perDoseMl: perDoseMl === null ? null : round(perDoseMl, 2), capped, warnings };
}

export interface DrugsState {
  drugs: Drug[];
  add: (d: Omit<Drug, 'id' | 'createdAt'>) => string;
  update: (id: string, patch: Partial<Drug>) => void;
  remove: (id: string) => void;
}

export const useDrugs = createStore<DrugsState>(
  (set) => ({
    drugs: [],
    add: (d) => {
      const id = uid();
      set((s) => ({ drugs: [...s.drugs, { ...d, id, createdAt: Date.now() }].sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
      return id;
    },
    update: (id, patch) => set((s) => ({ drugs: s.drugs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    remove: (id) => set((s) => ({ drugs: s.drugs.filter((d) => d.id !== id) })),
  }),
  { key: 'drugs', storage: 'idb', pick: ({ drugs }) => ({ drugs }) },
);
