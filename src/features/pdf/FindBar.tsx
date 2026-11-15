import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { foldText } from '../../lib/findInPage';
import { pagesOf } from '../../lib/pageIndex';

interface Props {
  docId: string;
  /** Texto que el visor debe marcar sobre las páginas. */
  onFind: (q: string) => void;
  onGo: (page: number) => void;
  onClose: () => void;
}

/** Una coincidencia: en qué página y cuál es dentro de esa página. */
interface Match {
  page: number;
}

/**
 * Buscar dentro de la guía abierta (Ctrl+F). Usa el mismo índice de texto que Ctrl+K, así que
 * la primera búsqueda en un PDF nuevo tarda un momento y las demás son inmediatas.
 */
export function FindBar({ docId, onFind, onGo, onClose }: Props) {
  const [q, setQ] = useState('');
  const [pages, setPages] = useState<string[] | null>(null);
  const [reading, setReading] = useState(false);
  const [at, setAt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setPages(null);
    setReading(true);
    pagesOf(docId)
      .then((p) => alive && setPages(p))
      .catch(() => alive && setPages([]))
      .finally(() => alive && setReading(false));
    return () => {
      alive = false;
    };
  }, [docId]);

  const matches = useMemo<Match[]>(() => {
    const needle = foldText(q.trim());
    if (!pages || needle.length < 2) return [];
    const out: Match[] = [];
    for (let i = 0; i < pages.length && out.length < 500; i++) {
      const hay = foldText(pages[i]);
      let from = 0;
      for (;;) {
        const k = hay.indexOf(needle, from);
        if (k < 0) break;
        out.push({ page: i + 1 });
        from = k + needle.length;
        if (out.length >= 500) break;
      }
    }
    return out;
  }, [pages, q]);

  // El visor marca el texto; al cambiar la búsqueda se salta a la primera coincidencia.
  useEffect(() => {
    onFind(q.trim().length >= 2 ? q.trim() : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const jump = (i: number) => {
    if (!matches.length) return;
    const k = (i + matches.length) % matches.length;
    setAt(k);
    onGo(matches[k].page);
  };

  useEffect(() => {
    if (matches.length) jump(0);
    else setAt(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.length]);

  const close = () => {
    onFind('');
    onClose();
  };

  return (
    // Esc cierra desde cualquier parte de la barra (no solo desde el cuadro de texto).
    <div className="subbar find-bar" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        autoFocus
        className="input find-input"
        value={q}
        placeholder="Buscar en esta guía…"
        aria-label="Buscar en esta guía"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            jump(at + (e.shiftKey ? -1 : 1));
          }
        }}
      />
      <span className="small muted tabular find-count">
        {reading
          ? 'Leyendo el documento…'
          : q.trim().length < 2
            ? 'Escribe al menos 2 letras'
            : matches.length
              ? `${at + 1} de ${matches.length} · p. ${matches[at]?.page ?? ''}`
              : 'Sin coincidencias'}
      </span>
      <button className="icon-btn" onClick={() => jump(at - 1)} disabled={!matches.length} title="Anterior (Shift+Enter)" aria-label="Coincidencia anterior">
        <Icon name="arrowUp" size={16} />
      </button>
      <button className="icon-btn" onClick={() => jump(at + 1)} disabled={!matches.length} title="Siguiente (Enter)" aria-label="Siguiente coincidencia">
        <Icon name="arrowDown" size={16} />
      </button>
      <div className="spacer" />
      <button className="btn ghost sm" onClick={close} title="Cerrar la búsqueda (Esc)">
        Cerrar
      </button>
    </div>
  );
}
