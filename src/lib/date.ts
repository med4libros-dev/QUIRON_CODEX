export const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local → 'YYYY-MM-DD' (comparable como texto). */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => toKey(new Date());

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
/** Semana inicia en lunes. */
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

export const weekBounds = (d: Date): [string, string] => {
  const s = startOfWeek(d);
  return [toKey(s), toKey(addDays(s, 6))];
};
export const monthBounds = (d: Date): [string, string] => [
  toKey(startOfMonth(d)),
  toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
];

export const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('es-MX', o);
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
