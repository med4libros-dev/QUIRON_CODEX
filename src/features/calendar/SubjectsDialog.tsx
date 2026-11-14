import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { usePlanner } from '../../store/planner';

const PRESETS = ['#ef4444', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

export function SubjectsDialog({ onClose }: { onClose: () => void }) {
  const subjects = usePlanner((s) => s.subjects);
  const addSubject = usePlanner((s) => s.addSubject);
  const removeSubject = usePlanner((s) => s.removeSubject);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESETS[0]);

  const add = () => {
    if (!name.trim()) return;
    addSubject(name.trim(), color);
    setName('');
  };

  return (
    <Modal title="Materias" onClose={onClose}>
      <ul className="subject-list">
        {subjects.map((s) => (
          <li key={s.id}>
            <span className="subject-dot" style={{ background: s.color }} />
            <span className="grow">{s.name}</span>
            <button
              className="icon-btn danger"
              title="Eliminar materia"
              onClick={() => {
                if (confirm(`¿Eliminar «${s.name}»? Sus sesiones quedan sin materia.`)) removeSubject(s.id);
              }}
            >
              <Icon name="trash" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva materia" />
        <div className="swatches">
          {PRESETS.map((c) => (
            <button type="button" key={c} className={`swatch${color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Color ${c}`} />
          ))}
        </div>
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          <Icon name="plus" size={16} /> Agregar
        </button>
      </form>
    </Modal>
  );
}
