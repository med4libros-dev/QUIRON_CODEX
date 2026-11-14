import { useRef, useState, type ReactNode } from 'react';
import { capturePointer } from '../../lib/pointer';
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

  /** ratio = fracción del ancho que ocupa el PDF, esté a la izquierda o a la derecha. */
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const fromLeft = (clientX - r.left) / r.width;
    setRatio(swapped ? 1 - fromLeft : fromLeft);
  };
  const nudge = (dir: -1 | 1) => setRatio(ratio + (swapped ? -dir : dir) * 0.02);

  const both = mode === 'both';
  return (
    <div className={`split${dragging ? ' dragging' : ''}${swapped ? ' swapped' : ''}`} ref={ref} data-mode={mode}>
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
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        hidden={!both}
        style={{ order: 2 }}
        title="Arrastra para ajustar · doble clic para restablecer"
        onPointerDown={(e) => {
          capturePointer(e.currentTarget, e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => dragging && move(e.clientX)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => setRatio(0.56)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') nudge(-1);
          if (e.key === 'ArrowRight') nudge(1);
        }}
      >
        <span />
      </div>
      <section
        className="split-pane"
        style={{ flexBasis: both ? `${(1 - ratio) * 100}%` : '100%', order: swapped ? 1 : 3 }}
        hidden={mode === 'pdf'}
        aria-label="Notas"
      >
        {notes}
      </section>
    </div>
  );
}
