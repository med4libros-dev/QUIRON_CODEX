import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startAutoBackup } from './lib/backup';
import { installExternalLinkHandler } from './lib/platform';
import './styles/global.css';

// Pide al navegador que no borre los datos locales (PDFs y notas) por falta de espacio.
void navigator.storage?.persist?.();
// Respaldo automático en la carpeta elegida (si la hay y tiene permiso).
startAutoBackup();
// App de escritorio: los enlaces externos se abren en el navegador.
installExternalLinkHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
