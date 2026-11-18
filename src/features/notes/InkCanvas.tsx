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
import { useUI } from '../../store/ui';
import { SheetsDialog } from './SheetsDialog';
import { PAGE_H, PAGE_W, SHEETS, ctx2d, sheetH, drawLiveSegments, drawLiveTip, drawStroke, hitsStroke, inkColor, liveOpacity, stabilize, type LiveStyle } from '../../lib/ink';
import { PenDial } from '../../components/PenDial';
import { usePinchZoom } from '../../lib/usePinchZoom';
import { inkDown, inkIsDown, inkUp } from '../../lib/inkBusy';
import { stableGroups } from '../../lib/groups';
import { FLOW_TEMPLATES, applyXf, flowTemplate, recognizeShape, snapArrowToBoxes, strokesBox, strokesInLasso, type FlowTemplate, type Xf } from '../../lib/shapes';
import { InkCropModal } from './InkCropModal';
import { SheetRail } from './SheetRail';
import { ClassAudioBar } from './ClassAudioBar';
import { useTopicStore } from '../../internship/topicStore';
import { useBridge } from '../../store/bridge';
import { escapeHtml } from '../../lib/html';
import { fileToDataUrl, loadInkImages, saveInkImages, type InkImage } from '../../lib/inkImages';
import { recordingElapsed, recordingNote } from '../../lib/classAudio';
import { useTools } from '../../store/tools';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import { useTrash } from '../../store/trash';
import type { InkTool, Note, PaperStyle, SheetKind, Stroke } from '../../types';

const EMPTY: Stroke[] = [];
/** Hojas montadas de más arriba y de más abajo de lo que se ve. */
const PAD = 2;
/** Cuántas hojas se montan de salida, antes de la primera medición. */
const WINDOW = 6;
/** Por debajo de esto no se virtualiza: un cuaderno corto se comporta igual que siempre. */
const VIRTUAL_FROM = 12;
const EMPTY_IMG: InkImage[] = [];
type Mode = 'draw' | 'eraser' | 'lasso';
type SelAction = { type: 'delete' } | { type: 'duplicate' } | { type: 'color'; color: string } | { type: 'move'; to: number } | { type: 'read' };
const SEL_COLORS = ['auto', '#dc2626', '#2563eb', '#16a34a', '#d97706'];
const INK_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/**
 * Lienzo para escritura a mano, optimizado para lápiz (Surface Pen):
 *  - Presión real del lápiz → grosor variable; cada punto se dibuja al instante.
 *  - Lazo (mover, escalar, recolorear, duplicar, borrar), formas rectas al dejar el lápiz quieto.
 *  - Botón borrador y botón lateral del lápiz; "Solo lápiz": el dedo desplaza la hoja.
 *  - Hojas: insertar, subir/bajar, quitar; plantillas de hoja.
 *  - Los trazos se guardan aparte en IndexedDB, con guardado diferido.
 */
export function InkCanvas({ note }: { note: Note }) {
  const update = useNotes((s) => s.updateNote);
  const dark = useSettings((s) => s.dark);
  const [strokes, setStrokes] = useState<Stroke[] | null>(null);
  const drawTool = useTools((s) => s.canvasTool);
  const setDrawTool = useTools((s) => s.setCanvasTool);
  const setting = useTools((s) => s.settings[s.canvasTool]);
  const [mode, setMode] = useState<Mode>('draw');
  const tool: InkTool = mode === 'draw' ? drawTool : mode;
  const penOnly = useTools((s) => s.penOnly);
  const inkAuto = useSettings((s) => s.inkAuto);
  const setInkAuto = useSettings((s) => s.setInkAuto);
  const inkZoom = useSettings((s) => s.inkZoom);
  const setInkZoom = useSettings((s) => s.setInkZoom);
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
  const [sel, setSel] = useState<{ page: number; ids: Set<string> } | null>(null);
  /** Tapar y repasar: cubre la columna izquierda (Cornell o dos columnas). */
  const [mask, setMask] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [hojaOpen, setHojaOpen] = useState(false);
  const inkRev = useBridge((s) => (s.inkRev?.noteId === note.id ? s.inkRev.n : 0));

  // El panel de hoja se cierra con Escape o tocando fuera, como cualquier otro diálogo.
  useEffect(() => {
    if (!hojaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHojaOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('.hoja-pop') && !t?.closest('[aria-haspopup="dialog"]')) setHojaOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [hojaOpen]);

  // Recortes pegados desde el PDF: se guardan aparte de los trazos y se recargan si llega uno nuevo.
  useEffect(() => {
    let alive = true;
    loadInkImages(note.id).then((imgs) => alive && setImages(imgs));
    return () => {
      alive = false;
    };
  }, [note.id, inkRev]);
  const saveImages = useCallback(
    (next: InkImage[]) => {
      setImages(next);
      void saveInkImages(note.id, next);
    },
    [note.id],
  );
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const removeImage = useCallback((id: string) => saveImages(imagesRef.current.filter((i) => i.id !== id)), [saveImages]);
  const imgGroups = useRef(new Map<number, InkImage[]>());
  const imgByPage = useMemo(() => (imgGroups.current = stableGroups(imgGroups.current, images)), [images]);

  // Al pegar un recorte, desplazarse hasta él.
  useEffect(() => {
    if (!inkRev || !images.length) return;
    const last = images[images.length - 1];
    requestAnimationFrame(() => scrollRef.current?.querySelector(`[data-img="${last.id}"]`)?.scrollIntoView({ block: 'center' }));
  }, [images, inkRev]);

  useEffect(() => {
    let alive = true;
    setSel(null);
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
      scheduleSave();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id, update],
  );
  /** Guardado diferido; si el lápiz sigue escribiendo, espera a la primera pausa. */
  const scheduleSave = () => {
    clearTimeout(timer.current);
    const tick = () => {
      if (inkIsDown()) {
        timer.current = setTimeout(tick, 150);
        return;
      }
      dirty.current = false;
      void idb.set('ink', note.id, latest.current);
      update(note.id, {});
    };
    timer.current = setTimeout(tick, 600);
  };

  const pushUndo = () => {
    undo.current.push(latest.current);
    if (undo.current.length > 80) undo.current.shift();
    redo.current = [];
    setHistoryTick((n) => n + 1);
  };

  // Al soltar el lápiz NO se renderiza nada: el trazo ya está pintado en la hoja. La lista se actualiza
  // en la primera pausa de 250 ms, así escribir rápido no dispara trabajo de la interfaz entre letra y letra.
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const addStroke = useCallback((s: Stroke) => {
    // Con la clase grabándose, cada trazo guarda el segundo en que se escribió.
    const el = recordingElapsed();
    if (el !== null && recordingNote() === noteIdRef.current) s = { ...s, t: Math.round(el / 1000) };
    if (useTools.getState().layer === 'draft') s = { ...s, layer: 'draft' };
    undo.current.push(latest.current);
    if (undo.current.length > 80) undo.current.shift();
    redo.current = [];
    latest.current = [...latest.current, s];
    dirty.current = true;
    clearTimeout(flushTimer.current);
    const flush = () => {
      if (inkIsDown()) {
        flushTimer.current = setTimeout(flush, 150); // nunca en medio de un trazo
        return;
      }
      setStrokes(latest.current);
      setHistoryTick((n) => n + 1);
      scheduleSave();
    };
    flushTimer.current = setTimeout(flush, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => clearTimeout(flushTimer.current), [note.id]);
  // Al ocultar o cerrar la ventana se guarda de inmediato lo que esté pendiente.
  useEffect(() => {
    const save = () => {
      if (!dirty.current) return;
      dirty.current = false;
      clearTimeout(timer.current);
      void idb.set('ink', note.id, latest.current);
    };
    const onVis = () => document.visibilityState === 'hidden' && save();
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [note.id]);

  const eraseAt = useCallback(
    (page: number, x: number, y: number, begin: boolean) => {
      if (begin) erasePushed.current = false;
      const cur = latest.current;
      const next = cur.filter((s) => s.page !== page || !hitsStroke(s, x, y, 12));
      if (next.length === cur.length) return;
      if (!erasePushed.current) {
        pushUndo();
        erasePushed.current = true;
      }
      persist(next);
    },
    [persist],
  );

  const pageH = sheetH(note.sheet);
  const layer = useTools((t) => t.layer);
  const setLayer = useTools((t) => t.setLayer);
  const showDraft = useTools((t) => t.showDraft);
  const setShowDraft = useTools((t) => t.setShowDraft);
  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;
  const bgPick = useRef<HTMLInputElement>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const seekRef = useRef<((seconds: number) => void) | null>(null);
  /** Con «tocar para saltar», un toque en el lienzo busca el trazo más cercano y salta a su minuto. */
  const onListenTap = useCallback((page: number, x: number, y: number) => {
    const hit = latest.current.find((st) => st.page === page && st.t !== undefined && hitsStroke(st, x, y, 26));
    if (hit?.t !== undefined) seekRef.current?.(hit.t);
  }, []);
  const [curSheet, setCurSheet] = useState(0);
  /**
   * Ventana de hojas montadas. Con hojas continuas y rollo un cuaderno llega a cientos de hojas:
   * montarlas todas cuesta en memoria y hace que cada trazo recorra todo el árbol. Se monta solo
   * lo que se ve (más un margen) y el resto se sustituye por dos separadores del alto que
   * ocuparían, así la barra de desplazamiento no cambia de tamaño.
   *
   * El alto de hoja se mide de una hoja real: así vale para cualquier tamaño y zoom.
   */
  const [win, setWin] = useState({ from: 0, to: WINDOW });
  const sheetPx = useRef(0);

  const measure = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const one = sc.querySelector('.ink-sheet') as HTMLElement | null;
    if (one?.offsetHeight) sheetPx.current = one.offsetHeight + 22;
  }, []);

  /** Qué hoja se está viendo (para las miniaturas) y qué hojas hay que montar. */
  const onScrollSheet = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    measure();
    const h = sheetPx.current;
    if (!h) return;
    const first = Math.floor(sc.scrollTop / h);
    setCurSheet(Math.max(0, first));
    setWin((w) => {
      const from = Math.max(0, first - PAD);
      const to = first + Math.ceil(sc.clientHeight / h) + PAD;
      return from === w.from && to === w.to ? w : { from, to };
    });
  }, [measure]);

  const [crop, setCrop] = useState<{ strokes: Stroke[]; box: { x: number; y: number; w: number; h: number } } | null>(null);

  /* ---------- Lazo ---------- */
  const selRef = useRef(sel);
  selRef.current = sel;
  const onSelect = useCallback((page: number, ids: string[]) => setSel(ids.length ? { page, ids: new Set(ids) } : null), []);
  const onTransform = useCallback(
    (f: Xf) => {
      const cur = selRef.current;
      if (!cur) return;
      pushUndo();
      persist(latest.current.map((s) => (cur.ids.has(s.id) ? applyXf(s, f) : s)));
    },
    [persist],
  );
  const onSelAction = useCallback(
    (a: SelAction) => {
      const cur = selRef.current;
      if (!cur) return;
      if (a.type === 'read') {
        const mine = latest.current.filter((st) => cur.ids.has(st.id));
        const box = mine.length ? strokesBox(mine) : null;
        if (box) setCrop({ strokes: mine, box });
        return;
      }
      pushUndo();
      if (a.type === 'delete') {
        persist(latest.current.filter((s) => !cur.ids.has(s.id)));
        setSel(null);
      } else if (a.type === 'color') {
        persist(latest.current.map((s) => (cur.ids.has(s.id) ? { ...s, color: a.color } : s)));
      } else if (a.type === 'move') {
        // La selección se va a otra hoja con las mismas coordenadas.
        persist(latest.current.map((s) => (cur.ids.has(s.id) ? { ...s, page: a.to } : s)));
        setSel(null);
      } else {
        const copies = latest.current.filter((s) => cur.ids.has(s.id)).map((s) => ({ ...applyXf(s, { dx: 24, dy: 24, s: 1, ox: 0, oy: 0 }), id: uid() }));
        persist([...latest.current, ...copies]);
        setSel({ page: cur.page, ids: new Set(copies.map((c) => c.id)) });
      }
    },
    [persist],
  );

  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    redo.current.push(latest.current);
    setSel(null);
    persist(prev);
  };
  const doRedo = () => {
    const next = redo.current.pop();
    if (!next) return;
    undo.current.push(latest.current);
    setSel(null);
    persist(next);
  };
  const clearAll = () => {
    if (!latest.current.length || !confirm('¿Borrar todos los trazos de esta nota?')) return;
    pushUndo();
    setSel(null);
    persist([]);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selRef.current) {
      e.preventDefault();
      onSelAction({ type: 'delete' });
      return;
    }
    if (e.key === 'Escape' && selRef.current) {
      setSel(null);
      return;
    }
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

  // Agrupar por hoja conservando los arreglos que no cambiaron: escribir en una hoja no redibuja las demás.
  const groups = useRef(new Map<number, Stroke[]>());
  // Con el borrador oculto, esos trazos simplemente no se dibujan (siguen guardados).
  const shown = useMemo(() => (showDraft ? (strokes ?? []) : (strokes ?? []).filter((st) => st.layer !== 'draft')), [strokes, showDraft]);
  const byPage = useMemo(() => (groups.current = stableGroups(groups.current, shown)), [shown]);

  usePinchZoom(scrollRef, inkZoom, setInkZoom, { min: 0.5, max: 3 });
  let lastUsed = -1;
  for (const s of strokes ?? []) if (s.page > lastUsed) lastUsed = s.page;
  for (const im of images) if (im.page > lastUsed) lastUsed = im.page;
  const reserved = Math.max(1, note.inkPages, lastUsed + 1);
  // Hojas continuas: en cuanto hay tinta en la última, se ofrece otra debajo. La hoja de
  // más no se guarda: si borras lo que escribiste, se retira sola y no deja hojas sueltas.
  const pages = inkAuto && lastUsed + 1 >= reserved ? reserved + 1 : reserved;
  useEffect(() => {
    measure();
    onScrollSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, inkZoom, note.sheet, strokes === null]);

  const zoomStep = (dir: 1 | -1) => {
    const i = INK_ZOOMS.findIndex((v) => v >= inkZoom - 0.001);
    const idx = (i === -1 ? INK_ZOOMS.length - 1 : i) + dir;
    setInkZoom(INK_ZOOMS[Math.min(INK_ZOOMS.length - 1, Math.max(0, idx))]);
  };

  /* ---------- Hojas: insertar, mover, quitar ---------- */
  const remap = (f: (page: number) => number | null) => {
    pushUndo();
    setSel(null);
    persist(latest.current.flatMap((s) => {
      const p = f(s.page);
      return p === null ? [] : p === s.page ? [s] : [{ ...s, page: p }];
    }));
    saveImages(imagesRef.current.flatMap((im) => {
      const p = f(im.page);
      return p === null ? [] : [{ ...im, page: p }];
    }));
  };
  const insertPage = (at: number) => {
    remap((p) => (p >= at ? p + 1 : p));
    update(note.id, { inkPages: reserved + 1 });
  };
  const movePage = (i: number, dir: 1 | -1) => {
    const j = i + dir;
    if (j < 0 || j >= pages) return;
    remap((p) => (p === i ? j : p === j ? i : p));
  };
  /** Nuevo orden de hojas: `order[i]` es la hoja que pasa a la posición i. */
  const reorderSheets = (order: number[]) => {
    const to = new Map(order.map((old, i) => [old, i]));
    remap((p) => to.get(p) ?? p);
  };

  /**
   * Fusiona la hoja i con la anterior: su contenido baja debajo de lo que ya había,
   * y si no cabe queda encima (se avisa). La hoja i desaparece.
   */
  const mergeSheet = (i: number) => {
    if (i < 1) return;
    const src = latest.current.filter((s) => s.page === i);
    const srcImgs = imagesRef.current.filter((im) => im.page === i);
    if (!src.length && !srcImgs.length) {
      deletePage(i);
      return;
    }
    const span = (page: number) => {
      let top = Infinity;
      let bottom = -Infinity;
      for (const st of latest.current) if (st.page === page) for (const pt of st.points) (top = Math.min(top, pt[1])), (bottom = Math.max(bottom, pt[1]));
      for (const im of imagesRef.current)
        if (im.page === page) (top = Math.min(top, im.y)), (bottom = Math.max(bottom, im.y + im.h));
      return { top, bottom };
    };
    const dst = span(i - 1);
    const mine = span(i);
    const used = dst.bottom > -Infinity ? dst.bottom + 24 : 0;
    const height = mine.bottom - mine.top;
    const fits = used + height <= PAGE_H;
    const dy = fits ? used - mine.top : 0;
    if (!fits) useUI.getState().showToast('No cabía debajo: el contenido quedó encima del de la hoja anterior.');
    pushUndo();
    setSel(null);
    const moved = new Set(src.map((x) => x.id));
    persist(
      latest.current.flatMap((st) => {
        if (moved.has(st.id)) return [{ ...applyXf(st, { dx: 0, dy, s: 1, ox: 0, oy: 0 }), page: i - 1 }];
        return st.page > i ? [{ ...st, page: st.page - 1 }] : [st];
      }),
    );
    saveImages(
      imagesRef.current.map((im) =>
        im.page === i ? { ...im, page: i - 1, y: im.y + dy } : im.page > i ? { ...im, page: im.page - 1 } : im,
      ),
    );
    update(note.id, { inkPages: Math.max(1, reserved - 1) });
  };

  const deletePage = (i: number) => {
    const mine = latest.current.filter((s) => s.page === i);
    const pics = imagesRef.current.filter((im) => im.page === i);
    const used = mine.length > 0 || pics.length > 0;
    if (used && !confirm(`¿Quitar la hoja ${i + 1} con todo lo que tiene? Queda 30 días en la papelera.`)) return;
    // La hoja se guarda en la papelera con sus trazos e imágenes, para poder devolverla.
    if (used)
      useTrash.getState().push(`${note.title || 'Nota'} · hoja ${i + 1}`, {
        kind: 'sheet',
        noteId: note.id,
        noteTitle: note.title || 'Nota sin título',
        page: i,
        strokes: mine,
        images: pics,
      });
    remap((p) => (p === i ? null : p > i ? p - 1 : p));
    update(note.id, { inkPages: Math.max(1, reserved - 1) });
  };

  useEffect(() => {
    if (note.paper !== 'cornell' && note.paper !== 'columns') setMask(false);
  }, [note.paper]);

  const color = setting.color;
  const size = setting.size;


  // Virtualización: con pocas hojas se montan todas (cero riesgo en el caso normal).
  const virtual = pages >= VIRTUAL_FROM && sheetPx.current > 0;
  const from = virtual ? Math.min(win.from, Math.max(0, pages - 1)) : 0;
  const to = virtual ? Math.min(pages, Math.max(win.to, from + 1)) : pages;
  return (
    <div className="ink-wrap" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="ink-toolbar" role="toolbar" aria-label="Herramientas de dibujo">
        <button className={`icon-btn${mode === 'eraser' ? ' active' : ''}`} onClick={() => setMode((m) => (m === 'eraser' ? 'draw' : 'eraser'))} title="Borrador de trazo (o usa el borrador del lápiz)" aria-pressed={mode === 'eraser'} aria-label="Borrador">
          <Icon name="eraser" />
        </button>
        <button
          className={`icon-btn${mode === 'lasso' ? ' active' : ''}`}
          onClick={() => {
            setMode((m) => (m === 'lasso' ? 'draw' : 'lasso'));
            setSel(null);
          }}
          title="Lazo: encierra trazos para leerlos, moverlos, cambiarles tamaño o color, duplicarlos o borrarlos"
          aria-pressed={mode === 'lasso'}
          aria-label="Lazo"
        >
          <Icon name="lasso" />
        </button>
        <div className="tb-sep" />
        <button className="icon-btn" onClick={doUndo} disabled={!undo.current.length} title="Deshacer (Ctrl+Z)">
          <Icon name="undo" />
        </button>
        <button className="icon-btn" onClick={doRedo} disabled={!redo.current.length} title="Rehacer (Ctrl+Y)">
          <Icon name="redo" />
        </button>
        <div className="spacer" />
        <div className="group ink-zoom" role="group" aria-label="Zoom del lienzo">
          <button className="icon-btn" onClick={() => zoomStep(-1)} title="Alejar (o pellizca con dos dedos / Ctrl + rueda)" aria-label="Alejar lienzo">
            <Icon name="zoomOut" />
          </button>
          <button className="btn ghost tabular zoom-label" onClick={() => setInkZoom(1)} title="Ajustar al ancho">
            {Math.round(inkZoom * 100)}%
          </button>
          <button className="icon-btn" onClick={() => zoomStep(1)} title="Acercar (o pellizca con dos dedos / Ctrl + rueda)" aria-label="Acercar lienzo">
            <Icon name="zoomIn" />
          </button>
        </div>
        <button
          className={`btn ghost sm${penOnly ? ' active' : ''}`}
          onClick={() => setPenOnly(!penOnly)}
          title="Solo lápiz (activado por defecto): la mano y la palma no dibujan; el dedo desplaza la hoja"
          aria-pressed={penOnly}
        >
          <Icon name="hand" size={16} /> Solo lápiz
        </button>
        {(note.paper === 'cornell' || note.paper === 'columns') && (
          <button
            className={`btn ghost sm${mask ? ' active' : ''}`}
            onClick={() => setMask((v) => !v)}
            aria-pressed={mask}
            title={note.paper === 'cornell' ? 'Tapar la columna de la izquierda para repasar (toca la zona tapada para ver)' : 'Tapar la columna izquierda para repasar'}
          >
            <Icon name="eye" size={16} /> Tapar y repasar
          </button>
        )}
        <button className="btn ghost sm" onClick={() => setSheetsOpen(true)} title="Organizar hojas: reordenar arrastrando y fusionar" disabled={pages < 2}>
          <Icon name="layers" size={16} /> Organizar
        </button>
        {/* Lo que se cambia una vez por nota vive aquí dentro: la barra se queda con lo de cada trazo. */}
        <button
          className={`btn ghost sm${hojaOpen ? ' active' : ''}`}
          onClick={() => setHojaOpen((v) => !v)}
          aria-expanded={hojaOpen}
          aria-haspopup="dialog"
          title="Hoja: tamaño, estilo, capa, plantillas y fondo"
        >
          <Icon name="page" size={16} /> Hoja
        </button>
      </div>
      {hojaOpen && (
        <div className="hoja-pop" role="dialog" aria-label="Opciones de la hoja">
        <select
          className="select xs"
          value=""
          onChange={(e) => {
            const kind = e.target.value as FlowTemplate;
            e.target.value = '';
            if (!kind) return;
            pushUndo();
            const add = flowTemplate(kind).map((pts) => ({
              id: uid(),
              page: curSheet,
              tool: 'pen' as const,
              color: 'auto',
              size: 2.4,
              points: pts,
              ...(useTools.getState().layer === 'draft' ? { layer: 'draft' as const } : null),
            }));
            persist([...latest.current, ...add]);
            useUI.getState().showToast('Flujograma puesto en la hoja: escribe dentro de las cajas.');
          }}
          aria-label="Plantilla de flujograma"
          title="Poner un esqueleto de flujograma en la hoja que estás viendo"
        >
          <option value="">Flujograma…</option>
          {FLOW_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="seg xs" role="radiogroup" aria-label="Capa del lienzo">
          <button role="radio" aria-checked={layer === 'draft'} className={layer === 'draft' ? 'active' : ''} onClick={() => setLayer('draft')} title="Escribir en el borrador: va debajo y más tenue">
            Borrador
          </button>
          <button role="radio" aria-checked={layer === 'clean'} className={layer === 'clean' ? 'active' : ''} onClick={() => setLayer('clean')} title="Escribir en la capa limpia">
            Limpio
          </button>
        </div>
        <button
          className={`icon-btn${showDraft ? ' active' : ''}`}
          onClick={() => setShowDraft(!showDraft)}
          aria-pressed={showDraft}
          title={showDraft ? 'Ocultar el borrador (no se borra)' : 'Mostrar el borrador'}
        >
          <Icon name="eye" size={16} />
        </button>
        <button
          className={`icon-btn${audioOpen ? ' active' : ''}`}
          onClick={() => setAudioOpen((v) => !v)}
          aria-pressed={audioOpen}
          title="Grabar la clase y amarrarla a lo que escribes (para clases, no para pacientes)"
        >
          <Icon name="mic" size={16} />
        </button>
        <button
          className={`icon-btn${railOpen ? ' active' : ''}`}
          onClick={() => setRailOpen((v) => !v)}
          aria-pressed={railOpen}
          title={railOpen ? 'Ocultar las miniaturas de las hojas' : 'Ver las miniaturas de las hojas al lado'}
        >
          <Icon name="columns" size={16} />
        </button>
        <button
          className={`icon-btn${inkAuto ? ' active' : ''}`}
          onClick={() => setInkAuto(!inkAuto)}
          aria-pressed={inkAuto}
          title={inkAuto ? 'Hojas continuas: activadas (al escribir en la última aparece otra)' : 'Hojas continuas: apagadas (las añades tú)'}
        >
          <Icon name="arrowDown" size={16} />
        </button>
        <button
          className={`icon-btn${note.sheetBg ? ' active' : ''}`}
          onClick={() => (note.sheetBg ? update(note.id, { sheetBg: undefined }) : bgPick.current?.click())}
          aria-pressed={!!note.sheetBg}
          title={note.sheetBg ? 'Quitar el fondo de la hoja' : 'Poner una imagen de fondo fija en todas las hojas (una lámina, un formato del hospital)'}
        >
          <Icon name="map" size={16} />
        </button>
        <input
          ref={bgPick}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) update(note.id, { sheetBg: await fileToDataUrl(f) });
          }}
        />
        <select
          className="select xs"
          value={note.sheet ?? 'a4'}
          onChange={(e) => update(note.id, { sheet: e.target.value as SheetKind })}
          aria-label="Tamaño de hoja"
          title="Tamaño y orientación de la hoja"
        >
          {SHEETS.map((sh) => (
            <option key={sh.id} value={sh.id}>
              {sh.label}
            </option>
          ))}
        </select>
        <select className="select xs" value={note.paper} onChange={(e) => update(note.id, { paper: e.target.value as PaperStyle })} aria-label="Tipo de hoja">
          <optgroup label="Para escribir">
            <option value="lined">Rayada</option>
            <option value="margin">Rayada con margen</option>
            <option value="half">Mitad dibujo, mitad renglón</option>
            <option value="blank">Lisa</option>
          </optgroup>
          <optgroup label="Para dibujar y medir">
            <option value="dots">Punteada</option>
            <option value="grid">Cuadrícula</option>
            <option value="graph">Milimetrada</option>
            <option value="ecg">Papel de electro</option>
            <option value="plate">Lámina con pie</option>
          </optgroup>
          <optgroup label="Para repasar">
            <option value="cornell">Cornell</option>
            <option value="columns">Dos columnas</option>
          </optgroup>
        </select>
        <button className="icon-btn danger" onClick={clearAll} title="Borrar todo lo escrito en esta nota">
          <Icon name="trash" />
        </button>
        </div>
      )}
      {audioOpen && <ClassAudioBar noteId={note.id} seekRef={seekRef} onListening={setListening} />}
      <div className="ink-body">
      <PenDial
        tool={drawTool}
        corner="tl"
        inactive={mode !== 'draw'}
        onTool={(t) => {
          setDrawTool(t);
          setMode('draw');
        }}
      />
      {railOpen && (
        <SheetRail
          pages={pages}
          pageH={pageH}
          strokes={strokes ?? EMPTY}
          images={images}
          current={curSheet}
          onGo={(i) => scrollRef.current?.querySelectorAll('.ink-sheet')[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          onClose={() => setRailOpen(false)}
        />
      )}
      <div className="ink-scroll" ref={scrollRef} data-sheet={note.sheet ?? 'a4'} onScroll={onScrollSheet} style={{ '--ink-zoom': inkZoom } as CSSProperties}>
        {strokes === null ? (
          <div className="loading">Cargando lienzo…</div>
        ) : (
          <>
            {virtual && from > 0 && <div style={{ height: from * sheetPx.current }} aria-hidden="true" />}
            {Array.from({ length: to - from }, (_, k) => from + k).map((i) => (
              <div className="ink-sheet" key={i}>
                <div className="ink-page-head">
                  <span className="muted small">Hoja {i + 1}</span>
                  <span className="spacer" />
                  <button className="icon-btn xs" onClick={() => insertPage(i)} title="Insertar una hoja antes de esta" aria-label={`Insertar hoja antes de la ${i + 1}`}>
                    <Icon name="plus" size={14} />
                  </button>
                  <button className="icon-btn xs" onClick={() => movePage(i, -1)} disabled={i === 0} title="Subir hoja" aria-label={`Subir hoja ${i + 1}`}>
                    <Icon name="arrowUp" size={14} />
                  </button>
                  <button className="icon-btn xs" onClick={() => movePage(i, 1)} disabled={i === pages - 1} title="Bajar hoja" aria-label={`Bajar hoja ${i + 1}`}>
                    <Icon name="arrowDown" size={14} />
                  </button>
                  <button className="icon-btn xs" onClick={() => deletePage(i)} disabled={pages === 1} title="Quitar hoja" aria-label={`Quitar hoja ${i + 1}`}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <InkPage
                  index={i}
                  strokes={byPage.get(i) ?? EMPTY}
                  images={imgByPage.get(i) ?? EMPTY_IMG}
                  onRemoveImage={removeImage}
                  tool={tool}
                  color={color}
                  size={size}
                  penOnly={penOnly}
                  paper={note.paper}
                  pageH={pageH}
                  onListenTap={listening ? onListenTap : null}
                  sheetBg={note.sheetBg}
                  mask={mask}
                  totalPages={pages}
                  dark={dark}
                  scrollRef={scrollRef}
                  sel={sel?.page === i ? sel.ids : null}
                  onStroke={addStroke}
                  onErase={eraseAt}
                  onSelect={onSelect}
                  onTransform={onTransform}
                  onSelAction={onSelAction}
                />
              </div>
            ))}
            {virtual && to < pages && <div style={{ height: (pages - to) * sheetPx.current }} aria-hidden="true" />}
            {!inkAuto && (
              <button className="btn ghost add-page" onClick={() => update(note.id, { inkPages: pages + 1 })}>
                <Icon name="plus" size={16} /> Añadir hoja
              </button>
            )}
          </>
        )}
      </div>
      </div>
      {crop && (
        <InkCropModal
          strokes={crop.strokes}
          box={crop.box}
          pageH={pageH}
          topicId={useTopicStore.getState().lastTopicId}
          onToNote={(t) => useBridge.getState().insertIntoNote(escapeHtml(t).replace(/\n/g, '<br>'), { noteId: note.id, append: true })}
          onClose={() => setCrop(null)}
        />
      )}
      {sheetsOpen && (
        <SheetsDialog
          pages={reserved}
          pageH={pageH}
          strokes={strokes ?? EMPTY}
          images={images}
          onReorder={reorderSheets}
          onMerge={mergeSheet}
          onClose={() => setSheetsOpen(false)}
        />
      )}
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
  /** Alto lógico de la hoja (cambia con el tamaño elegido). */
  pageH: number;
  /** Con la escucha abierta, tocar un trazo salta a su minuto en vez de dibujar. */
  onListenTap: ((page: number, x: number, y: number) => void) | null;
  /** Imagen de fondo fija de la hoja, si la nota tiene una. */
  sheetBg?: string;
  /** Tapar la columna izquierda para repasar. */
  mask: boolean;
  /** Cuántas hojas tiene la nota (para mover la selección entre hojas). */
  totalPages: number;
  dark: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  sel: Set<string> | null;
  onStroke: (s: Stroke) => void;
  onErase: (page: number, x: number, y: number, begin: boolean) => void;
  onSelect: (page: number, ids: string[]) => void;
  onTransform: (f: Xf) => void;
  onSelAction: (a: SelAction) => void;
}

type Gesture =
  | { kind: 'draw'; id: number; pts: number[][]; rect: DOMRect; drawn: number; st: LiveStyle; color: string; snapped: boolean; anchor: number[] }
  | { kind: 'erase'; id: number; rect: DOMRect }
  | { kind: 'lasso'; id: number; pts: number[][]; rect: DOMRect }
  | { kind: 'move' | 'scale'; id: number; rect: DOMRect; start: number[] };

const IDENT = (ox = 0, oy = 0): Xf => ({ dx: 0, dy: 0, s: 1, ox, oy });

const InkPage = memo(function InkPage({ index, strokes, images, onRemoveImage, tool, color, size, penOnly, paper, pageH, onListenTap, sheetBg, mask, totalPages, dark, scrollRef, sel, onStroke, onErase, onSelect, onTransform, onSelAction }: PageProps) {
  /** Esta hoja ya se destapó (se vuelve a tapar al apagar el modo). */
  const [shownMask, setShownMask] = useState(false);
  useEffect(() => {
    if (!mask) setShownMask(false);
  }, [mask]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(0);
  const [visible, setVisible] = useState(index < 2);
  const cur = useRef<Gesture | null>(null);
  const pan = useRef<{ id: number; y: number; x: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const xfRef = useRef<Xf | null>(null);
  const [xf, setXfState] = useState<Xf | null>(null);
  const setXf = (f: Xf | null) => {
    xfRef.current = f;
    setXfState(f);
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => el.clientWidth > 0 && setCssW(el.clientWidth);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    // Las hojas lejos de la vista sueltan sus canvas (memoria) y se redibujan al acercarse.
    const io = new IntersectionObserver(([en]) => setVisible(en.isIntersecting), { root: scrollRef.current, rootMargin: '900px 0px' });
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
      clearTimeout(holdTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ajusta el canvas a la resolución del dispositivo y deja el contexto en coordenadas lógicas. */
  const prepare = (c: HTMLCanvasElement | null) => {
    if (!c) return null;
    if (!cssW || !visible) {
      if (c.width) c.width = c.height = 0;
      return null;
    }
    // Con zoom alto se limita la resolución interna (≤ 2200 px de ancho) para no gastar memoria ni batería.
    const dpr = Math.min(window.devicePixelRatio || 1, 2, 2200 / cssW);
    const w = Math.round(cssW * dpr);
    const h = Math.round(((cssW * pageH) / PAGE_W) * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = ctx2d(c);
    if (!ctx) return null;
    const k = (cssW / PAGE_W) * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, PAGE_W, pageH);
    return ctx;
  };

  const selStrokes = useMemo(() => (sel ? strokes.filter((s) => sel.has(s.id)) : EMPTY), [strokes, sel]);
  const baseStrokes = useMemo(() => (selStrokes.length ? strokes.filter((s) => !sel!.has(s.id)) : strokes), [strokes, sel, selStrokes]);
  const box = useMemo(() => strokesBox(selStrokes), [selStrokes]);

  // Al soltar el lápiz el trazo ya se dibujó en la base: no hace falta redibujar toda la hoja
  // (ese redibujo completo trababa el inicio del siguiente trazo al escribir rápido).
  const committed = useRef(new Set<string>());
  const prevStrokes = useRef<Stroke[]>(baseStrokes);
  const prevKey = useRef('');

  useEffect(() => {
    const prev = prevStrokes.current;
    const key = `${cssW}|${dark}|${visible}`;
    // ¿Solo se agregaron trazos que ya están pintados en la base? Entonces no hay nada que redibujar.
    const done = committed.current;
    const appended =
      done.size > 0 &&
      key === prevKey.current &&
      baseStrokes.length > prev.length &&
      prev.every((s, i) => s === baseStrokes[i]) &&
      baseStrokes.slice(prev.length).every((s) => done.has(s.id));
    prevStrokes.current = baseStrokes;
    prevKey.current = key;
    if (!cur.current) committed.current = new Set();
    if (appended) return;
    const ctx = prepare(baseRef.current);
    if (!ctx) return;
    const ink = inkColor();
    for (const s of baseStrokes) drawStroke(ctx, s, ink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStrokes, cssW, dark, visible]);

  // Selección del lazo: sus trazos se pintan en la capa en vivo con la transformación en curso (barato al arrastrar).
  const liveKey = useRef('');
  const hadSel = useRef(false);
  useEffect(() => {
    if (cur.current?.kind === 'draw') return;
    // Sin selección y sin cambio de tamaño no hay nada que hacer (no se limpia la hoja en cada trazo).
    const k = `${cssW}|${visible}`;
    if (!selStrokes.length && !hadSel.current && k === liveKey.current) return;
    liveKey.current = k;
    hadSel.current = selStrokes.length > 0;
    const ctx = prepare(liveRef.current);
    prepare(tipRef.current);
    if (liveRef.current) liveRef.current.style.opacity = '1';
    if (!ctx || !selStrokes.length) return;
    const f = xf ?? IDENT();
    const ink = inkColor();
    for (const s of selStrokes) drawStroke(ctx, f.s === 1 && !f.dx && !f.dy ? s : applyXf(s, f), ink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selStrokes, xf, baseStrokes, cssW, dark, visible]);

  const toLocal = (ev: { clientX: number; clientY: number; pressure: number }, r: DOMRect): number[] => [
    Math.round(((ev.clientX - r.left) / r.width) * PAGE_W * 10) / 10,
    Math.round(((ev.clientY - r.top) / r.height) * pageH * 10) / 10,
    Math.round((ev.pressure || 0.5) * 100) / 100,
  ];

  const strokeTool: Stroke['tool'] = tool === 'eraser' || tool === 'lasso' ? 'pen' : tool;

  /** Dibuja al instante solo lo nuevo del trazo y la punta predicha (sin esperar al siguiente cuadro). */
  const paintLive = (predicted: number[][] = []) => {
    const c = cur.current;
    if (!c || c.kind !== 'draw' || !liveRef.current) return;
    const ctx = ctx2d(liveRef.current);
    if (ctx) c.drawn = drawLiveSegments(ctx, c.pts, c.drawn, c.st, c.color);
    const tip = tipRef.current && ctx2d(tipRef.current);
    if (tip) drawLiveTip(tip, c.pts, predicted, c.st, c.color);
  };

  /** Lazo en curso: línea punteada en la capa de la punta. */
  const paintLasso = (pts: number[][]) => {
    const ctx = tipRef.current && ctx2d(tipRef.current);
    if (!ctx) return;
    ctx.clearRect(0, 0, PAGE_W, pageH);
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6366f1';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.restore();
  };

  /** Lápiz quieto al final del trazo → forma limpia (línea, flecha, rectángulo, elipse). */
  const trySnap = () => {
    const c = cur.current;
    if (!c || c.kind !== 'draw' || c.snapped || !useTools.getState().snapShapes) return;
    const shape = recognizeShape(c.pts);
    if (!shape) return;
    // Una flecha que termina cerca de una caja se engancha a su borde: el algoritmo queda conectado.
    c.pts = shape.kind === 'arrow' ? snapArrowToBoxes(shape.points, strokes) : shape.points;
    c.snapped = true;
    c.st = { ...c.st, pressure: false };
    c.drawn = 0;
    for (const el of [liveRef.current, tipRef.current]) el && ctx2d(el)?.clearRect(0, 0, PAGE_W, pageH);
    paintLive();
    wrapRef.current?.classList.add('snapped');
    setTimeout(() => wrapRef.current?.classList.remove('snapped'), 250);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (onListenTap) {
      // Escuchando la clase: el toque busca el apunte y salta a su minuto, no dibuja.
      const r = e.currentTarget.getBoundingClientRect();
      onListenTap(index, ((e.clientX - r.left) / r.width) * PAGE_W, ((e.clientY - r.top) / r.height) * pageH);
      return;
    }
    if (penOnly && e.pointerType === 'touch') {
      pan.current = { id: e.pointerId, y: e.clientY, x: e.clientX };
      return;
    }
    const barrel = e.pointerType === 'pen' && (e.button === 2 || (e.buttons & 2) === 2) ? useTools.getState().barrel : 'none';
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    capturePointer(e.currentTarget, e.pointerId);
    inkDown();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = toLocal(e, rect);
    // Con una selección activa: dentro del recuadro se mueve; en la esquina se cambia el tamaño; fuera se suelta.
    if (box) {
      const pad = 14;
      if (Math.hypot(p[0] - (box.x + box.w), p[1] - (box.y + box.h)) < 34) {
        cur.current = { kind: 'scale', id: e.pointerId, rect, start: p };
        setXf(IDENT(box.x, box.y));
        return;
      }
      if (p[0] >= box.x - pad && p[0] <= box.x + box.w + pad && p[1] >= box.y - pad && p[1] <= box.y + box.h + pad) {
        cur.current = { kind: 'move', id: e.pointerId, rect, start: p };
        setXf(IDENT(box.x, box.y));
        return;
      }
      onSelect(index, []);
    }
    // Botón borrador del lápiz: button 5 / buttons bit 32. Botón lateral: según Preferencias.
    if (tool === 'eraser' || barrel === 'eraser' || e.button === 5 || (e.buttons & 32) === 32) {
      cur.current = { kind: 'erase', id: e.pointerId, rect };
      onErase(index, p[0], p[1], true);
      return;
    }
    if (tool === 'lasso' || barrel === 'lasso') {
      cur.current = { kind: 'lasso', id: e.pointerId, pts: [p], rect };
      return;
    }
    const st: LiveStyle = { tool: strokeTool, color, size, pressure: e.pointerType === 'pen' };
    cur.current = { kind: 'draw', id: e.pointerId, pts: [p], rect, drawn: 0, st, color: color === 'auto' ? inkColor() : color, snapped: false, anchor: p };
    const op = String(liveOpacity(strokeTool));
    if (liveRef.current) liveRef.current.style.opacity = op;
    if (tipRef.current) tipRef.current.style.opacity = op;
    paintLive();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pn = pan.current;
    if (pn && pn.id === e.pointerId) {
      const sc = scrollRef.current;
      if (sc && !sc.dataset.pinching) {
        sc.scrollTop -= e.clientY - pn.y;
        sc.scrollLeft -= e.clientX - pn.x;
      }
      pn.y = e.clientY;
      pn.x = e.clientX;
      return;
    }
    const c = cur.current;
    if (!c || c.id !== e.pointerId) return;
    if (c.kind === 'move' || c.kind === 'scale') {
      if (!box) return;
      const p = toLocal(e, c.rect);
      if (c.kind === 'move') setXf({ dx: p[0] - c.start[0], dy: p[1] - c.start[1], s: 1, ox: box.x, oy: box.y });
      else setXf({ dx: 0, dy: 0, s: Math.min(6, Math.max(0.2, Math.max((p[0] - box.x) / box.w, (p[1] - box.y) / box.h))), ox: box.x, oy: box.y });
      return;
    }
    if (c.kind === 'lasso') {
      c.pts.push(toLocal(e, c.rect));
      paintLasso(c.pts);
      return;
    }
    // Con pointerrawupdate (lápiz sin esperar al cuadro) la tinta ya se dibujó ahí.
    if (rawSeen.current) return;
    inkMove(e.nativeEvent);
  };

  /** Puntos del lápiz (incluidos los agrupados) → trazo en vivo o borrador. */
  const inkMove = (native: PointerEvent) => {
    const c = cur.current;
    if (!c || c.id !== native.pointerId || (c.kind !== 'draw' && c.kind !== 'erase')) return;
    if (c.kind === 'draw' && c.snapped) return;
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const ev of coalesced.length ? coalesced : [native]) {
      const p = toLocal(ev, c.rect);
      if (c.kind === 'erase') {
        onErase(index, p[0], p[1], false);
        continue;
      }
      // Suavizado adaptable: quita el temblor al escribir despacio, sin retraso en trazos rápidos.
      stabilize(c.pts[c.pts.length - 1], p);
      c.pts.push(p);
    }
    if (c.kind === 'erase') return;
    // Formas rectas: el reloj se reinicia solo cuando el lápiz se aleja de donde estaba.
    const last = c.pts[c.pts.length - 1];
    if (Math.hypot(last[0] - c.anchor[0], last[1] - c.anchor[1]) > 7) {
      c.anchor = last;
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(trySnap, 550);
    }
    const predicted = useSettings.getState().inkPredict && typeof native.getPredictedEvents === 'function' ? native.getPredictedEvents().map((ev) => toLocal(ev, c.rect)) : [];
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
      const k = cur.current?.kind;
      if (k !== 'draw' && k !== 'erase') return;
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
    inkUp();
    clearTimeout(holdTimer.current);
    if (c.kind === 'erase') return;
    if (c.kind === 'move' || c.kind === 'scale') {
      const f = xfRef.current;
      setXf(null);
      if (f && (f.dx || f.dy || f.s !== 1)) onTransform(f);
      return;
    }
    if (c.kind === 'lasso') {
      const ctx = tipRef.current && ctx2d(tipRef.current);
      ctx?.clearRect(0, 0, PAGE_W, pageH);
      onSelect(index, strokesInLasso(strokes, c.pts));
      return;
    }
    if (c.kind !== 'draw') return;
    // El trazo definitivo se pinta en la base aquí mismo (solo él) y se limpian las capas en vivo: sin parpadeo ni redibujo.
    const stroke: Stroke = { id: uid(), page: index, tool: strokeTool, color, size, points: c.pts };
    const base = baseRef.current && ctx2d(baseRef.current);
    if (base) {
      drawStroke(base, stroke, inkColor());
      committed.current.add(stroke.id);
    }
    // La punta y el trazo en vivo se borran SIEMPRE: si quedaran, la cola predicha uniría una letra con la siguiente.
    for (const el of [liveRef.current, tipRef.current]) el && ctx2d(el)?.clearRect(0, 0, PAGE_W, pageH);
    onStroke(stroke);
  };

  const line = (cssW / PAGE_W) * 44;
  const f = xf ?? IDENT();
  const shown = box && { x: box.x + f.dx, y: box.y + f.dy, w: box.w * f.s, h: box.h * f.s };
  const stop = (ev: ReactPointerEvent) => ev.stopPropagation();
  return (
    <div
      ref={wrapRef}
      className={`ink-page${tool === 'eraser' ? ' erasing' : ''}${tool === 'lasso' ? ' lassoing' : ''}`}
      data-paper={paper}
      style={{ '--line': `${line}px`, aspectRatio: `${PAGE_W} / ${pageH}`, ...(sheetBg ? { backgroundImage: `url(${sheetBg})`, backgroundSize: '100% 100%' } : null) } as CSSProperties}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {mask && !shownMask && (
        <button
          className="ink-mask"
          onClick={() => setShownMask(true)}
          onPointerDown={(e) => e.stopPropagation()}
          title="Toca para ver lo que está tapado"
          aria-label={`Ver la columna tapada de la hoja ${index + 1}`}
        >
          <Icon name="eye" size={18} />
          <span className="small">Toca para ver</span>
        </button>
      )}
      {images.map((im) => (
        <img
          key={im.id}
          className="ink-img"
          data-img={im.id}
          src={im.src}
          alt="Recorte del PDF"
          draggable={false}
          style={{ left: `${(im.x / PAGE_W) * 100}%`, top: `${(im.y / pageH) * 100}%`, width: `${(im.w / PAGE_W) * 100}%`, height: `${(im.h / pageH) * 100}%` }}
        />
      ))}
      <canvas ref={baseRef} />
      <canvas ref={liveRef} data-live="" className="ink-live" />
      <canvas ref={tipRef} data-live="" className="ink-live" />
      {shown && (
        <div className="sel-box" style={{ left: `${(shown.x / PAGE_W) * 100}%`, top: `${(shown.y / pageH) * 100}%`, width: `${(shown.w / PAGE_W) * 100}%`, height: `${(shown.h / pageH) * 100}%` }}>
          <i className="sel-handle" />
          {!xf && (
            <div className="sel-bar" onPointerDown={stop} onPointerUp={stop} onPointerMove={stop}>
              {SEL_COLORS.map((c) => (
                <button key={c} className={`swatch${c === 'auto' ? ' auto' : ''}`} style={c === 'auto' ? undefined : { background: c }} onClick={() => onSelAction({ type: 'color', color: c })} aria-label={`Cambiar color a ${c === 'auto' ? 'tinta' : c}`} title="Cambiar color" />
              ))}
              <button className="icon-btn xs" onClick={() => onSelAction({ type: 'read' })} title="Leer la selección: pasarla a texto, fórmula o flashcard" aria-label="Leer la selección">
                <Icon name="text" size={14} />
              </button>
              <button className="icon-btn xs" onClick={() => onSelAction({ type: 'duplicate' })} title="Duplicar" aria-label="Duplicar selección">
                <Icon name="copy" size={14} />
              </button>
              <button
                className="icon-btn xs"
                onClick={() => onSelAction({ type: 'move', to: index - 1 })}
                disabled={index === 0}
                title="Mover la selección a la hoja anterior"
                aria-label="Mover la selección a la hoja anterior"
              >
                <Icon name="arrowUp" size={14} />
              </button>
              <button
                className="icon-btn xs"
                onClick={() => onSelAction({ type: 'move', to: index + 1 })}
                disabled={index >= totalPages - 1}
                title="Mover la selección a la hoja siguiente"
                aria-label="Mover la selección a la hoja siguiente"
              >
                <Icon name="arrowDown" size={14} />
              </button>
              <button className="icon-btn xs danger" onClick={() => onSelAction({ type: 'delete' })} title="Borrar (Supr)" aria-label="Borrar selección">
                <Icon name="trash" size={14} />
              </button>
            </div>
          )}
        </div>
      )}
      {tool === 'eraser' &&
        images.map((im) => (
          <button
            key={im.id}
            className="ink-img-del"
            style={{ left: `${((im.x + im.w) / PAGE_W) * 100}%`, top: `${(im.y / pageH) * 100}%` }}
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
