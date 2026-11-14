import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { uid } from '../../lib/id';
import { drawStroke, hitsStroke } from '../../lib/ink';
import { capturePointer } from '../../lib/pointer';
import { cropPage } from '../../lib/crop';
import { TextLayer, extractTextInRect, loadPdfData, openPdf, type PDFDocumentProxy, type PDFPageProxy } from '../../lib/pdf';
import { useUI } from '../../store/ui';
import { useLibrary } from '../../store/library';
import { useTools } from '../../store/tools';
import { HIGHLIGHT_META, type Bookmark, type Highlight, type NRect, type Sticky, type Stroke } from '../../types';
import { StickyNote } from './StickyNote';

export type PdfTool = 'select' | 'highlight' | 'underline' | 'draw' | 'sticky' | 'erase' | 'crop';

interface Props {
  docId: string;
  tool: PdfTool;
  zoom: number;
  onPageChange: (page: number) => void;
}

type Size = { w: number; h: number };
const EMPTY_H: Highlight[] = [];
const EMPTY_S: Stroke[] = [];
const EMPTY_N: Sticky[] = [];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pct = (v: number) => `${v * 100}%`;
/** Las anotaciones a mano usan un ancho lógico de 1000 por página. */
const LW = 1000;
/** Altura aproximada de una línea de texto (fracción de la altura de página) para el subrayado. */
const LINE_H = 0.016;

function groupByPage<T extends { page: number }>(items: T[]): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const it of items) {
    const list = m.get(it.page);
    if (list) list.push(it);
    else m.set(it.page, [it]);
  }
  return m;
}

/**
 * Visor de PDF pensado para documentos pesados:
 *  - Solo se renderizan las páginas cercanas a la vista (IntersectionObserver).
 *  - Las páginas que salen de vista liberan su canvas (memoria estable con libros de 1000+ páginas).
 *  - El render ocurre fuera de pantalla y se copia de una vez: no hay parpadeo al hacer zoom.
 *  - Todas las anotaciones se guardan en coordenadas relativas a la página: sobreviven a cualquier zoom.
 */
export function PdfViewer({ docId, tool, zoom, onPageChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLDivElement | null)[]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [base, setBase] = useState<Size | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const highlights = useLibrary((s) => s.highlights[docId]) ?? EMPTY_H;
  const inks = useLibrary((s) => s.inks[docId]) ?? EMPTY_S;
  const stickies = useLibrary((s) => s.stickies[docId]) ?? EMPTY_N;
  const bookmarks = useLibrary((s) => s.bookmarks[docId]);
  const nav = useLibrary((s) => s.nav);
  const setLastPage = useLibrary((s) => s.setLastPage);
  const setPageCount = useLibrary((s) => s.setPageCount);
  const restored = useRef(false);
  const ratio = useRef(0);
  const current = useRef(1);
  const raf = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | null = null;
    restored.current = false;
    (async () => {
      const data = await loadPdfData(docId);
      if (cancelled) return;
      const handle = openPdf(data);
      destroy = handle.destroy;
      const doc = await handle.promise;
      const first = await doc.getPage(1);
      if (cancelled) return;
      const vp = first.getViewport({ scale: 1 });
      setBase({ w: vp.width, h: vp.height });
      setPageCount(docId, doc.numPages);
      setPdf(doc);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      cancelled = true;
      destroy?.();
      clearTimeout(saveTimer.current);
    };
  }, [docId, setPageCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Ancho 0 = panel oculto (modo «solo notas»): se conserva el último ancho para no re-renderizar.
    const measure = () => el.clientWidth > 0 && setWidth(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);
  const scale = base && width ? Math.max(0.3, Math.round(((width - 48) / base.w) * zoom * 100) / 100) : 0;

  useEffect(() => {
    if (!pdf || !scale || restored.current) return;
    restored.current = true;
    const st = useLibrary.getState();
    const last = st.nav?.docId === docId ? st.nav.page : st.docs.find((d) => d.id === docId)?.lastPage ?? 1;
    if (last > 1) requestAnimationFrame(() => pageEls.current[last - 1]?.scrollIntoView({ block: 'start' }));
  }, [pdf, scale, docId]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && restored.current) el.scrollTop = ratio.current * el.scrollHeight;
  }, [scale]);

  useEffect(() => {
    if (nav && nav.docId === docId) pageEls.current[nav.page - 1]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [nav, docId]);

  const hlByPage = useMemo(() => groupByPage(highlights), [highlights]);
  const inkByPage = useMemo(() => groupByPage(inks), [inks]);
  const stickyByPage = useMemo(() => groupByPage(stickies), [stickies]);
  const bookmarkByPage = useMemo(() => new Map((bookmarks ?? []).map((b) => [b.page, b])), [bookmarks]);

  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || !pdf) return;
      ratio.current = el.scrollHeight ? el.scrollTop / el.scrollHeight : 0;
      const probe = el.scrollTop + el.clientHeight * 0.3;
      let lo = 0;
      let hi = pdf.numPages - 1;
      let ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((pageEls.current[mid]?.offsetTop ?? 0) <= probe) {
          ans = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      const page = ans + 1;
      if (page !== current.current) {
        current.current = page;
        onPageChange(page);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => setLastPage(docId, page), 500);
      }
    });
  };

  // Perlas clínicas: al soltar una selección de texto (mouse o lápiz) aparece el menú flotante.
  const onSelectEnd = () => {
    if (tool !== 'select') return;
    setTimeout(() => {
      const sel = document.getSelection();
      const root = scrollRef.current;
      if (!sel || sel.isCollapsed || !sel.rangeCount || !root) return;
      const range = sel.getRangeAt(0);
      const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
      const pageEl = start?.closest('.pdf-page');
      if (!pageEl || !root.contains(pageEl)) return;
      const text = sel.toString().replace(/-\s*\n\s*(?=[a-záéíóúñ])/g, '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const pr = pageEl.getBoundingClientRect();
      // Unión de los rectángulos de la selección que caen en la página inicial.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1 || r.height < 1 || r.top > pr.bottom || r.bottom < pr.top) continue;
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (!Number.isFinite(x0)) return;
      const pad = 4;
      const rect = {
        x: clamp01((x0 - pad - pr.left) / pr.width),
        y: clamp01((y0 - pad - pr.top) / pr.height),
        w: Math.min(1, (x1 - x0 + 2 * pad) / pr.width),
        h: Math.min(1, (y1 - y0 + 2 * pad) / pr.height),
      };
      useUI.getState().setPearl({ docId, page: Number((pageEl as HTMLElement).dataset.page), rect, text, x: (x0 + x1) / 2, y: y1 });
    }, 0);
  };

  if (error) {
    return (
      <div className="empty-state">
        <h3>No se pudo abrir el PDF</h3>
        <p className="muted small">{error}</p>
      </div>
    );
  }

  return (
    <div className="pdf-scroll" ref={scrollRef} onScroll={onScroll} data-tool={tool} onPointerUp={onSelectEnd} onKeyUp={(e) => e.shiftKey && onSelectEnd()}>
      {!pdf || !base || !scale ? (
        <div className="loading">Cargando documento…</div>
      ) : (
        Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfPage
            key={i}
            pdf={pdf}
            index={i}
            scale={scale}
            base={base}
            tool={tool}
            docId={docId}
            highlights={hlByPage.get(i + 1) ?? EMPTY_H}
            strokes={inkByPage.get(i + 1) ?? EMPTY_S}
            stickies={stickyByPage.get(i + 1) ?? EMPTY_N}
            bookmark={bookmarkByPage.get(i + 1)}
            rootRef={scrollRef}
            elsRef={pageEls}
          />
        ))
      )}
    </div>
  );
}

interface PageProps {
  pdf: PDFDocumentProxy;
  index: number;
  scale: number;
  base: Size;
  tool: PdfTool;
  docId: string;
  highlights: Highlight[];
  strokes: Stroke[];
  stickies: Sticky[];
  bookmark?: Bookmark;
  rootRef: RefObject<HTMLDivElement | null>;
  elsRef: RefObject<(HTMLDivElement | null)[]>;
}

type Gesture =
  | { kind: 'rect'; id: number; x: number; y: number }
  | { kind: 'draw'; id: number; pts: number[][]; rect: DOMRect }
  | { kind: 'erase'; id: number; rect: DOMRect }
  | { kind: 'pan'; id: number; y: number };

const PdfPage = memo(function PdfPage({
  pdf,
  index,
  scale,
  base,
  tool,
  docId,
  highlights,
  strokes,
  stickies,
  bookmark,
  rootRef,
  elsRef,
}: PageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<Size>(base);
  const [draft, setDraft] = useState<NRect | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const draftRef = useRef<NRect | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const raf = useRef(0);

  const hlColor = useTools((s) => s.hlColor);
  const underlineWidth = useTools((s) => s.underlineWidth);
  const drawTool = useTools((s) => s.pdfTool);
  const pen = useTools((s) => s.settings[s.pdfTool]);
  const stickyColor = useTools((s) => s.stickyColor);
  const penOnly = useTools((s) => s.penOnly);
  const lib = useLibrary.getState;

  const getPage = async () => (pageRef.current ??= await pdf.getPage(index + 1));
  const cssW = size.w * scale;
  const cssH = size.h * scale;
  const logicalH = (LW * size.h) / size.w;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root: rootRef.current,
      rootMargin: '700px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  // Render de la página del PDF.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tdiv = textRef.current;
    if (!visible) {
      canvas.width = 0;
      canvas.height = 0;
      if (tdiv) tdiv.replaceChildren();
      pageRef.current?.cleanup();
      return;
    }
    let cancelled = false;
    let task: ReturnType<PDFPageProxy['render']> | null = null;
    let tl: InstanceType<typeof TextLayer> | null = null;
    const t = setTimeout(async () => {
      try {
        const page = await getPage();
        if (cancelled) return;
        const vp1 = page.getViewport({ scale: 1 });
        if (Math.abs(vp1.width - size.w) > 0.5 || Math.abs(vp1.height - size.h) > 0.5) setSize({ w: vp1.width, h: vp1.height });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: scale * dpr });
        const off = document.createElement('canvas');
        off.width = Math.floor(vp.width);
        off.height = Math.floor(vp.height);
        task = page.render({ canvas: off, viewport: vp });
        await task.promise;
        if (cancelled) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d')?.drawImage(off, 0, 0);
        // Capa de texto seleccionable (para perlas clínicas). Se crea después del dibujo para no retrasarlo.
        if (tdiv) {
          const fresh = document.createElement('div');
          tl = new TextLayer({ textContentSource: page.streamTextContent(), container: fresh, viewport: page.getViewport({ scale }) });
          await tl.render();
          if (cancelled) return;
          tdiv.style.setProperty('--min-font-size', fresh.style.getPropertyValue('--min-font-size') || '1');
          tdiv.replaceChildren(...Array.from(fresh.childNodes));
        }
      } catch (err) {
        if ((err as { name?: string } | null)?.name !== 'RenderingCancelledException') console.warn(err);
      }
    }, 40);
    return () => {
      cancelled = true;
      clearTimeout(t);
      task?.cancel();
      tl?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scale, pdf]);

  /** Prepara un canvas de anotación en coordenadas lógicas (ancho 1000). */
  const prepare = (c: HTMLCanvasElement | null) => {
    if (!c) return null;
    if (!visible) {
      c.width = 0;
      c.height = 0;
      return null;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const k = (cssW / LW) * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, LW, logicalH);
    return ctx;
  };

  // Tinta guardada sobre la página (sobre papel blanco: "tinta" = casi negro).
  useEffect(() => {
    const ctx = prepare(inkRef.current);
    if (ctx) for (const s of strokes) drawStroke(ctx, s, '#111827');
    if (gesture.current?.kind !== 'draw') prepare(liveRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, visible, cssW, cssH]);

  const norm = (e: { clientX: number; clientY: number }, r: DOMRect) => ({
    x: clamp01((e.clientX - r.left) / r.width),
    y: clamp01((e.clientY - r.top) / r.height),
  });
  const toLogical = (e: { clientX: number; clientY: number; pressure: number }, r: DOMRect) => [
    Math.round(((e.clientX - r.left) / r.width) * LW * 10) / 10,
    Math.round(((e.clientY - r.top) / r.height) * logicalH * 10) / 10,
    Math.round((e.pressure || 0.5) * 100) / 100,
  ];
  const setD = (r: NRect | null) => {
    draftRef.current = r;
    setDraft(r);
  };

  const eraseAt = (x: number, y: number, nx: number, ny: number) => {
    const ids = strokes.filter((s) => hitsStroke(s, x, y, 10)).map((s) => s.id);
    if (ids.length) lib().erasePdfStrokes(docId, ids);
    for (const h of highlights) {
      const r = h.rect;
      if (nx >= r.x && nx <= r.x + r.w && ny >= r.y - 0.004 && ny <= r.y + r.h + 0.006) lib().removeHighlight(docId, h.id);
    }
  };

  const drawLive = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const g = gesture.current;
      const ctx = prepare(liveRef.current);
      if (!ctx || !g || g.kind !== 'draw') return;
      drawStroke(ctx, { tool: drawTool, color: pen.color, size: pen.size, points: g.pts }, '#111827');
    });
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === 'select') return;
    const r = e.currentTarget.getBoundingClientRect();
    // Con «Solo lápiz», la mano/palma solo desplaza la página; el lápiz y el mouse anotan.
    if (e.pointerType === 'touch' && penOnly) {
      gesture.current = { kind: 'pan', id: e.pointerId, y: e.clientY };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const penEraser = e.button === 5 || (e.buttons & 32) === 32;
    const p = norm(e, r);
    if (tool === 'sticky' && !penEraser) {
      const id = lib().addSticky(docId, { page: index + 1, x: p.x, y: p.y, text: '', color: stickyColor, open: true });
      setFresh(id);
      return;
    }
    capturePointer(e.currentTarget, e.pointerId);
    if (tool === 'erase' || penEraser) {
      gesture.current = { kind: 'erase', id: e.pointerId, rect: r };
      const [x, y] = toLogical(e, r);
      eraseAt(x, y, p.x, p.y);
    } else if (tool === 'draw') {
      gesture.current = { kind: 'draw', id: e.pointerId, pts: [toLogical(e, r)], rect: r };
      drawLive();
    } else if (tool === 'highlight' || tool === 'underline' || tool === 'crop') {
      gesture.current = { kind: 'rect', id: e.pointerId, x: p.x, y: p.y };
      setD(tool === 'underline' ? { x: p.x, y: p.y - LINE_H, w: 0, h: LINE_H } : { ...p, w: 0, h: 0 });
    }
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.kind === 'pan') {
      const sc = rootRef.current;
      if (sc) sc.scrollTop -= e.clientY - g.y;
      g.y = e.clientY;
      return;
    }
    if (g.kind === 'rect') {
      const p = norm(e, e.currentTarget.getBoundingClientRect());
      if (tool === 'underline') setD({ x: Math.min(g.x, p.x), y: g.y - LINE_H, w: Math.abs(p.x - g.x), h: LINE_H });
      else setD({ x: Math.min(g.x, p.x), y: Math.min(g.y, p.y), w: Math.abs(p.x - g.x), h: Math.abs(p.y - g.y) });
      return;
    }
    const native = e.nativeEvent;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const ev of coalesced.length ? coalesced : [native]) {
      const pt = toLogical(ev, g.rect);
      if (g.kind === 'erase') {
        eraseAt(pt[0], pt[1], pt[0] / LW, pt[1] / logicalH);
        continue;
      }
      const last = g.pts[g.pts.length - 1];
      pt[0] = Math.round((last[0] + (pt[0] - last[0]) * 0.65) * 10) / 10;
      pt[1] = Math.round((last[1] + (pt[1] - last[1]) * 0.65) * 10) / 10;
      g.pts.push(pt);
    }
    if (g.kind === 'draw') drawLive();
  };

  const onUp = async (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (g.kind === 'draw') {
      cancelAnimationFrame(raf.current);
      lib().addPdfStroke(docId, { id: uid(), page: index + 1, tool: drawTool, color: pen.color, size: pen.size, points: g.pts });
      return;
    }
    if (g.kind !== 'rect') return;
    const r = draftRef.current;
    setD(null);
    if (tool === 'crop') {
      if (!r || r.w < 0.02 || r.h < 0.01) return;
      const image = cropPage(wrapRef.current, r);
      if (!image) return;
      let text = '';
      try {
        text = await extractTextInRect(await getPage(), r);
      } catch {
        /* escaneado */
      }
      const pr = wrapRef.current!.getBoundingClientRect();
      useUI.getState().setPearl({ docId, page: index + 1, rect: r, text, image, x: pr.left + (r.x + r.w / 2) * pr.width, y: pr.top + (r.y + r.h) * pr.height });
      return;
    }
    if (!r || r.w < 0.01 || (tool === 'highlight' && r.h < 0.006)) return;
    const underline = tool === 'underline';
    const id = lib().addHighlight(docId, {
      page: index + 1,
      rect: r,
      color: hlColor,
      text: '',
      style: underline ? 'underline' : 'box',
      thickness: underline ? underlineWidth : undefined,
    });
    try {
      const text = await extractTextInRect(await getPage(), r);
      if (text) lib().updateHighlight(docId, id, { text });
    } catch {
      /* PDF sin capa de texto (escaneado) */
    }
  };

  const cancel = () => {
    gesture.current = null;
    setD(null);
    prepare(liveRef.current);
  };

  return (
    <div
      className="pdf-page"
      ref={(el) => {
        wrapRef.current = el;
        elsRef.current[index] = el;
      }}
      style={{ width: cssW, height: cssH }}
      data-page={index + 1}
    >
      <canvas ref={canvasRef} />
      <div ref={textRef} className="textLayer" style={{ '--total-scale-factor': scale } as CSSProperties} />
      {highlights.map((h) =>
        h.style === 'underline' ? (
          <div
            key={h.id}
            className="hl underline"
            title={h.text ? `${HIGHLIGHT_META[h.color].label}: ${h.text}` : HIGHLIGHT_META[h.color].label}
            style={{
              left: pct(h.rect.x),
              top: pct(h.rect.y),
              width: pct(h.rect.w),
              height: pct(h.rect.h),
              borderBottom: `${Math.max(1, (h.thickness ?? 3) * scale)}px solid ${HIGHLIGHT_META[h.color].solid}`,
            }}
          />
        ) : (
          <div
            key={h.id}
            className="hl"
            title={h.text ? `${HIGHLIGHT_META[h.color].label}: ${h.text}` : HIGHLIGHT_META[h.color].label}
            style={{ left: pct(h.rect.x), top: pct(h.rect.y), width: pct(h.rect.w), height: pct(h.rect.h), background: HIGHLIGHT_META[h.color].fill }}
          />
        ),
      )}
      <canvas ref={inkRef} className="ink-layer" />
      <canvas ref={liveRef} className="ink-layer" />
      <div
        className="ann-layer"
        style={{ pointerEvents: tool === 'select' ? 'none' : 'auto' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => void onUp(e)}
        onPointerCancel={cancel}
        onContextMenu={(e) => tool !== 'select' && e.preventDefault()}
      >
        {draft &&
          (tool === 'underline' ? (
            <div
              className="hl underline draft"
              style={{
                left: pct(draft.x),
                top: pct(draft.y),
                width: pct(draft.w),
                height: pct(draft.h),
                borderBottom: `${Math.max(1, underlineWidth * scale)}px solid ${HIGHLIGHT_META[hlColor].solid}`,
              }}
            />
          ) : (
            <div
              className={`hl draft${tool === 'crop' ? ' crop' : ''}`}
              style={{ left: pct(draft.x), top: pct(draft.y), width: pct(draft.w), height: pct(draft.h), background: tool === 'crop' ? undefined : HIGHLIGHT_META[hlColor].fill }}
            />
          ))}
      </div>
      {stickies.map((s) => (
        <StickyNote key={s.id} sticky={s} docId={docId} autoFocus={s.id === fresh} />
      ))}
      {bookmark && <span className="page-ribbon" title={bookmark.label ? `Marcador: ${bookmark.label}` : 'Página marcada'} />}
      <span className="page-badge">{index + 1}</span>
    </div>
  );
});
