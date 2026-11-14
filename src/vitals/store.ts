import { createStore } from '../lib/createStore';

/**
 * Signos vitales normales por grupo de edad. Los rangos los capturas tú (de tu GPC o libro);
 * la app solo compara. Los límites de edad de cada grupo también son editables.
 */
export interface VitalRange {
  min: number | null;
  max: number | null;
}
export interface AgeGroup {
  id: string;
  label: string;
  /** Edad desde (incl.) y hasta (excl.), en meses. */
  fromMonths: number;
  toMonths: number;
  fc: VitalRange;
  fr: VitalRange;
  tas: VitalRange;
}
export type VitalKey = 'fc' | 'fr' | 'tas';
export const VITAL_LABEL: Record<VitalKey, string> = { fc: 'FC (lpm)', fr: 'FR (rpm)', tas: 'TA sistólica (mmHg)' };

const empty = (): VitalRange => ({ min: null, max: null });
const G = (id: string, label: string, fromMonths: number, toMonths: number): AgeGroup => ({ id, label, fromMonths, toMonths, fc: empty(), fr: empty(), tas: empty() });

export const useVitals = createStore<{ groups: AgeGroup[]; setRange: (gid: string, k: VitalKey, r: VitalRange) => void; setAges: (gid: string, fromMonths: number, toMonths: number) => void }>(
  (set) => ({
    groups: [
      G('neo', 'Recién nacido', 0, 1),
      G('lmen', 'Lactante menor', 1, 12),
      G('lmay', 'Lactante mayor', 12, 24),
      G('pre', 'Preescolar', 24, 72),
      G('esc', 'Escolar', 72, 144),
      G('ado', 'Adolescente', 144, 216),
      G('adu', 'Adulto', 216, 1800),
    ],
    setRange: (gid, k, r) => set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, [k]: r } : g)) })),
    setAges: (gid, fromMonths, toMonths) => set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, fromMonths, toMonths } : g)) })),
  }),
  { key: 'vitals', storage: 'idb', pick: ({ groups }) => ({ groups }) },
);

/** «8 m», «8 meses», «3 a», «3», «15 d» → meses. */
export function parseAgeMonths(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(d|dias|días|m|mes|meses|a|años|anos)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2] ?? 'a';
  if (u.startsWith('d')) return n / 30;
  if (u.startsWith('m')) return n;
  return n * 12;
}

export function groupFor(groups: AgeGroup[], months: number | null): AgeGroup | null {
  if (months === null) return null;
  return groups.find((g) => months >= g.fromMonths && months < g.toMonths) ?? null;
}

/** 'low' | 'high' | 'ok' | null (sin rango capturado o sin dato). */
export function checkVital(g: AgeGroup | null, k: VitalKey, value: number | null): 'low' | 'high' | 'ok' | null {
  if (!g || value === null || Number.isNaN(value)) return null;
  const r = g[k];
  if (r.min === null && r.max === null) return null;
  if (r.min !== null && value < r.min) return 'low';
  if (r.max !== null && value > r.max) return 'high';
  return 'ok';
}
