import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { WidgetApp } from './widget/WidgetApp';
import { widgetKind } from './lib/widgets';
import { isDesktop } from './lib/platform';
// Se carga pronto: aplica tus cambios del temario antes de dibujar el plan.
import { useCurriculum } from './internship/curriculumStore';
import { startAutoBackup } from './lib/backup';
import { installExternalLinkHandler } from './lib/platform';
import { idb } from './lib/idb';
import './styles/global.css';

// Pide al navegador que no borre los datos locales (PDFs y notas) por falta de espacio.
void navigator.storage?.persist?.();

/**
 * Esta misma página sirve para los widgets flotantes: la ventana se abre con «?widget=…».
 * Un widget no respalda ni toca el temario; solo lee y escribe lo justo.
 */
const asWidget = widgetKind();
if (asWidget) {
  document.documentElement.dataset.widget = asWidget;
  installExternalLinkHandler();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <WidgetApp />
    </StrictMode>,
  );
} else {
  startMainWindow();
}

function startMainWindow() {
// Respaldo automático en la carpeta elegida (si la hay y tiene permiso).
startAutoBackup();
// PWA: instalable en Edge y abre sin conexión. Solo en el navegador, servida por http(s):
// en la app de escritorio y en el HTML de un solo archivo no hace falta y estorbaría.
registerServiceWorker();
// App de escritorio: los enlaces externos se abren en el navegador.
installExternalLinkHandler();
// Se quitó el hub de NotebookLM: borra sus datos guardados de versiones anteriores.
void idb.del('kv', 'sources');

void useCurriculum.getState();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
}


/**
 * Registra el service worker que hace a la app instalable y capaz de abrir sin internet.
 * No guarda nada tuyo: tus PDFs, tinta y notas viven en IndexedDB, aparte de esta caché.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (isDesktop()) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      /* sin service worker la app funciona igual, solo no se instala */
    });
  });
}
