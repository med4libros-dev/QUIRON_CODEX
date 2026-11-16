import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// Se carga pronto: aplica tus cambios del temario antes de dibujar el plan.
import { useCurriculum } from './internship/curriculumStore';
import { startAutoBackup } from './lib/backup';
import { installExternalLinkHandler } from './lib/platform';
import { idb } from './lib/idb';
import './styles/global.css';

// Pide al navegador que no borre los datos locales (PDFs y notas) por falta de espacio.
void navigator.storage?.persist?.();
// Respaldo automático en la carpeta elegida (si la hay y tiene permiso).
startAutoBackup();
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
