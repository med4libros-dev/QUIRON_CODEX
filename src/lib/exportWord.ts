import { downloadBlob } from './exportPdf';
import { escapeHtml } from './html';

/**
 * Exporta una nota a Word (.doc). Word abre HTML con este formato conservando
 * títulos, listas, tablas, colores, alineación y resaltados.
 */
export function exportToWord(title: string, html: string, subtitle?: string) {
  const dom = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  dom.querySelectorAll('ul.checklist > li').forEach((li) => li.prepend(li.classList.contains('done') ? '☑ ' : '☐ '));
  dom.querySelectorAll('a.pdf-ref').forEach((a) => a.removeAttribute('href'));
  const body = dom.body.firstElementChild?.innerHTML ?? html;

  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1f2a1c; }
  h1, h2, h3 { font-family: Georgia, 'Palatino Linotype', serif; color: #3f5a24; }
  h1 { font-size: 20pt; } h2 { font-size: 15pt; } h3 { font-size: 12.5pt; }
  table { border-collapse: collapse; } td, th { border: 1px solid #9aa58c; padding: 4pt 6pt; vertical-align: top; }
  th { background: #edf0e3; }
  blockquote { border-left: 3pt solid #93c572; margin-left: 0; padding-left: 8pt; color: #3d4637; background: #f1f5ea; }
  ul.checklist { list-style: none; }
  a.pdf-ref { color: #3f5a24; text-decoration: none; }
  .meta { color: #6b7561; font-size: 9pt; }
</style></head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml([subtitle, new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })].filter(Boolean).join(' · '))}</p>
${body}
</body></html>`;
  const name = (title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'notas').slice(0, 80);
  downloadBlob(new Blob(['﻿', doc], { type: 'application/msword' }), `${name}.doc`);
}
