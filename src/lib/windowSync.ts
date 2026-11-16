/**
 * Sincronización entre ventanas de la misma app (la principal y los widgets flotantes).
 *
 * Todas comparten el mismo almacenamiento, pero cada una tiene su copia en memoria: si el
 * widget de captura guarda una perla, la ventana principal no se entera hasta recargar.
 * Aquí cada ventana avisa por `BroadcastChannel` qué clave acaba de escribir y las demás
 * vuelven a leer *solo esa* clave. No viajan datos por el canal, solo el aviso.
 */

const CHANNEL = 'qc:sync';

/** Identifica a esta ventana para ignorar los avisos propios. */
export const WINDOW_ID = Math.random().toString(36).slice(2, 10);

type Reload = () => void;
const reloaders = new Map<string, Reload>();

let chan: BroadcastChannel | null = null;
function channel(): BroadcastChannel | null {
  if (chan !== null) return chan;
  try {
    chan = new BroadcastChannel(CHANNEL);
    chan.onmessage = (e: MessageEvent<{ from?: string; key?: string }>) => {
      const { from, key } = e.data ?? {};
      if (!key || from === WINDOW_ID) return;
      reloaders.get(key)?.();
    };
  } catch {
    // Navegador sin BroadcastChannel: cada ventana sigue por su cuenta.
    chan = null;
  }
  return chan;
}

/** Un almacén dice cómo volver a leerse cuando otra ventana lo cambie. */
export function registerSynced(key: string, reload: Reload): void {
  reloaders.set(key, reload);
  channel();
}

/** Avisa a las demás ventanas de que esta clave acaba de cambiar. */
export function announceWrite(key: string): void {
  try {
    channel()?.postMessage({ from: WINDOW_ID, key });
  } catch {
    /* el canal se cerró: no es grave */
  }
}

/** Mensajes sueltos entre ventanas (por ejemplo: «abre la búsqueda»). */
export function sendToWindows(kind: string, data?: unknown): void {
  try {
    channel()?.postMessage({ from: WINDOW_ID, kind, data });
  } catch {
    /* sin canal */
  }
}

export function onWindowMessage(kind: string, fn: (data: unknown) => void): () => void {
  const c = channel();
  if (!c) return () => undefined;
  const h = (e: MessageEvent<{ from?: string; kind?: string; data?: unknown }>) => {
    if (e.data?.kind === kind && e.data.from !== WINDOW_ID) fn(e.data.data);
  };
  c.addEventListener('message', h);
  return () => c.removeEventListener('message', h);
}
