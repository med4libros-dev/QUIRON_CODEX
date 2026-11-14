import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../../components/Icon';
import { capturePointer } from '../../lib/pointer';
import { useLibrary } from '../../store/library';
import { STICKY_COLORS } from '../../store/tools';
import type { Sticky } from '../../types';

/** Post-it sobre el PDF: se arrastra por la barra superior, se minimiza y cambia de color. */
export function StickyNote({ sticky, docId, autoFocus }: { sticky: Sticky; docId: string; autoFocus?: boolean }) {
  const update = useLibrary((s) => s.updateSticky);
  const remove = useLibrary((s) => s.removeSticky);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; page: DOMRect } | null>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (autoFocus && sticky.open) textRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  const startDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('.sticky-actions')) return;
    e.stopPropagation();
    const page = (e.currentTarget.closest('.pdf-page') as HTMLElement | null)?.getBoundingClientRect();
    if (!page) return;
    capturePointer(e.currentTarget, e.pointerId);
    drag.current = {
      id: e.pointerId,
      dx: e.clientX - (page.left + sticky.x * page.width),
      dy: e.clientY - (page.top + sticky.y * page.height),
      page,
    };
    moved.current = false;
  };
  const onDrag = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    moved.current = true;
    const x = Math.min(0.98, Math.max(0, (e.clientX - d.dx - d.page.left) / d.page.width));
    const y = Math.min(0.98, Math.max(0, (e.clientY - d.dy - d.page.top) / d.page.height));
    update(docId, sticky.id, { x, y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  const style = { left: `${sticky.x * 100}%`, top: `${sticky.y * 100}%`, '--sticky': sticky.color } as CSSProperties;

  if (!sticky.open) {
    return (
      <button
        className="sticky-pin"
        style={style}
        title={sticky.text || 'Post-it vacío'}
        onPointerDown={startDrag}
        onPointerMove={onDrag}
        onPointerUp={(e) => {
          endDrag();
          if (!moved.current) update(docId, sticky.id, { open: true });
          e.stopPropagation();
        }}
        aria-label="Abrir post-it"
      >
        <Icon name="sticky" size={15} />
      </button>
    );
  }

  return (
    <div className={`sticky${sticky.x > 0.7 ? ' flip' : ''}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <div className="sticky-bar" onPointerDown={startDrag} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} title="Arrastra para mover">
        <span className="sticky-grip" />
        <div className="sticky-actions">
          {STICKY_COLORS.map((c) => (
            <button
              key={c}
              className={`sticky-color${c === sticky.color ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => update(docId, sticky.id, { color: c })}
              aria-label={`Color ${c}`}
            />
          ))}
          <button className="sticky-btn" onClick={() => update(docId, sticky.id, { open: false })} title="Minimizar">
            <Icon name="minus" size={14} />
          </button>
          <button
            className="sticky-btn"
            onClick={() => {
              if (!sticky.text.trim() || confirm('¿Eliminar este post-it?')) remove(docId, sticky.id);
            }}
            title="Eliminar"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
      <textarea
        ref={textRef}
        className="sticky-text"
        value={sticky.text}
        placeholder="Escribe una nota…"
        onChange={(e) => update(docId, sticky.id, { text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.blur();
            update(docId, sticky.id, { open: false });
          }
        }}
      />
    </div>
  );
}
