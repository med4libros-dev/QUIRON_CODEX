import { useEffect, useState } from 'react';
import { useLibrary } from '../store/library';
import { usePlanner } from '../store/planner';
import { useSettings } from '../store/settings';
import { todayKey } from './date';
import { inkBusy } from './inkBusy';

/**
 * Cronómetro automático de estudio.
 *
 * Cuenta el tiempo que de verdad estás leyendo o escribiendo: basta con que haya movimiento
 * (lápiz, teclado, desplazar el PDF, tocar la pantalla) dentro de Estudio o Cuadernos.
 * Si pasan 2 minutos sin nada, o cambias de ventana, el reloj se detiene solo y se reanuda al volver.
 * Cada minuto acumulado se guarda en tu progreso (el mismo registro que llena el Pomodoro),
 * con la materia del PDF abierto si la tiene.
 */
const IDLE_MS = 120_000;
const TICK_MS = 5_000;
/** Lo contado del minuto en curso, por si cierras la app a media cuenta. */
const CARRY_KEY = 'qc:focusCarry';

let activeMs = 0;
let lastEvent = 0;
let listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Minutos ya registrados hoy más lo que lleva el minuto en curso. */
export const autoFocusMs = () => activeMs;

function readCarry(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(CARRY_KEY) ?? 'null') as { date: string; ms: number } | null;
    return raw && raw.date === todayKey() ? raw.ms : 0;
  } catch {
    return 0;
  }
}
const writeCarry = (ms: number) => {
  try {
    localStorage.setItem(CARRY_KEY, JSON.stringify({ date: todayKey(), ms }));
  } catch {
    /* sin almacenamiento */
  }
};

/** Marca actividad; lo llaman los paneles de estudio y los eventos globales. */
export const markActivity = () => {
  lastEvent = Date.now();
};

/** Arranca el cronómetro global (una sola vez, desde App). */
export function startAutoFocus() {
  activeMs = readCarry();
  const onAny = () => markActivity();
  const opts = { passive: true, capture: true } as const;
  // Sin «pointermove»: mientras escribes, nada debe correr por cada punto del lápiz (el trazo ya marca actividad).
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'wheel', 'scroll'] as const) window.addEventListener(ev, onAny, opts);

  const timer = setInterval(() => {
    const s = useSettings.getState();
    const studying = s.view === 'study' || s.view === 'notebooks';
    const awake = document.visibilityState === 'visible' && (Date.now() - lastEvent < IDLE_MS || inkBusy(IDLE_MS));
    if (!studying || !awake) return;
    activeMs += TICK_MS;
    // Cada minuto completo se registra en el progreso.
    if (activeMs >= 60_000) {
      const minutes = Math.floor(activeMs / 60_000);
      activeMs -= minutes * 60_000;
      const doc = useLibrary.getState().docs.find((d) => d.id === s.activeDocId);
      usePlanner.getState().logFocus(minutes, doc?.subjectId ?? null);
    }
    writeCarry(activeMs);
    notify();
  }, TICK_MS);

  const save = () => writeCarry(activeMs);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', save);
  return () => {
    clearInterval(timer);
    for (const ev of ['pointerdown', 'pointerup', 'keydown', 'wheel', 'scroll'] as const) window.removeEventListener(ev, onAny, opts);
    window.removeEventListener('pagehide', save);
    document.removeEventListener('visibilitychange', save);
  };
}

/** Minutos de estudio de hoy (registrados + el minuto en curso) y si el reloj está contando ahora. */
export function useStudyToday() {
  const logs = usePlanner((s) => s.logs);
  const view = useSettings((s) => s.view);
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    const t = setInterval(l, 15_000);
    return () => {
      listeners.delete(l);
      clearInterval(t);
    };
  }, []);
  const today = todayKey();
  const logged = logs.reduce((n, l) => (l.date === today ? n + l.minutes : n), 0);
  const counting = (view === 'study' || view === 'notebooks') && document.visibilityState === 'visible' && (Date.now() - lastEvent < IDLE_MS || inkBusy(IDLE_MS));
  return { minutes: logged, partial: Math.floor(activeMs / 1000), counting };
}
