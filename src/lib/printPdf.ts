import { renderInkPage, sheetH } from './ink';
import type { ExportInput } from './exportPdf';

/**
 * Exportar por la impresión del navegador.
 *
 * El exportador propio (pdf-lib) escribe en WinAnsi: los acentos y la eñe salen bien, pero
 * griego, flechas, ≥ ≤ y µ se transliteran, y en medicina eso aparece todo el tiempo
 * («≥ 140/90», «µg/kg», «α-bloqueador»). Incrustar una fuente Unicode necesita fontkit, que
 * no está en el proyecto. La impresora del navegador sí maneja Unicode, así que esta ruta
 * arma una página limpia y deja que el sistema la guarde como PDF.
 */
export async function printNote(note: ExportInput): Promise<void> {
  const hojas: string[] = [];
  const total = Math.max(1, note.inkPages ?? 1);
  if (note.strokes?.length || note.images?.length) {
    for (let p = 0; p < total; p++) {
      const enPagina = (note.strokes ?? []).filter((st) => st.page === p);
      const url = await renderInkPage(enPagina, 1400, (note.images ?? []).filter((i) => i.page === p), sheetH(note.sheet));
      if (url) hojas.push(url);
    }
  }

  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string);
  const doc = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8"><title>${esc(note.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 12pt/1.55 Georgia, 'Times New Roman', serif; color: #111; }
  h1 { font-size: 18pt; margin: 0 0 2mm; }
  .sub { color: #555; font-size: 10pt; margin: 0 0 6mm; }
  img { width: 100%; break-inside: avoid; margin-bottom: 6mm; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #bbb; padding: 4px 6px; }
  pre { white-space: pre-wrap; }
  a { color: inherit; }
</style></head>
<body>
  <h1>${esc(note.title)}</h1>
  ${note.subtitle ? `<p class="sub">${esc(note.subtitle)}</p>` : ''}
  ${note.html || ''}
  ${hojas.map((u) => `<img src="${u}" alt="">`).join('\n')}
</body></html>`;

  // Un iframe oculto y no una ventana nueva: Safari y los bloqueadores de ventanas
  // emergentes la cierran, y además así no se pierde el estado de la app.
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0';
  document.body.appendChild(frame);

  await new Promise<void>((listo) => {
    frame.onload = () => listo();
    frame.srcdoc = doc;
  });
  // Deja que las imágenes terminen de decodificar antes de imprimir.
  const imgs = [...(frame.contentDocument?.images ?? [])];
  await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => ((i.onload = r), (i.onerror = r))))));

  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  // El diálogo de impresión es síncrono en algunos navegadores y asíncrono en otros:
  // se espera un poco antes de quitar el iframe para no cancelarlo.
  setTimeout(() => frame.remove(), 60000);
}
