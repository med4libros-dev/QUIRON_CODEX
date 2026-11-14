import { useSyncExternalStore } from 'react';
import { idb } from './idb';

/**
 * Store reactivo mínimo (estilo Zustand) con persistencia opcional.
 * - Los componentes se suscriben con selectores: solo re-renderizan si cambia lo que leen.
 * - La escritura a disco es diferida (debounce) para no bloquear mientras escribes o dibujas.
 * - Al ocultar la pestaña o cerrar, se fuerzan las escrituras pendientes.
 */
export type SetState<T> = (patch: Partial<T> | ((state: T) => Partial<T>)) => void;

export interface PersistConfig<T> {
  key: string;
  storage: 'local' | 'idb';
  pick: (state: T) => Partial<T>;
}

export interface BoundStore<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState: () => T;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
  /** true cuando los datos guardados ya se cargaron. */
  useHydrated: () => boolean;
}

const flushers = new Set<() => void>();
let frozen = false;
/** Aviso a la interfaz cuando algo no se pudo guardar (p. ej. almacenamiento lleno). */
let onPersistError: ((key: string, e: unknown) => void) | null = null;
export const setPersistErrorHandler = (f: (key: string, e: unknown) => void) => {
  onPersistError = f;
};
/** Fuerza a disco todo lo pendiente (antes de un respaldo o una restauración). */
export const flushPersistence = () => flushers.forEach((f) => f());
/** Detiene toda escritura a disco (al restaurar un respaldo, antes de recargar la página). */
export function freezePersistence() {
  frozen = true;
}
if (typeof window !== 'undefined') {
  const flushAll = () => flushers.forEach((f) => f());
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}

export function createStore<T extends object>(
  init: (set: SetState<T>, get: () => T) => T,
  persist?: PersistConfig<T>,
): BoundStore<T> {
  const listeners = new Set<() => void>();
  let state = {} as T;
  let hydrated = !persist;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const notify = () => listeners.forEach((l) => l());

  const write = () => {
    if (!persist || !pending || frozen) return;
    pending = false;
    clearTimeout(timer);
    const data = JSON.stringify(persist.pick(state));
    if (persist.storage === 'local') {
      try {
        localStorage.setItem(persist.key, data);
      } catch (e) {
        console.warn('No se pudo guardar', persist.key, e);
        onPersistError?.(persist.key, e);
      }
    } else {
      idb.set('kv', persist.key, data).catch((e) => {
        console.warn('No se pudo guardar', persist.key, e);
        onPersistError?.(persist.key, e);
      });
    }
  };

  const schedule = () => {
    if (!persist || !hydrated) return;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(write, persist.storage === 'local' ? 200 : 350);
  };

  const set: SetState<T> = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : patch;
    if (!next || Object.keys(next).length === 0) return;
    state = { ...state, ...next };
    notify();
    schedule();
  };
  const get = () => state;

  state = init(set, get);

  if (persist) {
    flushers.add(write);
    const merge = (raw: string | null | undefined) => {
      if (!raw) return;
      try {
        state = { ...state, ...(JSON.parse(raw) as Partial<T>) };
      } catch (e) {
        console.warn('Datos guardados ilegibles en', persist.key, e);
      }
    };
    if (persist.storage === 'local') {
      try {
        merge(localStorage.getItem(persist.key));
      } catch {
        /* almacenamiento no disponible */
      }
      hydrated = true;
    } else {
      idb
        .get<string>('kv', persist.key)
        .then(merge, (e) => console.warn(e))
        .finally(() => {
          hydrated = true;
          notify();
        });
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore<U>(selector?: (s: T) => U): U {
    return useSyncExternalStore(subscribe, () => (selector ? selector(state) : (state as unknown as U)));
  }
  const useHydrated = () => useSyncExternalStore(subscribe, () => hydrated);

  return Object.assign(useStore, { getState: get, setState: set, subscribe, useHydrated }) as BoundStore<T>;
}
