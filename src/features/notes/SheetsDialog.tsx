import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { renderInkPage } from '../../lib/ink';
import type { InkImage } from '../../lib/inkImages';
import type { Stroke } from '../../types';

interface Props {
  pages: number;
  /** Alto lógico de la hoja, para que las miniaturas no salgan deformadas. */
  pageH: number;
  strokes: Stroke[];
  images: InkImage[];
  /** Nuevo orden de las hojas: `order[i]` es la hoja que pasa a la posición i. */
  onReorder: (order: number[]) => void;
  /** Pasa el contenido de la hoja i a la anterior, debajo de lo que ya había. */
  onMerge: (i: number) => void;
  onClose: () => void;
}

const THUMB = 190;

/**
 * Organizar hojas: miniaturas que puedes arrastrar para reordenar y fusionar con la anterior.
 * Las miniaturas se dibujan de los trazos que ya tienes, no se guarda ninguna imagen.
 */
export function SheetsDialog({ pages, pageH, strokes, images, onReorder, onMerge, onClose }: Props) {
  const [order, setOrder] = useState<number[]>(() => Array.from({ length: pages }, (_, i) => i));
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const dirty = useRef(false);

  // Miniaturas: una por hoja, dibujadas una sola vez al abrir.
  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Record<number, string> = {};
      for (let p = 0; p < pages; p++) {
        const mine = strokes.filter((s) => s.page === p);
        const pics = images.filter((i) => i.page === p);
        out[p] = mine.length || pics.length ? await renderInkPage(mine, THUMB, pics, pageH) : '';
        if (!alive) return;
      }
      if (alive) setThumbs(out);
    })();
    return () => {
      alive = false;
    };
  }, [pages, strokes, images]);

  const count = (p: number) => strokes.filter((s) => s.page === p).length + images.filter((i) => i.page === p).length;

  const drop = (to: number) => {
    if (drag === null || drag === to) return setDrag(null);
    const next = [...order];
    const [moved] = next.splice(drag, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    dirty.current = true;
    setDrag(null);
    setOver(null);
  };

  const apply = () => {
    if (dirty.current) onReorder(order);
    onClose();
  };

  return (
    <Modal title="Organizar hojas" onClose={onClose} width={720}>
      <p className="muted small">
        Arrastra una hoja para cambiarla de lugar. «Fusionar» pasa su contenido a la hoja anterior, debajo de lo que ya tenía (si no
        cabe, queda encima y te aviso).
      </p>
      <ul className="sheet-grid">
        {order.map((p, i) => (
          <li
            key={p}
            className={`sheet-card${drag === i ? ' dragging' : ''}${over === i ? ' over' : ''}`}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((v) => (v === i ? null : v))}
            onDrop={() => drop(i)}
            onDragEnd={() => (setDrag(null), setOver(null))}
          >
            <div className="sheet-thumb">
              {thumbs[p] === undefined ? (
                <span className="muted small">…</span>
              ) : thumbs[p] ? (
                <img src={thumbs[p]} alt={`Hoja ${p + 1}`} draggable={false} />
              ) : (
                <span className="muted small">Hoja en blanco</span>
              )}
            </div>
            <div className="sheet-foot">
              <span className="small">
                Hoja {i + 1}
                {p !== i && <em className="muted"> (era {p + 1})</em>}
              </span>
              <span className="muted small tabular">{count(p) || '—'}</span>
              {i > 0 && (
                <button
                  className="icon-btn xs"
                  title={`Fusionar con la hoja ${i}`}
                  aria-label={`Fusionar la hoja ${i + 1} con la anterior`}
                  onClick={() => {
                    if (dirty.current) {
                      alert('Primero aplica el nuevo orden (botón «Listo») y vuelve a abrir para fusionar.');
                      return;
                    }
                    onMerge(p);
                    onClose();
                  }}
                >
                  <Icon name="merge" size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="row gap">
        <div className="spacer" />
        <button className="btn ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary" onClick={apply}>
          Listo
        </button>
      </div>
    </Modal>
  );
}
