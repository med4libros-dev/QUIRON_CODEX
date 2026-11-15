import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { idb } from '../../lib/idb';
import { imgKey } from '../../lib/inkImages';
import { useBridge } from '../../store/bridge';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import { daysLeft, useTrash, TRASH_DAYS, type TrashItem } from '../../store/trash';
import { useUI } from '../../store/ui';
import type { InkImageLike, Stroke } from '../../types';

const KIND_LABEL = { note: 'Nota', doc: 'Guía (PDF)', sheet: 'Hoja del lienzo' } as const;

const when = (at: number) =>
  new Date(at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Papelera: lo que borraste en los últimos 30 días, con todo lo necesario para devolverlo. */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const items = useTrash((s) => s.items);
  const drop = useTrash((s) => s.drop);
  const empty = useTrash((s) => s.empty);
  const showToast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState<string | null>(null);

  const restore = async (it: TrashItem) => {
    setBusy(it.id);
    try {
      const p = it.payload;
      if (p.kind === 'note') {
        if (p.strokes.length) await idb.set('ink', p.note.id, p.strokes);
        if (p.images.length) await idb.set('ink', imgKey(p.note.id), p.images);
        useNotes.setState((s) => ({ notes: s.notes.some((n) => n.id === p.note.id) ? s.notes : [...s.notes, p.note] }));
        useSettings.getState().setActiveNote(p.note.id);
        showToast(`«${p.note.title}» está de vuelta.`);
      } else if (p.kind === 'doc') {
        useLibrary.getState().restoreDoc(p);
        showToast(`«${p.doc.name}» está de vuelta en tu biblioteca.`);
      } else {
        const note = useNotes.getState().notes.find((n) => n.id === p.noteId);
        if (!note) {
          showToast('Esa nota ya no existe: restaura primero la nota.');
          return;
        }
        const [cur, imgs] = await Promise.all([
          idb.get<Stroke[]>('ink', p.noteId).then((x) => x ?? []),
          idb.get<InkImageLike[]>('ink', imgKey(p.noteId)).then((x) => x ?? []),
        ]);
        // Las hojas que ahora ocupan su lugar (y las de después) se corren una posición.
        const shift = (page: number) => (page >= p.page ? page + 1 : page);
        await idb.set('ink', p.noteId, [...cur.map((s) => ({ ...s, page: shift(s.page) })), ...p.strokes]);
        await idb.set('ink', imgKey(p.noteId), [...imgs.map((i) => ({ ...i, page: shift(i.page) })), ...p.images]);
        useNotes.getState().updateNote(p.noteId, { inkPages: Math.max(note.inkPages + 1, p.page + 1) });
        useBridge.getState().bumpInk(p.noteId);
        showToast(`Hoja ${p.page + 1} devuelta a «${p.noteTitle}».`);
      }
      drop(it.id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Papelera" onClose={onClose} width={560}>
      <p className="muted small">
        Lo que borras se queda aquí {TRASH_DAYS} días antes de irse de verdad. Las guías conservan su archivo y sus resaltados; las
        notas, su escritura a mano.
      </p>
      {!items.length ? (
        <p className="muted small">La papelera está vacía.</p>
      ) : (
        <ul className="trash-list">
          {items.map((it) => (
            <li key={it.id}>
              <span className="trash-kind small muted">{KIND_LABEL[it.payload.kind]}</span>
              <span className="trash-label ellipsis" title={it.label}>
                {it.payload.kind === 'sheet' ? `${it.payload.noteTitle} · hoja ${it.payload.page + 1}` : it.label}
              </span>
              <span className="muted small trash-when">
                {when(it.at)} · {daysLeft(it)} d
              </span>
              <button className="btn ghost sm" disabled={busy === it.id} onClick={() => void restore(it)} title="Devolver a su lugar">
                <Icon name="undo" size={14} /> Restaurar
              </button>
              <button
                className="icon-btn xs danger"
                title="Borrar definitivamente"
                aria-label={`Borrar definitivamente ${it.label}`}
                onClick={() => confirm(`¿Borrar «${it.label}» definitivamente? Esto ya no se puede deshacer.`) && drop(it.id)}
              >
                <Icon name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div className="row gap">
          <div className="spacer" />
          <button
            className="btn ghost sm danger"
            onClick={() => confirm(`¿Vaciar la papelera? Se borrarán ${items.length} elemento(s) para siempre.`) && void empty()}
          >
            <Icon name="trash" size={14} /> Vaciar papelera
          </button>
        </div>
      )}
    </Modal>
  );
}
