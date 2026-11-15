import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { SPECIALTY, TOPICS } from '../internship/curriculum';
import { useUI } from '../store/ui';
import type { NRect } from '../types';
import { Occluded } from './Occluded';
import { useCards } from './store';

/**
 * Oclusión de imágenes: tapas las etiquetas de un esquema (un corte, un algoritmo, una tabla)
 * y la app crea una tarjeta por cada etiqueta tapada. Al repasar ves el esquema con todo cubierto
 * y tienes que decir qué va en la que marca «?».
 */
export function OcclusionModal() {
  const draft = useUI((s) => s.occlusion);
  const setDraft = useUI((s) => s.setOcclusion);
  const addCard = useCards((s) => s.addCard);
  const showToast = useUI((s) => s.showToast);
  const [boxes, setBoxes] = useState<NRect[]>([]);
  const [topicId, setTopicId] = useState(draft?.topicId ?? '');
  const [drag, setDrag] = useState<NRect | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  if (!draft) return null;

  const rel = (e: RPointerEvent) => {
    const r = areaRef.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  const onDown = (e: RPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const p = rel(e);
    start.current = p;
    setDrag({ x: p.x, y: p.y, w: 0, h: 0 });
    try {
      areaRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* el puntero ya no existe: se sigue con los eventos normales */
    }
  };
  const onMove = (e: RPointerEvent) => {
    if (!start.current) return;
    const p = rel(e);
    const s = start.current;
    setDrag({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  };
  const onUp = () => {
    start.current = null;
    if (drag && drag.w > 0.015 && drag.h > 0.012) setBoxes((b) => [...b, drag]);
    setDrag(null);
  };

  const create = () => {
    if (!boxes.length) return;
    boxes.forEach((_, i) =>
      addCard({
        front: boxes.length > 1 ? `¿Qué va en la etiqueta ${i + 1}?` : '¿Qué va en la etiqueta tapada?',
        back: '',
        topicId: topicId || null,
        image: draft.src,
        source: draft.source,
        occlusion: { boxes, target: i },
      }),
    );
    showToast(`${boxes.length} tarjeta${boxes.length === 1 ? '' : 's'} de oclusión lista${boxes.length === 1 ? '' : 's'} para repasar.`);
    setDraft(null);
  };

  return (
    <Modal title="Tapar etiquetas del esquema" onClose={() => setDraft(null)} width={720}>
      <p className="muted small">
        Arrastra sobre cada etiqueta o dato que quieras tapar. Se crea una tarjeta por cada una: al repasar verás el esquema con todo
        cubierto y tendrás que decir qué va en la que marca «?».
      </p>
      <div
        ref={areaRef}
        className="occ-edit"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <img src={draft.src} alt="Recorte para tapar" draggable={false} />
        {boxes.map((b, i) => (
          <div key={i} className="occ-box editing" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
            <span>{i + 1}</span>
            <button
              className="occ-del"
              title={`Quitar la etiqueta ${i + 1}`}
              aria-label={`Quitar la etiqueta ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setBoxes((list) => list.filter((_, k) => k !== i))}
            >
              <Icon name="x" size={11} />
            </button>
          </div>
        ))}
        {drag && <div className="occ-box drafting" style={{ left: `${drag.x * 100}%`, top: `${drag.y * 100}%`, width: `${drag.w * 100}%`, height: `${drag.h * 100}%` }} />}
      </div>

      {boxes.length > 0 && (
        <details className="occ-preview">
          <summary className="small">Ver cómo se verá la primera tarjeta</summary>
          <Occluded src={draft.src} boxes={boxes} target={0} />
        </details>
      )}

      <div className="row gap wrap occ-foot">
        <label className="small muted">
          Tema
          <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Tema de las tarjetas">
            <option value="">Sin tema</option>
            {Object.values(SPECIALTY).map((sp) => (
              <optgroup key={sp.id} label={sp.name}>
                {TOPICS.filter((t) => t.specialty === sp.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="spacer" />
        {boxes.length > 0 && (
          <button className="btn ghost" onClick={() => setBoxes([])}>
            Empezar de nuevo
          </button>
        )}
        <button className="btn primary" onClick={create} disabled={!boxes.length}>
          Crear {boxes.length || ''} tarjeta{boxes.length === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
