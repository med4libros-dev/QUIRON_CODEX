// pdf-lib (~400 KB) se carga solo al exportar: no pesa en el arranque.
import type { Color, PDFFont, PDFPage } from 'pdf-lib';
import { htmlToBlocks } from './html';
import { PAGE_H, PAGE_W, renderInkPage } from './ink';
import type { Stroke } from '../types';

const A4: [number, number] = [595.28, 841.89];
const M = 56;

/* Las fuentes estándar de PDF solo cubren Latin-1 (español completo). Símbolos frecuentes en medicina
   se transliteran para que el PDF nunca salga con caracteres rotos. */
const MAP: Record<string, string> = {
  'α': 'alfa', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'Δ': 'Delta', 'ε': 'epsilon', 'κ': 'kappa',
  'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma', 'τ': 'tau', 'ω': 'omega', '→': '->', '←': '<-',
  '↔': '<->', '↑': '(aumenta)', '↓': '(disminuye)', '≥': '>=', '≤': '<=', '≈': '~', '≠': '!=',
  '✓': '(v)', '✔': '(v)', '✗': '(x)', '−': '-', ' ': ' ', '\t': ' ', '′': "'", '″': '"', '∞': 'inf', '📑': '»', '☐': '[ ]', '☑': '[x]',
};
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

export function toWinAnsi(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const mapped = MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const c = ch.codePointAt(0) ?? 63;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else if (c === 0x0a || c === 0x0d) out += ' ';
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out += base && base !== ch && (base.codePointAt(0) ?? 999) < 0x7f ? base : '?';
    }
  }
  return out;
}

export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxW;
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (fits(cand)) {
      line = cand;
      continue;
    }
    if (line) lines.push(line);
    if (fits(w)) {
      line = w;
      continue;
    }
    let chunk = '';
    for (const ch of w) {
      if (fits(chunk + ch)) chunk += ch;
      else {
        lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export interface ExportInput {
  title: string;
  html: string;
  subtitle?: string;
  strokes?: Stroke[];
  inkPages?: number;
  images?: { page: number; x: number; y: number; w: number; h: number; src: string }[];
}

export async function buildPdf({ title, html, subtitle, strokes = [], inkPages = 1, images = [] }: ExportInput): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator('Quirón Codex');
  pdf.setProducer('Quirón Codex');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const ink = rgb(0.11, 0.11, 0.1);
  const muted = rgb(0.42, 0.42, 0.4);
  const accent = rgb(0.06, 0.46, 0.43);
  const rule = rgb(0.86, 0.86, 0.84);
  const maxW = A4[0] - 2 * M;

  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - M;
  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - M;
  };
  const space = (h: number) => {
    if (y - h < M) newPage();
    else y -= h;
  };
  const write = (text: string, font: PDFFont, size: number, color: Color = ink, indent = 0, lead = 1.45) => {
    const lh = size * lead;
    for (const line of wrap(toWinAnsi(text), font, size, maxW - indent)) {
      if (y - lh < M) newPage();
      y -= lh;
      page.drawText(line, { x: M + indent, y, size, font, color });
    }
  };
  const hr = () => {
    page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.6, color: rule });
  };

  write(title, bold, 20, ink, 0, 1.3);
  const meta = [subtitle, new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })].filter(Boolean).join('  ·  ');
  write(meta, regular, 9.5, muted);
  y -= 8;
  hr();
  y -= 14;

  const blocks = htmlToBlocks(html);
  for (const b of blocks) {
    switch (b.type) {
      case 'h1':
        space(10);
        write(b.text, bold, 16, accent, 0, 1.35);
        y -= 2;
        break;
      case 'h2':
        space(8);
        write(b.text, bold, 14, accent, 0, 1.35);
        y -= 2;
        break;
      case 'h3':
        space(6);
        write(b.text, bold, 12, ink, 0, 1.35);
        break;
      case 'li': {
        const indent = 12 + (b.depth ?? 0) * 14;
        const lh = 11 * 1.45;
        wrap(toWinAnsi(b.text), regular, 11, maxW - indent - 14).forEach((line, i) => {
          if (y - lh < M) newPage();
          y -= lh;
          if (i === 0) page.drawText(b.marker ?? '•', { x: M + indent, y, size: 11, font: regular, color: muted });
          page.drawText(line, { x: M + indent + 14, y, size: 11, font: regular, color: ink });
        });
        y -= 2;
        break;
      }
      case 'quote':
        space(4);
        write(b.text, italic, 11, muted, 14);
        y -= 4;
        break;
      case 'hr':
        space(8);
        hr();
        y -= 8;
        break;
      case 'img': {
        try {
          const src = b.src ?? '';
          const bytes = Uint8Array.from(atob(src.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
          const img = src.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
          let w = Math.min(maxW, img.width * 0.6);
          let h = (w * img.height) / img.width;
          const maxH = A4[1] - 2 * M;
          if (h > maxH) {
            h = maxH;
            w = (h * img.width) / img.height;
          }
          if (y - h < M) newPage();
          y -= h;
          page.drawImage(img, { x: M, y, width: w, height: h });
          y -= 8;
        } catch {
          write('[imagen]', italic, 10, muted);
        }
        break;
      }
      default:
        write(b.text, regular, 11);
        y -= 6;
    }
  }
  if (!blocks.length && !strokes.length && !images.length) write('(Nota vacía)', italic, 11, muted);

  // Hojas del lienzo como imágenes (una por página con contenido).
  for (let p = 0; p < Math.max(1, inkPages); p++) {
    const pageStrokes = strokes.filter((s) => s.page === p);
    const pageImgs = images.filter((i) => i.page === p);
    if (!pageStrokes.length && !pageImgs.length) continue;
    const png = await pdf.embedPng(await renderInkPage(pageStrokes, 1400, pageImgs));
    if (blocks.length || p > 0) newPage();
    write(`Lienzo · hoja ${p + 1}`, bold, 11, muted);
    y -= 6;
    let w = maxW;
    let h = (w * PAGE_H) / PAGE_W;
    if (h > y - M) {
      h = y - M;
      w = (h * PAGE_W) / PAGE_H;
    }
    page.drawImage(png, { x: M + (maxW - w) / 2, y: y - h, width: w, height: h });
    y -= h;
  }

  const pages = pdf.getPages();
  pages.forEach((pg, i) =>
    pg.drawText(`${i + 1} / ${pages.length}`, { x: A4[0] - M - 24, y: 28, size: 8, font: regular, color: muted }),
  );
  return pdf.save();
}

export async function exportToPdf(input: ExportInput): Promise<void> {
  const bytes = await buildPdf(input);
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safeName(input.title)}.pdf`);
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const safeName = (s: string) => (s.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'notas').slice(0, 80);

/**
 * Cuaderno completo a PDF: una portada con el índice (cada nota y en qué página empieza)
 * y después todas las notas, con su texto y sus hojas escritas a mano.
 */
export async function exportNotebookToPdf(name: string, notes: ExportInput[]): Promise<void> {
  if (!notes.length) throw new Error('Este cuaderno no tiene notas.');
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const out = await PDFDocument.create();
  out.setTitle(name);
  out.setCreator('Quirón Codex');
  out.setProducer('Quirón Codex');
  const regular = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const index = out.addPage(A4);

  const starts: { title: string; page: number }[] = [];
  for (const note of notes) {
    const bytes = await buildPdf(note);
    const src = await PDFDocument.load(bytes);
    const copied = await out.copyPages(src, src.getPageIndices());
    starts.push({ title: note.title, page: out.getPageCount() + 1 });
    for (const pg of copied) out.addPage(pg);
  }

  const ink = rgb(0.11, 0.11, 0.1);
  const muted = rgb(0.42, 0.42, 0.4);
  let y = A4[1] - M;
  index.drawText(toWinAnsi(name), { x: M, y: (y -= 26), size: 22, font: bold, color: ink });
  index.drawText(
    toWinAnsi(`${notes.length} nota${notes.length === 1 ? '' : 's'}  ·  ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}`),
    { x: M, y: (y -= 18), size: 9.5, font: regular, color: muted },
  );
  y -= 16;
  index.drawText('Índice', { x: M, y: (y -= 14), size: 12, font: bold, color: ink });
  y -= 6;
  const maxW = A4[0] - 2 * M - 34;
  for (const s of starts) {
    if (y < M + 20) break;
    const line = wrap(toWinAnsi(s.title || 'Nota sin título'), regular, 10.5, maxW)[0];
    index.drawText(line, { x: M, y: (y -= 16), size: 10.5, font: regular, color: ink });
    index.drawText(String(s.page), { x: A4[0] - M - 22, y, size: 10.5, font: regular, color: muted });
  }

  const bytes = await out.save();
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safeName(name)}.pdf`);
}
