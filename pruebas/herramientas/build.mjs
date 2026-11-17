import * as esbuild from 'esbuild';
const TC = process.env.QC_TC || '/tmp/tc';
import { copyFileSync, writeFileSync } from 'node:fs';
const workerPlugin = {
  name: 'url-import',
  setup(b) {
    b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'urlmod' }));
    b.onLoad({ filter: /.*/, namespace: 'urlmod' }, () => ({ contents: 'export default "/pdf.worker.min.mjs";', loader: 'js' }));
  },
};
await esbuild.build({
  entryPoints: ['/home/claude/quiron_codex/src/main.tsx'],
  bundle: true, format: 'esm', target: 'es2022', outdir: `${TC}/dist`, jsx: 'automatic',
  loader: { '.png': 'dataurl', '.webp': 'dataurl' }, nodePaths: ['/opt/npm-tools/node_modules', '/home/claude/.npm-global/lib/node_modules'],
  define: { 'process.env.NODE_ENV': '"development"' }, plugins: [workerPlugin], logLevel: 'warning', sourcemap: true,
});
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${TC}/dist/pdf.worker.min.mjs`);
for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png']) {
  try { copyFileSync(`/home/claude/quiron_codex/public/${f}`, `/tmp/tc/dist/${f}`); } catch {}
}
writeFileSync(`${TC}/dist/index.html`, `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Alquimia</title><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#17130f"><link rel="stylesheet" href="/main.css"></head><body><div id="root"></div><script type="module" src="/main.js"></script></body></html>`);
console.log('ok');
