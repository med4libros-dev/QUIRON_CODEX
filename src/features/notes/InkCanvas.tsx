import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { Icon } from '../../components/Icon';
import { capturePointer } from '../../lib/pointer';
import { idb } from '../../lib/idb';
import { uid } from '../../lib/id';
import { PAGE_H, PAGE_W, ctx2d, drawLiveSegments, drawLiveTip, drawStroke, hitsStroke, inkColor, liveOpacity, type LiveStyle } from '../../lib/ink';
import { PenControls } from '../../components/PenControls';
import { loadInkImages, saveInkImages, type InkImage } from '../../lib/inkImages';
import { useBridge } from '../../store/bridge';
import { useTools } from '../../store/tools';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import type { InkTool, Note, PaperStyle, Stroke } from '../../types';

const EMPTY: Stroke[] = [];
const EMPTY_IMG: InkImage[] = [];

/**
 * Lienzo para escritura a mano, optimizado para lápiz (Surface Pen):
 *  - Presión real del lápiz → grosor variable; eventos "coalesced" para trazos suaves a alta frecuencia.
 *  - Botón borrador del lápiz detectado automáticamente.
 *  - "Solo lápiz": la palma/dedo no dibuja; el dedo desplaza la hoja.
 *  - Dos capas de canvas: trazos guardados + trazo en curso (no se redibuja todo en cada movimiento).
 *  - Los trazos se guardan aparte en IndexedDB, con guardado diferido.
 */
export function InkCanvas({ note }: { note: Note }) {
  const update = useNotes((s) => s.updateNote);
  const dark = useSettings((s) => s.dark);
  const [strokes, setStrokes] = useState<Stroke[] | null>(null);
  const drawTool = useTools((s) => s.canvasTool);
  const setDrawTool = useTools((s) => s.setCanvasTool);
  const setting = useTools((s) => s.settings[s.canvasTool]);
  const [erasing, setErasing] = useState(false);
  const tool: InkTool = erasing ? 'eraser' : drawTool;
  const penOnly = useTools((s) => s.penOnly);
  const setPenOnly = useTools((s) => s.setPenOnly);
  const [, setHistoryTick] = useState(0);
  const undo = useRef<Stroke[][]>([]);
  const redo = useRef<Stroke[][]>([]);
  const latest = useRef<Stroke[]>([]);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const erasePushed = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<InkImage[]>(EMPTY_IMG);
  const inkRev = useBridge((s) => (s.inkRev?.noteId === note.id ? s.inkRev.n : 0));

  // Recortes pegados desde el PDF: se guardan aparte de los trazos y se recargan si llega uno nuevo.
  useEffect(() => {
    let alive = true;
    loadInkImages(note.id).then((imgs) => alive && setImages(imgs));
    return () => {
      alive = false;
    };
  }, [note.id, inkRev]);
  const removeImage = useCallback(
    (id: string) => {
      setImages((cur) => {
        const next = cur.filter((i) => i.id !== id);
        void saveInkImages(note.id, next);
        return next;
      });
    },
    [note.id],
  );
  const imgByPage = useMemo(() => {
    const m = new Map<number, InkImage[]>();
    for (const im of images) m.set(im.page, [...(m.get(im.page) ?? []), im]);
    return m;
  }, [images]);

  // Al pegar un recorte, desplazarse hasta él.
  useEffect(() => {
    if (!inkRev || !images.length) return;
    const last = images[images.length - 1];
    requestAnimationFrame(() => scrollRef.current?.querySelector(`[data-img="${last.id}"]`)?.scrollIntoView({ block: 'center' }));
  }, [images, inkRev]);

  useEffect(() => {
    let alive = true;
    idb.get<Stroke[]>('ink', note.id).then((s) => {
      if (!alive) return;
      latest.current = s ?? [];
      setStrokes(latest.current);
    });
    return () => {
      alive = false;
      clearTimeout(timer.current);
      if (dirty.current) void idb.set('ink', note.id, latest.current);
    };
  }, [note.id]);

  const persist = useCallback(
    (next: Stroke[]) => {
      latest.current = next;
      dirty.current = true;
      setStrokes(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        dirty.current = false;
        void idb.set('ink', note.id, latest.current);
        update(note.id, {});
      }, 600);
    },
    [note.id, update],
  );

  const pushUndo = () => {
    undo.current.push(latest.current);
    if (undo.current.length > 80) undo.current.shift();
    redo.current = [];
    setHistoryTick((n) => n + 1);
  };

  const addStroke = useCallback(
    (s: Stroke) => {
      pushUndo();
      persist([...latest.current, s]);
    },
    [persist],
  );

  const eraseAt = useCallback(
    (page: number, x: number, y: number, begin: boolean) => {
      if (begin) erasePushed.current = false;
      const cur = latest.current;
      const next = cur.filter(
        (s) => s.page !== page || !hitsStroke(s, x, y, 12),
      );
      if (next.length === cur.length) return;
      if (!erasePushed.current) {
        pushUndo();
        erasePushed.current = true;
      }
      persist(next);
    },
    [persist],
  );

  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(latest.current);
    persist(prev);
  };
  const doRedo = () => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(latest.current);
    persist(next);
  };
  const clearAll = () => {
    if (!latest.current.length || !confirm('¿Borrar todos los trazos de esta nota?')) return;
    pushUndo();
    persist([]);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
      e.preventDefault();
      doRedo();
    }
  };

  const byPage = useMemo(() => {
    const m = new Map<number, Stroke[]>();
    for (const s of strokes ?? []) {
      const list = m.get(s.page);
      if (list) list.push(s);
      else m.set(s.page, [s]);
    }
    return m;
  }, [strokes]);

  const pages = Math.max(1, note.inkPages);
  const color = setting.color;
  const size = setting.size;

  return (
    <div className="ink-wrap" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="ink-toolbar" role="toolbar" aria-label="Herramientas de dibujo">
        <PenControls
          tool={drawTool}
          inactive={erasing}
          onTool={(t) => {
            setDrawTool(t);
            setErasing(false);
          }}
        />
        <button className={`icon-btn${erasing ? ' active' : ''}`} onClick={() => setErasing((v) => !v)} title="Borrador de trazo (o usa el borrador del lápiz)" aria-pressed={erasing}>
          <Icon name="eraser" />
        </button>
        <div className="tb-sep" />
        <button className="icon-btn" onClick={doUndo} disabled={!undo.current.length} title="Deshacer (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="icon-btn" onClick={doRedo} disabled={!redo.current.length} title="Rehacer (Ctrl+Y)">
          <Icon name="redo" />
        </button>
        <div className="spacer" />
        <button
          className={`btn ghost sm${penOnly ? ' active' : ''}`}
          onClick={() => setPenOnly(!penOnly)}
          title="Solo lápiz (activado por defecto): la mano y la palma no dibujan; el dedo desplaza la hoja"
          aria-pressed={penOnly}
        >
          <Icon name="hand" size={16} /> Solo lápiz
        </button>
        <select
          className="select xs"
          value={note.paper}
          onChange={(e) => update(note.id, { paper: e.target.value as PaperStyle })}
          aria-label="Tipo de hoja"
        >
          <option value="lined">Rayada</option>
          <option value="grid">Cuadrícula</option>
          <option value="blank">Lisa</option>
        </select>
        <button className="icon-btn danger" onClick={clearAll} title="Borrar todo">
          <Icon name="trash" />
        </button>
      </div>
      <div className="ink-scroll" ref={scrollRef}>
        {strokes === null ? (
          <div className="loading">Cargando lienzo…</div>
        ) : (
          <>
            {Array.from({ length: pages }, (_, i) => (
              <InkPage
                key={i}
                index={i}
                strokes={byPage.get(i) ?? EMPTY}
                images={imgByPage.get(i) ?? EMPTY_IMG}
                onRemoveImage={removeImage}
                tool={tool}
                color={color}
                size={size}
                penOnly={penOnly}
                paper={note.paper}
                dark={dark}
                scrollRef={scrollRef}
                onStroke={addStroke}
                onErase={eraseAt}
              />
            ))}
            <button className="btn ghost add-page" onClick={() => update(note.id, { inkPages: pages + 1 })}>
              <Icon name="plus" size={16} /> Añadir hoja
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface PageProps {
  index: number;
  strokes: Stroke[];
  images: InkImage[];
  onRemoveImage: (id: string) => void;
  tool: InkTool;
  color: string;
  size: number;
  penOnly: boolean;
  paper: PaperStyle;
  dark: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  onStroke: (s: Stroke) => void;
  onErase: (page: number, x: number, y: number, begin: boolean) => void;
}

const InkPage = memo(function InkPage({ index, strokes, images, onRemoveImage, tool, color, size, penOnly, paper, dark, scrollRef, onStroke, onErase }: PageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(0);
  const cur = useRef<{ id: number; pts: number[][]; erase: boolean; rect: DOMRect; drawn: number; st: LiveStyle; color: string } | null>(null);
  const pan = useRef<{ id: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => el.clientWidth > 0 && setCssW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /** Ajusta el canvas a la resolución del dispositivo y deja el contexto en coordenadas lógicas. */
  const prepare = (c: HTMLCanvasElement | null) => {
    if (!c || !cssW) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(((cssW * PAGE_H) / PAGE_W) * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = ctx2d(c);
    if (!ctx) return null;
    const k = (cssW / PAGE_W) * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    return ctx;
  };

  useEffect(() => {
    const ctx = prepare(baseRef.current);
    if (!ctx) return;
    const ink = inkColor();
    for (const s of strokes) drawStroke(ctx, s, ink);
    if (!cur.current) {
      // Limpia el trazo en vivo y su punta, ya consolidados en el canvas base.
      prepare(liveRef.current);
      prepare(tipRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, cssW, dark]);

  const toLocal = (ev: { clientX: number; clientY: number; pressure: number }, r: DOMRect): number[] => [
    Math.round(((ev.clientX - r.left) / r.width) * PAGE_W * 10) / 10,
    Math.round(((ev.clientY - r.top) / r.height) * PAGE_H * 10) / 10,
    Math.round((ev.pressure || 0.5) * 100) / 100,
  ];

  const strokeTool: Stroke['tool'] = tool === 'eraser' ? 'pen' : tool;

  /** Dibuja al instante solo lo nuevo del trazo y la punta predicha (sin esperar al siguiente cuadro). */
  const paintLive = (predicted: number[][] = []) => {
    const c = cur.current;
    if (!c || c.erase || !liveRef.current) return;
    const ctx = ctx2d(liveRef.current);
    if (ctx) c.drawn = drawLiveSegments(ctx, c.pts, c.drawn, c.st, c.color);
    const tip = tipRef.current && ctx2d(tipRef.current);
    if (tip) drawLiveTip(tip, c.pts, predicted, c.st, c.color, PAGE_W, PAGE_H);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (penOnly && e.pointerType === 'touch') {
      pan.current = { id: e.pointerId, y: e.clientY };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    capturePointer(e.currentTarget, e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    // Botón borrador del lápiz: button 5 / buttons bit 32.
    const erase = tool === 'eraser' || e.button === 5 || (e.buttons & 32) === 32;
    const p = toLocal(e, rect);
    const st: LiveStyle = { tool: strokeTool, color, size, pressure: e.pointerType === 'pen' };
    cur.current = { id: e.pointerId, pts: [p], erase, rect, drawn: 0, st, color: color === 'auto' ? inkColor() : color };
    if (erase) {
      onErase(index, p[0], p[1], true);
      return;
    }
    prepare(liveRef.current);
    prepare(tipRef.current);
    const op = String(liveOpacity(strokeTool));
    if (liveRef.current) liveRef.current.style.opacity = op;
    if (tipRef.current) tipRef.current.style.opacity = op;
    paintLive();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pn = pan.current;
    if (pn && pn.id === e.pointerId) {
      if (scrollRef.current) scrollRef.current.scrollTop -= e.clientY - pn.y;
      pn.y = e.clientY;
      return;
    }
    // Con pointerrawupdate (lápiz sin esperar al cuadro) la tinta ya se dibujó ahí.
    if (rawSeen.current) return;
    inkMove(e.nativeEvent);
  };

  /** Puntos del lápiz (incluidos los agrupados) → trazo en vivo o borrador. */
  const inkMove = (native: PointerEvent) => {
    const c = cur.current;
    if (!c || c.id !== native.pointerId) return;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const ev of coalesced.length ? coalesced : [native]) {
      const p = toLocal(ev, c.rect);
      if (c.erase) {
        onErase(index, p[0], p[1], false);
        continue;
      }
      // Estabilización ligera: suaviza el temblor sin agregar retraso perceptible.
      const last = c.pts[c.pts.length - 1];
      p[0] = Math.round((last[0] + (p[0] - last[0]) * 0.75) * 10) / 10;
      p[1] = Math.round((last[1] + (p[1] - last[1]) * 0.75) * 10) / 10;
      c.pts.push(p);
    }
    if (c.erase) return;
    // Puntos que el sistema predice para los próximos milisegundos: adelantan la punta y borran la sensación de retraso.
    const predicted = typeof native.getPredictedEvents === 'function' ? native.getPredictedEvents().map((ev) => toLocal(ev, c.rect)) : [];
    paintLive(predicted);
  };

  // «pointerrawupdate» llega en cuanto el lápiz reporta, sin esperar al siguiente cuadro como pointermove.
  const rawSeen = useRef(false);
  const inkMoveRef = useRef(inkMove);
  inkMoveRef.current = inkMove;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !('onpointerrawupdate' in el)) return;
    const h = (ev: Event) => {
      if (!cur.current) return;
      rawSeen.current = true;
      inkMoveRef.current(ev as PointerEvent);
    };
    el.addEventListener('pointerrawupdate', h);
    return () => el.removeEventListener('pointerrawupdate', h);
  }, []);

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pan.current?.id === e.pointerId) {
      pan.current = null;
      return;
    }
    const c = cur.current;
    if (!c || c.id !== e.pointerId) return;
    cur.current = null;
    if (c.erase) return;
    // El trazo en vivo y la punta se borran cuando el definitivo ya está dibujado (efecto de abajo): sin parpadeo.
    onStroke({ id: uid(), page: index, tool: strokeTool, color, size, points: c.pts });
  };

  const line = (cssW / PAGE_W) * 44;
  return (
    <div
      ref={wrapRef}
      className={`ink-page${tool === 'eraser' ? ' erasing' : ''}`}
      data-paper={paper}
      style={{ '--line': `${line}px` } as CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {images.map((im) => (
        <img
          key={im.id}
          className="ink-img"
          data-img={im.id}
          src={im.src}
          alt="Recorte del PDF"
          draggable={false}
          style={{ left: `${(im.x / PAGE_W) * 100}%`, top: `${(im.y / PAGE_H) * 100}%`, width: `${(im.w / PAGE_W) * 100}%`, height: `${(im.h / PAGE_H) * 100}%` }}
        />
      ))}
      <canvas ref={baseRef} />
      <canvas ref={liveRef} data-live="" className="ink-live" />
      <canvas ref={tipRef} data-live="" className="ink-live" />
      {tool === 'eraser' &&
        images.map((im) => (
          <button
            key={im.id}
            className="ink-img-del"
            style={{ left: `${((im.x + im.w) / PAGE_W) * 100}%`, top: `${(im.y / PAGE_H) * 100}%` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemoveImage(im.id)}
            title="Quitar recorte"
            aria-label="Quitar recorte"
          >
            <Icon name="x" size={14} />
          </button>
        ))}
      <span className="page-badge">{index + 1}</span>
    </div>
  );
});
