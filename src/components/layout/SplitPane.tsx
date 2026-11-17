import { useEffect, useRef, useState, type ReactNode } from 'react';
import { capturePointer } from '../../lib/pointer';
import { Icon } from '../Icon';
import { useSettings } from '../../store/settings';

/**
 * Pantalla dividida PDF | notas.
 * - Separador arrastrable (doble clic = proporción por defecto; flechas con teclado).
 * - Intercambiar lados y "solo uno" se hacen con CSS (orden y ocultar), sin desmontar:
 *   el PDF y la nota no se recargan al cambiar de modo.
 */
export function SplitPane({ pdf, notes }: { pdf: ReactNode; notes: ReactNode }) {
  const ratio = useSettings((s) => s.splitRatio);
  const setRatio = useSettings((s) => s.setSplitRatio);
  const swapped = useSettings((s) => s.swapPanes);
  const mode = useSettings((s) => s.paneMode);
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // Surface en vertical (modo tableta): PDF arriba y notas abajo.
  const vertical = usePortrait();

  /** ratio = fracción del ancho (o alto, en vertical) que ocupa el PDF. */
  const move = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const from = vertical ? (clientY - r.top) / r.height : (clientX - r.left) / r.width;
    setRatio(swapped ? 1 - from : from);
  };
  const nudge = (dir: -1 | 1) => setRatio(ratio + (swapped ? -dir : dir) * 0.02);

  const both = mode === 'both';
  const setMode = useSettings((s) => s.setPaneMode);
  // Colapsar: deja una sola mitad a pantalla completa. En el lienzo es la diferencia entre
  // escribir en media pantalla de tableta y escribir en toda.
  const collapse = (keep: 'pdf' | 'notes') => setMode(mode === keep ? 'both' : keep);
  const flecha = (keep: 'pdf' | 'notes') => {
    const hacia = (keep === 'notes') === !swapped;
    return vertical ? (hacia ? 'chevronUp' : 'chevronDown') : hacia ? 'chevronLeft' : 'chevronRight';
  };
  return (
    <div className={`split${dragging ? ' dragging' : ''}${swapped ? ' swapped' : ''}${vertical ? ' vertical' : ''}`} ref={ref} data-mode={mode}>
      <section
        className="split-pane"
        style={{ flexBasis: both ? `${ratio * 100}%` : '100%', order: swapped ? 3 : 1 }}
        hidden={mode === 'notes'}
        aria-label="Lector PDF"
      >
        {pdf}
      </section>
      <div
        className="split-divider"
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        hidden={!both}
        style={{ order: 2 }}
        title="Arrastra para ajustar · doble clic para restablecer"
        onPointerDown={(e) => {
          capturePointer(e.currentTarget, e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => dragging && move(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => setRatio(0.56)}
        onKeyDown={(e) => {
          if (e.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) nudge(-1);
          if (e.key === (vertical ? 'ArrowDown' : 'ArrowRight')) nudge(1);
        }}
      >
        <span />
        {/* Dos asas, una por panel: colapsan el de su lado y lo devuelven al tocarlas otra vez.
            Viven dentro del separador para que ninguna barra de los paneles las tape. */}
        <div className="split-grips">
          <button
            className="split-grip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => collapse('notes')}
            title="Solo las notas (el lienzo a pantalla completa)"
            aria-label="Colapsar el PDF"
          >
            <Icon name={flecha('notes')} size={14} />
          </button>
          <button
            className="split-grip"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => collapse('pdf')}
            title="Solo el PDF"
            aria-label="Colapsar las notas"
          >
            <Icon name={flecha('pdf')} size={14} />
          </button>
        </div>
      </div>
      <section
        className="split-pane"
        style={{ flexBasis: both ? `${(1 - ratio) * 100}%` : '100%', order: swapped ? 1 : 3 }}
        hidden={mode === 'pdf'}
        aria-label="Notas"
      >
        {notes}
      </section>
      {/* Con un panel colapsado, el único camino de vuelta: una pestaña en el borde. */}
      {!both && (
        <button className="split-back" onClick={() => setMode('both')} title="Volver a ver los dos" aria-label="Volver a ver los dos paneles" style={{ order: 4 }}>
          <Icon name={vertical ? 'chevronDown' : 'chevronLeft'} size={15} />
          <span>Ver los dos</span>
        </button>
      )}
    </div>
  );
}

const PORTRAIT = '(orientation: portrait) and (max-width: 1100px)';
function usePortrait() {
  const [v, setV] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(PORTRAIT).matches);
  useEffect(() => {
    const mq = matchMedia(PORTRAIT);
    const on = () => setV(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return v;
}
