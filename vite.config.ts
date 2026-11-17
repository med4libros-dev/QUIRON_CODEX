import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// pdf.js usa sintaxis moderna (ES2022); el worker se sirve como archivo aparte
// para que el render de PDFs pesados nunca bloquee la interfaz.
export default defineConfig({
  // Rutas relativas: el mismo build sirve en la app de escritorio y bajo un subdirectorio (GitHub Pages).
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  // Tauri (app de escritorio) espera el servidor de desarrollo en este puerto fijo.
  server: { open: !process.env.TAURI_ENV_PLATFORM, port: 5173, strictPort: true },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
});
