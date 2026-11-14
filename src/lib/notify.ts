/**
 * Avisos del sistema (Windows). En la app de escritorio usa el plugin de notificaciones de Tauri;
 * en el navegador, la API Notification. Si nada está disponible (o no hay permiso), muestra un aviso
 * dentro de la app.
 */
type Perm = 'granted' | 'denied' | 'default';
type TauriNotify = {
  isPermissionGranted?: () => Promise<boolean>;
  requestPermission?: () => Promise<Perm>;
  sendNotification?: (o: { title: string; body?: string }) => void;
};
type TauriGlobal = { notification?: TauriNotify; core?: { invoke: (cmd: string, args?: object) => Promise<unknown> } };
const tauri = () => (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;

let fallback: ((text: string) => void) | null = null;
/** La app registra cómo mostrar el aviso interno (toast). */
export const setNotifyFallback = (f: (text: string) => void) => {
  fallback = f;
};

export async function notifyPermission(): Promise<boolean> {
  const t = tauri();
  if (t?.notification?.isPermissionGranted) {
    if (await t.notification.isPermissionGranted()) return true;
    return (await t.notification.requestPermission?.()) === 'granted';
  }
  if (t?.core) {
    try {
      if ((await t.core.invoke('plugin:notification|is_permission_granted')) === true) return true;
      return (await t.core.invoke('plugin:notification|request_permission')) === 'granted';
    } catch {
      /* sigue con la API web */
    }
  }
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

export function notify(title: string, body = '') {
  const t = tauri();
  try {
    if (t?.notification?.sendNotification) {
      t.notification.sendNotification({ title, body });
      return 'system';
    }
    if (t?.core) {
      void t.core.invoke('plugin:notification|notify', { options: { title, body } }).catch(() => fallback?.(`${title} — ${body}`));
      return 'system';
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
      return 'system';
    }
  } catch {
    /* sigue con el aviso interno */
  }
  fallback?.(body ? `${title} — ${body}` : title);
  return 'toast';
}
