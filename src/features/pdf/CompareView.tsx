import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon';
import { useLibrary } from '../../store/library';
import { useUI } from '../../store/ui';
import { PdfViewer } from './PdfViewer';

/**
 * Comparador de dos guías lado a lado (p. ej. GPC 2014 vs 2022, IMSS vs ISSSTE, GRR vs GER).
 * El scroll se sincroniza por proporción; se puede desactivar para alinear a mano.
 */
export function CompareView() {
  const cmp = useUI((s) => s.compare);
  const docs = useLibrary((s) => s.docs);
  const [sync, setSync] = useState(true);
  const [zoom, setZoom] = useState(1);
  const wrap = useRef<HTMLDivElement>(null);
  const close = () => useUI.getState().setCompare(null);

  useEffect(() => {
    if (!cmp || !sync) return;
    const root = wrap.current;
    if (!root) return;
    let lock = false;
    let els: HTMLElement[] = [];
    const onScroll = (e: Event) => {
      if (lock) return;
      const src = e.currentTarget as HTMLElement;
      const other = els.find((x) => x !== src);
      if (!other) return;
      const r = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
      lock = true;
      other.scrollTop = r * (other.scrollHeight - other.clientHeight);
      requestAnimationFrame(() => (lock = false));
    };
    // Los visores montan su contenedor de scroll de forma asíncrona.
    const attach = () => {
      const found = Array.from(root.querySelectorAll<HTMLElement>('.pdf-scroll'));
      if (found.length === els.length) return;
      els.forEach((x) => x.removeEventListener('scroll', onScroll));
      els = found;
      els.forEach((x) => x.addEventListener('scroll', onScroll, { passive: true }));
    };
    attach();
    const t = setInterval(attach, 500);
    return () => {
      clearInterval(t);
      els.forEach((x) => x.removeEventListener('scroll', onScroll));
    };
  }, [cmp, sync]);

  useEffect(() => {
    if (!cmp) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmp]);

  if (!cmp) return null;
  const set = (k: 'a' | 'b', id: string) => useUI.setState({ compare: { ...cmp, [k]: id } });
  const pane = (k: 'a' | 'b') => {
    const id = cmp[k];
    const other = cmp[k === 'a' ? 'b' : 'a'];
    return (
      <div className="cmp-pane">
        <select className="select" value={id} onChange={(e) => set(k, e.target.value)} aria-label={k === 'a' ? 'Guía izquierda' : 'Guía derecha'}>
          {docs.map((d) => (
            <option key={d.id} value={d.id} disabled={d.id === other}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="cmp-viewer">{docs.some((d) => d.id === id) ? <PdfViewer key={id} docId={id} tool="select" zoom={zoom} onPageChange={() => undefined} onZoom={setZoom} persistPage={false} spread={false} /> : <p className="muted">Documento no disponible.</p>}</div>
      </div>
    );
  };
  return createPortal(
    <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="Comparar guías">
      <header className="cmp-head">
        <Icon name="columns" />
        <h3>Comparar guías</h3>
        <label className="check small">
          <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} /> Scroll sincronizado
        </label>
        <div className="group">
          <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="Alejar">
            <Icon name="zoomOut" />
          </button>
          <span className="small tabular">{Math.round(zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))} title="Acercar">
            <Icon name="zoomIn" />
          </button>
        </div>
        <span className="spacer" />
        <button className="icon-btn" onClick={close} aria-label="Cerrar comparador">
          <Icon name="x" />
        </button>
      </header>
      <div className="cmp-body" ref={wrap}>
        {pane('a')}
        {pane('b')}
      </div>
    </div>,
    document.body,
  );
}
