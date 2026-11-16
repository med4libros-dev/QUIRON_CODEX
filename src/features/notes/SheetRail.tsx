import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { renderInkPage } from '../../lib/ink';
import type { InkImage } from '../../lib/inkImages';
import type { Stroke } from '../../types';

interface Props {
  pages: number;
  pageH: number;
  strokes: Stroke[];
  images: InkImage[];
  /** Hoja visible ahora mismo en el lienzo (0 = la primera). */
  current: number;
  onGo: (i: number) => void;
  onClose: () => void;
}

const THUMB = 108;

/**
 * Columna de miniaturas al lado del lienzo. Con hojas continuas un cuaderno crece rápido y
 * el organizador en ventana se queda corto: esto deja ver dónde estás sin salir de la hoja.
 *
 * Las miniaturas se dibujan de los trazos que ya tienes; no se guarda ninguna imagen.
 */
export function SheetRail({ pages, pageH, strokes, images, current, onGo, onClose }: Props) {
  const [thumbs, setThumbs] = useState<(string | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    // Una miniatura por hoja, en serie: dibujar diez a la vez traba el lápiz.
    void (async () => {
      const out: (string | null)[] = [];
      for (let i = 0; i < pages; i++) {
        const mine = strokes.filter((s) => s.page === i);
        const pics = images.filter((im) => im.page === i);
        out.push(mine.length || pics.length ? await renderInkPage(mine, THUMB * 2, pics, pageH) : null);
        if (!alive) return;
        setThumbs([...out]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pages, strokes, images, pageH]);

  useEffect(() => {
    box.current?.querySelector('[data-cur="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  return (
    <aside className="sheet-rail" ref={box} aria-label="Hojas de la nota">
      <div className="sheet-rail-head">
        <span className="small muted">{pages} hojas</span>
        <button className="icon-btn xs" onClick={onClose} title="Ocultar las miniaturas" aria-label="Ocultar las miniaturas">
          <Icon name="x" size={14} />
        </button>
      </div>
      <ol>
        {Array.from({ length: pages }, (_, i) => (
          <li key={i}>
            <button
              className={`sheet-thumb${i === current ? ' cur' : ''}`}
              data-cur={i === current ? '1' : undefined}
              onClick={() => onGo(i)}
              aria-current={i === current ? 'true' : undefined}
              aria-label={`Ir a la hoja ${i + 1}`}
              style={{ aspectRatio: `1000 / ${pageH}` }}
            >
              {thumbs[i] ? <img src={thumbs[i] as string} alt="" draggable={false} /> : <span className="sheet-thumb-empty" />}
              <span className="sheet-thumb-n">{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
