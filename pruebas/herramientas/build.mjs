import * as esbuild from 'esbuild';
const TC = process.env.QC_TC || '/tmp/tc';
import { copyFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
/** La raíz del repo, deducida de este archivo: así corre igual aquí y en CI. */
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workerPlugin = {
  name: 'url-import',
  setup(b) {
    b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'urlmod' }));
    b.onLoad({ filter: /.*/, namespace: 'urlmod' }, () => ({ contents: 'export default "/pdf.worker.min.mjs";', loader: 'js' }));
  },
};
await esbuild.build({
  entryPoints: [join(RAIZ, 'src/main.tsx')],
  bundle: true, format: 'esm', target: 'es2022', outdir: `${TC}/dist`, jsx: 'automatic',
  loader: { '.png': 'dataurl', '.webp': 'dataurl' }, nodePaths: [join(RAIZ, 'node_modules'), '/opt/npm-tools/node_modules'],
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [workerPlugin], logLevel: 'warning', sourcemap: true,
});
copyFileSync(join(RAIZ, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'), `${TC}/dist/pdf.worker.min.mjs`);
for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png']) {
  try { copyFileSync(join(RAIZ, 'public', f), `${TC}/dist/${f}`); } catch {}
}
writeFileSync(`${TC}/dist/index.html`, `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Alquimia</title><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#17130f"><link rel="stylesheet" href="/main.css"></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>`);
console.log('ok');
