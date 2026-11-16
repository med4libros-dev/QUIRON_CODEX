import { isDesktop } from './platform';

/**
 * Widgets flotantes: ventanitas pequeñas, siempre encima, que viven fuera de la ventana
 * principal (solo en la app de escritorio). Cada una muestra una cosa y comparte los mismos
 * datos: lo que capturas en un widget aparece al instante en la app.
 */
export type WidgetKind = 'glance' | 'ward' | 'review' | 'capture';

export interface WidgetMeta {
  kind: WidgetKind;
  title: string;
  hint: string;
  /** Tamaño inicial de la ventana. */
  w: number;
  h: number;
}

export const WIDGETS: WidgetMeta[] = [
  { kind: 'glance', title: 'Cápsula de estudio', hint: 'Fecha, reloj de estudio y el tema de hoy', w: 320, h: 190 },
  { kind: 'ward', title: 'Pendientes del turno', hint: 'Lo que toca y a qué hora, encima de todo', w: 320, h: 260 },
  { kind: 'review', title: 'Repaso pendiente', hint: 'Cuántas tarjetas te tocan hoy, con un toque para empezar', w: 300, h: 170 },
  { kind: 'capture', title: 'Captura rápida', hint: 'Soltar una perla, una nota o una flashcard sin abrir la app', w: 380, h: 300 },
];

interface TauriCore {
  invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
}
interface TauriEvent {
  listen?: (event: string, cb: (e: { payload?: unknown }) => void) => Promise<() => void>;
}
const api = () => (window as unknown as { __TAURI__?: { core?: TauriCore; event?: TauriEvent } }).__TAURI__;

/** ¿Este equipo puede abrir widgets? (solo la app de escritorio). */
export const widgetsAvailable = () => isDesktop() && !!api()?.core?.invoke;

/** ¿Esta ventana *es* un widget? */
export const widgetKind = (): WidgetKind | null => {
  const k = new URLSearchParams(location.search).get('widget');
  return WIDGETS.some((w) => w.kind === k) ? (k as WidgetKind) : null;
};

const call = async (cmd: string, args?: Record<string, unknown>) => {
  const invoke = api()?.core?.invoke;
  if (!invoke) throw new Error('Los widgets solo funcionan en la app de escritorio.');
  return invoke(cmd, args);
};

export const openWidget = (kind: WidgetKind) => {
  const m = WIDGETS.find((w) => w.kind === kind)!;
  return call('open_widget', { kind, width: m.w, height: m.h });
};
export const closeWidget = (kind: WidgetKind) => call('close_widget', { kind });

/** Widgets abiertos ahora mismo (lo responde la app de escritorio). */
export async function openWidgets(): Promise<WidgetKind[]> {
  try {
    const list = await call('list_widgets');
    return Array.isArray(list) ? (list as WidgetKind[]) : [];
  } catch {
    return [];
  }
}

/** Cierra esta ventana de widget. */
export const closeSelf = () => call('close_self').catch(() => window.close());

/** Escucha los avisos de la app de escritorio (atajos globales). */
export async function onDesktopEvent(name: string, fn: () => void): Promise<() => void> {
  const listen = api()?.event?.listen;
  if (!listen) return () => undefined;
  try {
    return await listen(name, () => fn());
  } catch {
    return () => undefined;
  }
}

/** Atajos del sistema (fijos, para no chocar con los de Windows). */
export const SHORTCUTS = {
  capture: 'Ctrl+Alt+Q',
  search: 'Ctrl+Alt+K',
  glance: 'Ctrl+Alt+G',
} as const;
