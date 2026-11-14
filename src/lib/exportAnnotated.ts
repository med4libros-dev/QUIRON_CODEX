import { PDFDocument, StandardFonts, rgb, LineCapStyle } from 'pdf-lib';
import { downloadBlob, toWinAnsi, wrap } from './exportPdf';
import { loadPdfData } from './pdf';
import { useLibrary } from '../store/library';
import { HIGHLIGHT_META } from '../types';

/**
 * PDF anotado: la guía original con tus resaltados, subrayados, tinta y post-its encima
 * (y un índice de tus marcadores al final). Se genera en este equipo; el original no se modifica.
 */
const LW = 1000;

function parseColor(c: string): { r: number; g: number; b: number; a: number } {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a] = m[1].split(',').map((x) => Number(x.trim()));
    return { r: r / 255, g: g / 255, b: b / 255, a: Number.isFinite(a) ? a : 1 };
  }
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 0.12, g: 0.16, b: 0.22, a: 1 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
}

export interface AnnotatedStats {
  highlights: number;
  strokes: number;
  stickies: number;
  bookmarks: number;
}

export async function buildAnnotatedPdf(docId: string): Promise<{ bytes: Uint8Array; stats: AnnotatedStats }> {
  const lib = useLibrary.getState();
  const highlights = lib.highlights[docId] ?? [];
  const strokes = lib.inks[docId] ?? [];
  const stickies = lib.stickies[docId] ?? [];
  const bookmarks = [...(lib.bookmarks[docId] ?? [])].sort((a, b) => a.page - b.page);
  const pdf = await PDFDocument.load(await loadPdfData(docId), { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const h of highlights) {
    const page = pages[h.page - 1];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const meta = HIGHLIGHT_META[h.color];
    const x = h.rect.x * W;
    const w = h.rect.w * W;
    if (h.style === 'underline') {
      const c = parseColor(meta.solid);
      const t = Math.max(0.8, (h.thickness ?? 3) * 0.75);
      const y = H - (h.rect.y + h.rect.h) * H;
      page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: t, color: rgb(c.r, c.g, c.b) });
    } else {
      const c = parseColor(meta.fill);
      page.drawRectangle({ x, y: H - (h.rect.y + h.rect.h) * H, width: w, height: h.rect.h * H, color: rgb(c.r, c.g, c.b), opacity: Math.min(0.55, c.a) });
    }
  }

  for (const s of strokes) {
    const page = pages[s.page - 1];
    if (!page || s.points.length < 1) continue;
    const { width: W, height: H } = page.getSize();
    const k = W / LW;
    const c = parseColor(s.color === 'auto' ? '#1f2937' : s.color);
    const opacity = s.tool === 'highlighter' ? 0.32 : s.tool === 'pencil' ? 0.78 : 1;
    const pts = s.points.length === 1 ? [s.points[0], [s.points[0][0] + 0.1, s.points[0][1]]] : s.points;
    for (let i = 1; i < pts.length; i++) {
      const pr = pts[i][2] ?? 0.5;
      const pressure = s.tool === 'pen' || s.tool === 'pencil' ? 0.3 + pr * 1.15 : 1;
      page.drawLine({
        start: { x: pts[i - 1][0] * k, y: H - pts[i - 1][1] * k },
        end: { x: pts[i][0] * k, y: H - pts[i][1] * k },
        thickness: Math.max(0.4, s.size * k * pressure),
        color: rgb(c.r, c.g, c.b),
        opacity,
        lineCap: s.tool === 'highlighter' ? LineCapStyle.Butt : LineCapStyle.Round,
      });
    }
  }

  for (const n of stickies) {
    const page = pages[n.page - 1];
    if (!page || !n.text.trim()) continue;
    const { width: W, height: H } = page.getSize();
    const size = 8;
    const boxW = Math.min(170, W * 0.4);
    const lines = wrap(toWinAnsi(n.text.trim()), font, size, boxW - 12).slice(0, 14);
    const boxH = lines.length * (size + 2) + 12;
    const x = Math.min(Math.max(4, n.x * W), W - boxW - 4);
    const yTop = Math.min(H - 4, Math.max(boxH + 4, H - n.y * H));
    const c = parseColor(n.color);
    page.drawRectangle({ x, y: yTop - boxH, width: boxW, height: boxH, color: rgb(c.r, c.g, c.b), opacity: 0.94, borderColor: rgb(0.45, 0.4, 0.3), borderWidth: 0.4 });
    lines.forEach((l, i) => page.drawText(l, { x: x + 6, y: yTop - 9 - i * (size + 2), size, font, color: rgb(0.12, 0.12, 0.1) }));
  }

  // Índice de marcadores al final.
  if (bookmarks.length) {
    const first = pages[0]?.getSize() ?? { width: 595, height: 842 };
    let page = pdf.addPage([first.width, first.height]);
    let y = first.height - 60;
    page.drawText('Marcadores y paginas clave', { x: 50, y, size: 16, font: bold, color: rgb(0.12, 0.12, 0.1) });
    y -= 28;
    for (const b of bookmarks) {
      if (y < 50) {
        page = pdf.addPage([first.width, first.height]);
        y = first.height - 60;
      }
      const kind = b.kind ? `[${b.kind}] ` : '';
      page.drawText(toWinAnsi(`p. ${b.page}  ${kind}${b.label || ''}`).slice(0, 110), { x: 50, y, size: 11, font, color: rgb(0.15, 0.15, 0.13) });
      y -= 18;
    }
  }

  pdf.setProducer('Quirón Codex');
  const bytes = await pdf.save();
  return { bytes, stats: { highlights: highlights.length, strokes: strokes.length, stickies: stickies.filter((s) => s.text.trim()).length, bookmarks: bookmarks.length } };
}

export async function exportAnnotatedPdf(docId: string): Promise<AnnotatedStats> {
  const name = useLibrary.getState().docs.find((d) => d.id === docId)?.name ?? 'documento';
  const { bytes, stats } = await buildAnnotatedPdf(docId);
  downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${name.replace(/\.pdf$/i, '')} (anotado).pdf`);
  return stats;
}
