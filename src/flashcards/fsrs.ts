/**
 * FSRS (Free Spaced Repetition Scheduler), versión 4.5/5 con los pesos por defecto.
 *
 * A diferencia de SM-2, no arrastra un «factor de facilidad»: modela dos cosas por tarjeta,
 * la **estabilidad** (cuántos días aguanta la memoria antes de bajar al 90 % de probabilidad
 * de recordarla) y la **dificultad** (1–10). Con eso calcula el día exacto del siguiente repaso
 * para la retención que pidas. Son funciones puras: no tocan el almacén ni el reloj.
 */

/** 1 = Otra vez · 2 = Difícil · 3 = Bien · 4 = Fácil (escala del algoritmo). */
export type FsrsGrade = 1 | 2 | 3 | 4;

/** Pesos por defecto publicados por el proyecto FSRS. */
export const W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587,
  0.2272, 2.8755, 0.3042, 0.6758,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const MIN_S = 0.1;
const MAX_S = 36500;

export interface Memory {
  /** Estabilidad en días. */
  s: number;
  /** Dificultad 1–10. */
  d: number;
}

const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Probabilidad de acordarse tras `t` días con estabilidad `s`. */
export const retrievability = (t: number, s: number) => Math.pow(1 + (FACTOR * Math.max(0, t)) / Math.max(MIN_S, s), DECAY);

/** Memoria inicial tras la primera respuesta. */
export function initial(g: FsrsGrade): Memory {
  return { s: Math.max(MIN_S, W[g - 1]), d: clampD(W[4] - (g - 3) * W[5]) };
}

const nextD = (d: number, g: FsrsGrade) => {
  const delta = d - W[6] * (g - 3);
  // Reversión a la media: con el tiempo la dificultad tiende a la de un «Bien» inicial (W[4]).
  return clampD(W[7] * W[4] + (1 - W[7]) * delta);
};

/** Estabilidad tras un fallo («Otra vez»). */
const lapseS = (m: Memory, r: number) =>
  Math.min(
    m.s,
    Math.max(MIN_S, W[11] * Math.pow(m.d, -W[12]) * (Math.pow(m.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r))),
  );

/** Estabilidad tras un acierto. */
const recallS = (m: Memory, r: number, g: FsrsGrade) => {
  const hard = g === 2 ? W[15] : 1;
  const easy = g === 4 ? W[16] : 1;
  const inc = Math.exp(W[8]) * (11 - m.d) * Math.pow(m.s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy;
  return Math.min(MAX_S, Math.max(MIN_S, m.s * (1 + inc)));
};

/**
 * Siguiente estado de la memoria.
 * @param m memoria actual (null = tarjeta nueva)
 * @param elapsed días transcurridos desde el último repaso
 */
export function next(m: Memory | null, g: FsrsGrade, elapsed: number): Memory {
  if (!m) return initial(g);
  const r = retrievability(elapsed, m.s);
  return { s: g === 1 ? lapseS(m, r) : recallS(m, r, g), d: nextD(m.d, g) };
}

/** Días hasta el siguiente repaso para la retención deseada (0.80–0.97). */
export function intervalFor(s: number, retention = 0.9, max = 365): number {
  const r = Math.min(0.97, Math.max(0.8, retention));
  const days = (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
  return Math.min(max, Math.max(1, Math.round(days)));
}

/**
 * Convierte una tarjeta vieja de SM-2 a memoria FSRS: el intervalo que ya tenía es una buena
 * estimación de su estabilidad, y la facilidad (1.3–3.0) se mapea a dificultad (10–1).
 */
export const fromSm2 = (interval: number, ease: number): Memory => ({
  s: Math.max(MIN_S, interval || 1),
  d: clampD(10 - ((ease - 1.3) / 1.7) * 9),
});
