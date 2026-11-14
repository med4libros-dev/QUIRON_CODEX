import { useSyncExternalStore } from 'react';

/**
 * Entorno de ejecución: navegador (archivo/servidor) o app de escritorio (Tauri, WebView2 en Windows).
 * En escritorio los enlaces externos se abren en el navegador predeterminado, no dentro de la app.
 */
type TauriGlobal = { opener?: { openUrl: (url: string) => Promise<void> } };
const tauri = () => (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;

export const isDesktop = () => typeof window !== 'undefined' && !!tauri();

/** Abre un enlace externo (NotebookLM, GPC…) fuera de la app. */
export function openExternal(url: string) {
  const t = tauri();
  if (t?.opener) {
    t.opener.openUrl(url).catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** En escritorio, los <a target="_blank"> también salen al navegador. */
export function installExternalLinkHandler() {
  if (!isDesktop()) return;
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.hasAttribute('download')) return;
      const href = a.href;
      if (!/^https?:\/\//i.test(href) || a.origin === location.origin) return;
      e.preventDefault();
      openExternal(href);
    },
    true,
  );
  document.documentElement.dataset.desktop = 'true';
}

/** ¿Hay conexión? (NotebookLM y la búsqueda de GPC la necesitan; todo lo demás funciona sin internet.) */
const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine);
