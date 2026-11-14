import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useLibrary } from '../../store/library';
import { usePlanner } from '../../store/planner';
import { useSettings } from '../../store/settings';
import type { StudySession } from '../../types';

export function SessionDialog({ date, session, onClose }: { date: string; session?: StudySession; onClose: () => void }) {
  const subjects = usePlanner((s) => s.subjects);
  const addSession = usePlanner((s) => s.addSession);
  const updateSession = usePlanner((s) => s.updateSession);
  const removeSession = usePlanner((s) => s.removeSession);
  const docs = useLibrary((s) => s.docs);
  const setActiveDoc = useSettings((s) => s.setActiveDoc);
  const setView = useSettings((s) => s.setView);

  const [topic, setTopic] = useState(session?.topic ?? '');
  const [subjectId, setSubjectId] = useState(session?.subjectId ?? subjects[0]?.id ?? '');
  const [day, setDay] = useState(session?.date ?? date);
  const [minutes, setMinutes] = useState(session?.minutes ?? 50);
  const [docId, setDocId] = useState(session?.docId ?? '');
  const [done, setDone] = useState(session?.done ?? false);

  const save = () => {
    if (!topic.trim() || !day) return;
    const data = { topic: topic.trim(), subjectId: subjectId || null, date: day, minutes: Math.max(5, minutes || 0), docId: docId || null, done };
    if (session) updateSession(session.id, data);
    else addSession(data);
    onClose();
  };

  return (
    <Modal
      title={session ? 'Editar sesión' : 'Nueva sesión de estudio'}
      onClose={onClose}
      footer={
        <>
          {session && (
            <button
              className="btn ghost danger"
              onClick={() => {
                removeSession(session.id);
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
          <button className="btn primary" onClick={save} disabled={!topic.trim()}>
            Guardar
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
          <span>Tema</span>
          <input className="input" autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="p. ej. Insuficiencia cardiaca: clasificación y manejo" />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>Materia</span>
            <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Sin materia</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fecha</span>
            <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="field">
            <span>Minutos</span>
            <input className="input" type="number" min={5} step={5} value={minutes} onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 0)} />
          </label>
        </div>
        <label className="field">
          <span>PDF vinculado (opcional)</span>
          <select className="select" value={docId} onChange={(e) => setDocId(e.target.value)}>
            <option value="">Ninguno</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Sesión completada
        </label>
        {session?.docId && docs.some((d) => d.id === session.docId) && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setActiveDoc(session.docId);
              setView('study');
              onClose();
            }}
          >
            <Icon name="external" size={16} /> Abrir el PDF en Estudio
          </button>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
