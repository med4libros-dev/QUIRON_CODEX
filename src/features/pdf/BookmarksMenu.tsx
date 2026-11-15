import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { pdfRefHtml, useBridge } from '../../store/bridge';
import { useLibrary } from '../../store/library';
import { outlineOf, type OutlineItem } from '../../lib/pdf';
import { KEY_PAGE_LABEL, type Bookmark, type KeyPageKind } from '../../types';

const EMPTY: Bookmark[] = [];

/** Lista de marcadores del PDF: saltar, renombrar, borrar e insertar en la nota. */
export function BookmarksMenu({ docId, docName, currentPage, onClose }: { docId: string; docName: string; currentPage: number; onClose: () => void }) {
  const bookmarks = useLibrary((s) => s.bookmarks[docId]) ?? EMPTY;
  const goTo = useLibrary((s) => s.goTo);
  const rename = useLibrary((s) => s.renameBookmark);
  const remove = useLibrary((s) => s.removeBookmark);
  const toggle = useLibrary((s) => s.toggleBookmark);
  const setKind = useLibrary((s) => s.setBookmarkKind);
  const insert = useBridge((s) => s.insertIntoNote);
  const box = useRef<HTMLDivElement>(null);
  const marked = bookmarks.some((b) => b.page === currentPage);
  const [tab, setTab] = useState<'mine' | 'doc'>('mine');
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);

  // El índice que trae el propio PDF se lee la primera vez que lo pides.
  useEffect(() => {
    if (tab !== 'doc' || outline) return;
    let alive = true;
    outlineOf(docId)
      .then((o) => alive && setOutline(o))
      .catch(() => alive && setOutline([]));
    return () => {
      alive = false;
    };
  }, [tab, outline, docId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Element;
      if (!box.current?.contains(t) && !t.closest('[data-bm-toggle]')) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  return (
    <div className="popover bm-menu" ref={box} role="dialog" aria-label="Marcadores">
      <div className="bm-head">
        <div className="seg sm" role="tablist" aria-label="Marcadores o índice del archivo">
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>
            Mis marcadores
          </button>
          <button role="tab" aria-selected={tab === 'doc'} className={tab === 'doc' ? 'active' : ''} onClick={() => setTab('doc')}>
            Índice del archivo
          </button>
        </div>
        <div className="spacer" />
        {!marked && (
          <button className="btn ghost sm" onClick={() => toggle(docId, currentPage)}>
            <Icon name="plus" size={14} /> Marcar p. {currentPage}
          </button>
        )}
        {bookmarks.length > 0 && (
          <button
            className="btn ghost sm"
            title="Insertar todos en la nota abierta"
            onClick={() => insert(`<ul>${bookmarks.map((b) => `<li>${pdfRefHtml(docId, docName, b.page, b.label)}</li>`).join('')}</ul><p><br></p>`)}
          >
            <Icon name="insert" size={14} /> Todos a la nota
          </button>
        )}
      </div>
      {tab === 'doc' ? (
        outline === null ? (
          <p className="muted small bm-empty">Leyendo el índice del archivo…</p>
        ) : outline.length === 0 ? (
          <p className="muted small bm-empty">Este PDF no trae índice propio. Usa tus marcadores (tecla B).</p>
        ) : (
          <ul className="bm-list outline">
            {outline.map((o, i) => (
              <li key={i} style={{ paddingLeft: `${Math.min(o.depth, 4) * 12}px` }}>
                <button className="bm-outline" disabled={!o.page} onClick={() => o.page && goTo(docId, o.page)} title={o.page ? `Ir a la p. ${o.page}` : 'El PDF no indica la página'}>
                  <span className="ellipsis">{o.title}</span>
                  <span className="muted small tabular">{o.page ?? '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : bookmarks.length === 0 ? (
        <p className="muted small bm-empty">
          Aún no hay marcadores. Usa el botón <Icon name="bookmark" size={12} /> o la tecla <b>B</b> para marcar la página actual.
        </p>
      ) : (
        <ul className="bm-list">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <button className="bm-page" onClick={() => goTo(docId, b.page)} title="Ir a la página">
                p. {b.page}
              </button>
              <input
                className="bm-label"
                defaultValue={b.label}
                placeholder="Nombre del marcador…"
                onBlur={(e) => e.target.value !== b.label && rename(docId, b.id, e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                aria-label={`Nombre del marcador de la página ${b.page}`}
              />
              <select
                className={`bm-kind${b.kind ? ' on' : ''}`}
                value={b.kind ?? ''}
                onChange={(e) => setKind(docId, b.id, (e.target.value || undefined) as KeyPageKind | undefined)}
                aria-label={`Tipo de página clave de la p. ${b.page}`}
                title="Página clave: algoritmo, tabla, dosis o criterios"
              >
                <option value="">—</option>
                {(Object.keys(KEY_PAGE_LABEL) as KeyPageKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KEY_PAGE_LABEL[k]}
                  </option>
                ))}
              </select>
              <button className="icon-btn xs" onClick={() => insert(pdfRefHtml(docId, docName, b.page, b.label))} title="Insertar en la nota (enlace a esta página)">
                <Icon name="insert" size={15} />
              </button>
              <button className="icon-btn xs danger" onClick={() => remove(docId, b.id)} title="Quitar marcador">
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
