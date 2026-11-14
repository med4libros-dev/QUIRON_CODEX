import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useNotes } from '../../store/notes';
import { usePlanner } from '../../store/planner';
import type { Notebook } from '../../types';

const COLORS = ['#0f766e', '#ef4444', '#f59e0b', '#22c55e', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

/** Crear o editar un cuaderno. Puede ser de una materia (hereda su color) o de un tema libre. */
export function NotebookDialog({
  notebook,
  onClose,
  onCreated,
}: {
  notebook?: Notebook;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const subjects = usePlanner((s) => s.subjects);
  const createNotebook = useNotes((s) => s.createNotebook);
  const updateNotebook = useNotes((s) => s.updateNotebook);
  const deleteNotebook = useNotes((s) => s.deleteNotebook);
  const count = useNotes((s) => (notebook ? s.notes.filter((n) => n.notebookId === notebook.id).length : 0));

  const [name, setName] = useState(notebook?.name ?? '');
  const [subjectId, setSubjectId] = useState(notebook?.subjectId ?? '');
  const [color, setColor] = useState(notebook?.color ?? COLORS[0]);

  const pickSubject = (id: string) => {
    setSubjectId(id);
    const subj = subjects.find((s) => s.id === id);
    if (subj) {
      setColor(subj.color);
      if (!name.trim()) setName(subj.name);
    }
  };

  const save = () => {
    const finalName = name.trim() || subjects.find((s) => s.id === subjectId)?.name || '';
    if (!finalName) return;
    const data = { name: finalName, subjectId: subjectId || null, color };
    if (notebook) updateNotebook(notebook.id, data);
    else onCreated?.(createNotebook(data));
    onClose();
  };

  return (
    <Modal
      title={notebook ? 'Editar cuaderno' : 'Nuevo cuaderno'}
      onClose={onClose}
      footer={
        <>
          {notebook && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (!confirm(`¿Eliminar el cuaderno «${notebook.name}»?${count ? `\nSus ${count} notas se conservan como «Sin cuaderno».` : ''}`)) return;
                deleteNotebook(notebook.id);
                onClose();
              }}
            >
              <Icon name="trash" size={16} /> Eliminar
            </button>
          )}
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={!name.trim() && !subjectId}>
            {notebook ? 'Guardar' : 'Crear cuaderno'}
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>Materia (opcional)</span>
          <select className="select" value={subjectId} onChange={(e) => pickSubject(e.target.value)}>
            <option value="">Sin materia · cuaderno por tema</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Nombre</span>
          <input
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Cardiología, Choque séptico, Casos clínicos ENARM"
          />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch${color === c ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
