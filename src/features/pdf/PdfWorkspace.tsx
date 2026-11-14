import { useEffect, useRef, useState } from 'react';
import { FilePick } from '../../components/FilePick';
import { Icon, type IconName } from '../../components/Icon';
import { PenControls } from '../../components/PenControls';
import { useLibrary } from '../../store/library';
import { useUI } from '../../store/ui';
import { exportAnnotatedPdf } from '../../lib/exportAnnotated';
import { useSettings } from '../../store/settings';
import { STICKY_COLORS, useTools } from '../../store/tools';
import { HIGHLIGHT_META, HIGHLIGHT_ORDER, type DocMeta } from '../../types';
import { BookmarksMenu } from './BookmarksMenu';
import { FileManager } from './FileManager';
import { PdfViewer, type PdfTool } from './PdfViewer';

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const TOOLS: { id: PdfTool; icon: IconName; label: string; key: string }[] = [
  { id: 'select', icon: 'cursor', label: 'Navegar', key: 'v' },
  { id: 'highlight', icon: 'square', label: 'Resaltar área', key: 'h' },
  { id: 'underline', icon: 'underline', label: 'Subrayar', key: 'u' },
  { id: 'draw', icon: 'pen', label: 'Escribir / dibujar', key: 'd' },
  { id: 'sticky', icon: 'sticky', label: 'Post-it', key: 'n' },
  { id: 'crop', icon: 'crop', label: 'Recortar (algoritmo, tabla o figura)', key: 'r' },
  { id: 'erase', icon: 'eraser', label: 'Borrar anotaciones', key: 'e' },
];

export function PdfWorkspace() {
  const activeDocId = useSettings((s) => s.activeDocId);
  const setActiveDoc = useSettings((s) => s.setActiveDoc);
  const libraryOpen = useSettings((s) => s.libraryOpen);
  const setLibraryOpen = useSettings((s) => s.setLibraryOpen);
  const docs = useLibrary((s) => s.docs);
  const addFiles = useLibrary((s) => s.addFiles);
  const goTo = useLibrary((s) => s.goTo);
  const undoLast = useLibrary((s) => s.undoLast);
  const canUndo = useLibrary((s) => s.history.some((h) => h.docId === activeDocId));
  const hydrated = useLibrary.useHydrated();
  const toggleBookmark = useLibrary((s) => s.toggleBookmark);
  const bookmarkCount = useLibrary((s) => (activeDocId ? s.bookmarks[activeDocId]?.length ?? 0 : 0));
  const doc = docs.find((d) => d.id === activeDocId) ?? null;

  const hlColor = useTools((s) => s.hlColor);
  const setHlColor = useTools((s) => s.setHlColor);
  const underlineWidth = useTools((s) => s.underlineWidth);
  const setUnderlineWidth = useTools((s) => s.setUnderlineWidth);
  const pdfTool = useTools((s) => s.pdfTool);
  const setPdfTool = useTools((s) => s.setPdfTool);
  const stickyColor = useTools((s) => s.stickyColor);
  const setStickyColor = useTools((s) => s.setStickyColor);
  const penOnly = useTools((s) => s.penOnly);
  const setPenOnly = useTools((s) => s.setPenOnly);

  const [tool, setTool] = useState<PdfTool>('select');
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [pageDraft, setPageDraft] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bmOpen, setBmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pageMarked = useLibrary((s) => (activeDocId ? (s.bookmarks[activeDocId] ?? []).some((b) => b.page === page) : false));

  const currentPage = useRef(1);
  currentPage.current = page;
  const readCount = useLibrary((s) => (activeDocId ? s.read[activeDocId]?.length ?? 0 : 0));
  const hlCount = useLibrary((s) => (activeDocId ? s.highlights[activeDocId]?.length ?? 0 : 0));

  // Seguimiento de lectura: una página cuenta como leída tras 8 s en ella.
  useEffect(() => {
    if (!doc) return;
    const id = doc.id;
    const p = page;
    const t = setTimeout(() => useLibrary.getState().markRead(id, p), 8000);
    return () => clearTimeout(t);
  }, [doc?.id, page]);

  useEffect(() => {
    setPage(doc?.lastPage ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  // Atajos: V H U D N E · Esc = navegar · Ctrl+Z = deshacer anotación.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (useSettings.getState().view !== 'study') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const id = useSettings.getState().activeDocId;
        if (id && t.closest('.pdf-workspace, body') && !t.closest('.notes-panel')) {
          e.preventDefault();
          useLibrary.getState().undoLast(id);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') return setTool('select');
      if (e.key.toLowerCase() === 'b') {
        const id = useSettings.getState().activeDocId;
        if (id) useLibrary.getState().toggleBookmark(id, currentPage.current);
        return;
      }
      const hit = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (hit) setTool(hit.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      const id = await addFiles(files);
      if (id) {
        setActiveDoc(id);
        setLibraryOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const zoomStep = (dir: 1 | -1) =>
    setZoom((z) => {
      const i = ZOOMS.findIndex((v) => v >= z - 0.001);
      const idx = (i === -1 ? ZOOMS.length - 1 : i) + dir;
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, idx))];
    });

  const commitPage = () => {
    if (pageDraft !== null && doc) {
      const n = parseInt(pageDraft, 10);
      if (n >= 1 && n <= (doc.pageCount || n)) goTo(doc.id, n);
    }
    setPageDraft(null);
  };

  const categorySwatches = (
    <div className="swatches labeled">
      {HIGHLIGHT_ORDER.map((c) => (
        <button
          key={c}
          className={`swatch${hlColor === c ? ' active' : ''}`}
          style={{ background: HIGHLIGHT_META[c].solid }}
          title={HIGHLIGHT_META[c].label}
          aria-label={HIGHLIGHT_META[c].label}
          onClick={() => setHlColor(c)}
        />
      ))}
      <span className="small muted">{HIGHLIGHT_META[hlColor].label}</span>
    </div>
  );

  return (
    <div
      className="pdf-workspace"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        void upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="toolbar">
        <button className={`icon-btn${libraryOpen ? ' active' : ''}`} onClick={() => setLibraryOpen(!libraryOpen)} title="Biblioteca de PDFs">
          <Icon name="folder" />
        </button>
        {doc && (
          <>
            <div className="tb-sep" />
            <div className="seg" role="radiogroup" aria-label="Herramienta del PDF">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  className={tool === t.id ? 'active' : ''}
                  onClick={() => setTool(t.id)}
                  title={`${t.label} (${t.key.toUpperCase()})`}
                  aria-label={t.label}
                >
                  <Icon name={t.icon} size={17} />
                </button>
              ))}
            </div>
            <button className="icon-btn" onClick={() => doc && undoLast(doc.id)} disabled={!canUndo} title="Deshacer anotación (Ctrl+Z)">
              <Icon name="undo" />
            </button>
            <div className="tb-sep" />
            <div className="group">
              <button
                className={`icon-btn${pageMarked ? ' active' : ''}`}
                onClick={() => toggleBookmark(doc.id, page)}
                title={pageMarked ? `Quitar marcador de la p. ${page} (B)` : `Marcar la p. ${page} (B)`}
                aria-pressed={pageMarked}
              >
                <Icon name="bookmark" filled={pageMarked} />
              </button>
              <button className={`btn ghost sm${bmOpen ? ' active' : ''}`} data-bm-toggle onClick={() => setBmOpen((v) => !v)} title="Ver marcadores">
                <Icon name="listBullet" size={16} />
                {bookmarkCount > 0 && <span className="count-badge">{bookmarkCount}</span>}
              </button>
              {bmOpen && <BookmarksMenu docId={doc.id} docName={doc.name} currentPage={page} onClose={() => setBmOpen(false)} />}
            </div>
            <div className="spacer" />
            <div className="group">
              <button className="icon-btn" onClick={() => zoomStep(-1)} title="Alejar">
                <Icon name="zoomOut" />
              </button>
              <button className="btn ghost tabular zoom-label" onClick={() => setZoom(1)} title="Ajustar al ancho">
                {Math.round(zoom * 100)}%
              </button>
              <button className="icon-btn" onClick={() => zoomStep(1)} title="Acercar">
                <Icon name="zoomIn" />
              </button>
            </div>
            <div className="group">
              <input
                className="input page-input tabular"
                value={pageDraft ?? String(page)}
                onChange={(e) => setPageDraft(e.target.value.replace(/\D/g, ''))}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitPage}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                aria-label="Ir a página"
              />
              <span className="muted small tabular">/ {doc.pageCount || '…'}</span>
            </div>
            {doc.pageCount > 0 && (
              <span className="read-chip small tabular" title={`${readCount} de ${doc.pageCount} páginas leídas (una página cuenta tras 8 s en ella)`}>
                <Icon name="eye" size={14} /> {Math.min(100, Math.round((readCount / doc.pageCount) * 100))}%
              </span>
            )}
            <div className="group more-wrap">
              <button className={`icon-btn${moreOpen ? ' active' : ''}`} data-more-toggle onClick={() => setMoreOpen((v) => !v)} title="Más: preguntas, huecos, exportar anotado" aria-haspopup="menu" aria-expanded={moreOpen} aria-label="Más acciones del PDF">
                <Icon name="more" />
              </button>
              {moreOpen && <MoreMenu docId={doc.id} hlCount={hlCount} onClose={() => setMoreOpen(false)} />}
            </div>
          </>
        )}
      </div>

      {doc && tool !== 'select' && (
        <div className="subbar">
          {tool === 'highlight' && categorySwatches}
          {tool === 'underline' && (
            <>
              {categorySwatches}
              <label className="size-control" title={`Grosor del subrayado: ${underlineWidth}`}>
                <span className="small muted">Grosor</span>
                <input type="range" min={1} max={8} value={underlineWidth} onChange={(e) => setUnderlineWidth(Number(e.target.value))} aria-label="Grosor del subrayado" />
                <span className="small muted tabular size-num">{underlineWidth}</span>
              </label>
            </>
          )}
          {tool === 'draw' && <PenControls tool={pdfTool} onTool={setPdfTool} />}
          {tool === 'sticky' && (
            <>
              <div className="swatches">
                {STICKY_COLORS.map((c) => (
                  <button key={c} className={`swatch${stickyColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setStickyColor(c)} aria-label={`Color ${c}`} />
                ))}
              </div>
              <span className="small muted">Toca la página donde quieras pegar el post-it.</span>
            </>
          )}
          {tool === 'crop' && (
            <span className="small muted">
              Encierra con el lápiz un algoritmo, tabla o figura: podrás enviarlo a tus apuntes, a una flashcard o al lienzo para rayar encima.
            </span>
          )}
          {tool === 'erase' && <span className="small muted">Arrastra sobre trazos o toca un resaltado para borrarlo. El botón borrador del lápiz funciona en cualquier herramienta.</span>}
          <div className="spacer" />
          <button
            className={`btn ghost sm${penOnly ? ' active' : ''}`}
            onClick={() => setPenOnly(!penOnly)}
            aria-pressed={penOnly}
            title="Solo lápiz: la mano y la palma no anotan; el dedo desplaza la página"
          >
            <Icon name="hand" size={15} /> Solo lápiz
          </button>
        </div>
      )}

      <div className="pdf-body">
        {doc ? (
          <PdfViewer key={doc.id} docId={doc.id} tool={tool} zoom={zoom} onPageChange={setPage} />
        ) : hydrated ? (
          <EmptyLibrary docs={docs} busy={busy} onUpload={(f) => void upload(f)} onOpen={setActiveDoc} />
        ) : null}
        {libraryOpen && <FileManager onUpload={(f) => void upload(f)} onClose={() => setLibraryOpen(false)} />}
        {dragOver && (
          <div className="drop-overlay">
            <Icon name="upload" size={28} />
            Suelta tus PDFs para agregarlos
          </div>
        )}
      </div>
    </div>
  );
}

/** Menú «Más» del PDF: lo que se hace con tus subrayados y anotaciones. */
function MoreMenu({ docId, hlCount, onClose }: { docId: string; hlCount: number; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!box.current?.contains(t) && !t.closest('[data-more-toggle]')) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item = (icon: IconName, title: string, sub: string, fn: () => void, disabled = false, hint = '') => (
    <button role="menuitem" onClick={fn} disabled={disabled} title={hint || title}>
      <Icon name={icon} size={17} />
      <span>
        {title} <small>{sub}</small>
      </span>
    </button>
  );
  return (
    <div className="popover more-menu" ref={box} role="menu">
      {item('question', 'Preguntas con IA', 'Desde tus subrayados', () => (onClose(), useUI.getState().setHlQuiz(docId)), !hlCount, hlCount ? '' : 'Subraya o resalta texto primero')}
      {item('square', 'Flashcards de huecos', 'Escondes la palabra clave', () => (onClose(), useUI.getState().setCloze({ docId })), !hlCount, hlCount ? '' : 'Subraya o resalta texto primero')}
      {item('download', busy ? 'Generando…' : 'Exportar PDF anotado', 'Resaltados, tinta, post-its y marcadores', () => {
        setBusy(true);
        exportAnnotatedPdf(docId)
          .then((st) => useUI.getState().showToast(`PDF anotado listo: ${st.highlights} resaltado${st.highlights === 1 ? '' : 's'}, ${st.strokes} trazo${st.strokes === 1 ? '' : 's'}, ${st.stickies} post-it${st.stickies === 1 ? '' : 's'}`))
          .catch((e) => alert(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`))
          .finally(() => {
            setBusy(false);
            onClose();
          });
      }, busy)}
    </div>
  );
}

function EmptyLibrary({
  docs,
  busy,
  onUpload,
  onOpen,
}: {
  docs: DocMeta[];
  busy: boolean;
  onUpload: (files: File[]) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon name="book" size={26} />
      </div>
      <h3>{docs.length ? 'Elige un documento' : 'Tu biblioteca está vacía'}</h3>
      <p className="muted">
        {docs.length
          ? 'Continúa donde te quedaste o sube un PDF nuevo.'
          : 'Sube guías, artículos o libros en PDF, o arrástralos aquí. Se guardan solo en este navegador.'}
      </p>
      <FilePick onFiles={onUpload} disabled={busy}>
        <Icon name="upload" /> {busy ? 'Subiendo…' : 'Subir PDF'}
      </FilePick>
      {docs.length > 0 && (
        <ul className="recent-list">
          {docs.slice(0, 6).map((d) => (
            <li key={d.id}>
              <button onClick={() => onOpen(d.id)}>
                <Icon name="book" size={16} />
                <span className="ellipsis">{d.name}</span>
                <span className="muted small">p. {d.lastPage}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
