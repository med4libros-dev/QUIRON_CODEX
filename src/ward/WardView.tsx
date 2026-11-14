import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { TOPIC } from '../internship/curriculum';
import { privacyWarnings, useTopicStore } from '../internship/topicStore';
import { todayKey } from '../lib/date';
import { prefillSoap } from '../soap/SoapModal';
import { useUI } from '../store/ui';
import { TASK_KINDS, purgeExpiredShift, useWard, type TaskKind, type WardPatient } from './store';

const fmtLeft = (ms: number) => {
  if (ms <= 0) return 'terminado';
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return h ? `${h} h ${m} min` : `${m} min`;
};

/** Vista «Turno»: pacientes del día con pendientes, conectada con Nota SOAP, dosis y bitácora. */
export function WardView() {
  const patients = useWard((s) => s.patients);
  const endsAt = useWard((s) => s.endsAt);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  useEffect(() => {
    purgeExpiredShift();
    const t = setInterval(() => {
      setNow(Date.now());
      purgeExpiredShift();
    }, 30_000);
    return () => clearInterval(t);
  }, []);
  const pending = patients.reduce((a, p) => a + p.tasks.filter((t) => !t.done).length, 0);

  return (
    <div className="page ward-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Turno</h2>
          <p className="muted small">Pacientes y pendientes de hoy. Solo en este equipo, fuera de los respaldos, y se borra al terminar el turno. Sin nombres: usa cama, sexo y edad.</p>
        </div>
        <div className="spacer" />
        {endsAt ? (
          <div className="shift-chip">
            <span>
              Termina en <b>{fmtLeft(endsAt - now)}</b>
            </span>
            <button className="btn ghost sm" onClick={() => useWard.getState().extendShift(2)}>
              +2 h
            </button>
            <button className="btn sm" onClick={() => setEnding(true)}>
              Terminar turno
            </button>
          </div>
        ) : (
          <div className="shift-chip">
            {[8, 12, 24, 36].map((h) => (
              <button key={h} className="btn ghost sm" onClick={() => useWard.getState().startShift(h)}>
                Turno de {h} h
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="field-row tight">
        <button className="btn primary" onClick={() => useWard.getState().addPatient()}>
          <Icon name="plus" size={15} /> Agregar paciente
        </button>
        <span className="muted small">
          {patients.length} paciente{patients.length === 1 ? '' : 's'} · {pending} pendiente{pending === 1 ? '' : 's'}
        </span>
      </div>
      {patients.length ? (
        <div className="ward-grid">
          {patients.map((p) => (
            <PatientCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="ts-empty muted">Agrega a tus pacientes al empezar la guardia; al terminar puedes pasar los interesantes a tu bitácora de casos.</div>
      )}
      {ending && <EndShift onClose={() => setEnding(false)} />}
    </div>
  );
}

function PatientCard({ p }: { p: WardPatient }) {
  const update = useWard((s) => s.updatePatient);
  const remove = useWard((s) => s.removePatient);
  const addTask = useWard((s) => s.addTask);
  const toggleTask = useWard((s) => s.toggleTask);
  const removeTask = useWard((s) => s.removeTask);
  const [task, setTask] = useState('');
  const [kind, setKind] = useState<TaskKind>('lab');
  const u = (patch: Partial<WardPatient>) => update(p.id, patch);
  const warnings = privacyWarnings(`${p.dx} ${p.note}`).filter((w) => !/cama/i.test(w));
  const open = p.tasks.filter((t) => !t.done).length;
  return (
    <article className={`ward-card${open ? '' : ' clear'}`}>
      <div className="ward-head">
        <input className="input bed" value={p.bed} onChange={(e) => u({ bed: e.target.value })} placeholder="Cama" aria-label="Cama o alias" maxLength={12} />
        <select className="select" value={p.sex} onChange={(e) => u({ sex: e.target.value as WardPatient['sex'] })} aria-label="Sexo">
          <option value="">Sexo</option>
          <option value="masculino">M</option>
          <option value="femenino">F</option>
        </select>
        <input className="input num" value={p.age} onChange={(e) => u({ age: e.target.value })} placeholder="Edad" inputMode="numeric" aria-label="Edad" />
        <input className="input num" value={p.weight} onChange={(e) => u({ weight: e.target.value })} placeholder="kg" inputMode="decimal" aria-label="Peso en kg" />
        <span className="spacer" />
        <span className={`chip${open ? '' : ' ok'}`}>{open ? `${open} pend.` : 'al día'}</span>
        <button className="icon-btn xs" onClick={() => confirm('¿Quitar a este paciente de la lista?') && remove(p.id)} aria-label="Quitar paciente">
          <Icon name="x" size={14} />
        </button>
      </div>
      <TopicSelect value={p.topicId} onChange={(v) => u({ topicId: v })} className="select" />
      <input className="input" value={p.dx} onChange={(e) => u({ dx: e.target.value })} placeholder="Diagnóstico / motivo (texto libre)" aria-label="Diagnóstico" />
      <ul className="task-list">
        {p.tasks.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(p.id, t.id)} />
              <span className={`task-kind k-${t.kind}`}>{TASK_KINDS.find((k) => k.id === t.kind)?.label}</span>
              <span className="grow">{t.text}</span>
            </label>
            <button className="icon-btn xs" onClick={() => removeTask(p.id, t.id)} aria-label="Quitar pendiente">
              <Icon name="x" size={12} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="task-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!task.trim()) return;
          addTask(p.id, task.trim(), kind);
          setTask('');
        }}
      >
        <select className="select xs" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)} aria-label="Tipo de pendiente">
          {TASK_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input className="input sm grow" value={task} onChange={(e) => setTask(e.target.value)} placeholder="Pendiente (p. ej. «BH y QS de control»)" aria-label="Nuevo pendiente" />
        <button className="btn sm" type="submit" disabled={!task.trim()}>
          +
        </button>
      </form>
      <textarea className="input" rows={2} value={p.note} onChange={(e) => u({ note: e.target.value })} placeholder="Nota rápida (evolución, manejo)" aria-label="Nota rápida" />
      {warnings.length > 0 && (
        <p className="privacy-warn">
          <Icon name="shield" size={13} /> Parece haber {warnings.join(', ')}.
        </p>
      )}
      <div className="ward-actions">
        <button
          className="btn ghost sm"
          onClick={() => {
            prefillSoap({ topicId: p.topicId, values: { sexo: p.sex, edad: p.age, analisis: p.note, plan: p.tasks.filter((t) => !t.done).map((t) => `${t.text}`).join('; ') } });
            useUI.getState().setSoapOpen(true);
          }}
        >
          <Icon name="clipboard" size={14} /> Nota SOAP
        </button>
        <button className="btn ghost sm" onClick={() => useUI.getState().openDrugs(Number(p.weight.replace(',', '.')) || null)}>
          <Icon name="pill" size={14} /> Dosis
        </button>
        <button className="btn ghost sm" disabled={!p.topicId} onClick={() => toCases([p]) && useUI.getState().showToast('Caso guardado en tu bitácora')} title={p.topicId ? 'Guardar en la bitácora de casos (anónimo)' : 'Elige el tema para guardarlo en la bitácora'}>
          <Icon name="list" size={14} /> A bitácora
        </button>
      </div>
    </article>
  );
}

/** Pasa pacientes a la bitácora de casos (solo los datos anónimos). */
function toCases(ps: WardPatient[]): number {
  let n = 0;
  for (const p of ps) {
    if (!p.topicId) continue;
    useTopicStore.getState().addCase(p.topicId, {
      date: todayKey(),
      setting: 'Piso',
      patient: [p.sex === 'masculino' ? 'M' : p.sex === 'femenino' ? 'F' : '', p.age && `${p.age} a`].filter(Boolean).join(' ') || 'Paciente',
      finding: p.dx || TOPIC[p.topicId].title,
      management: p.note,
    });
    n++;
  }
  return n;
}

function EndShift({ onClose }: { onClose: () => void }) {
  const patients = useWard((s) => s.patients);
  const [keep, setKeep] = useState<string[]>(patients.filter((p) => p.topicId).map((p) => p.id));
  return (
    <Modal
      title="Terminar turno"
      onClose={onClose}
      width={560}
      footer={
        <>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={() => {
              const n = toCases(patients.filter((p) => keep.includes(p.id)));
              useWard.getState().endShift();
              useUI.getState().showToast(n ? `Turno cerrado: ${n} caso${n === 1 ? '' : 's'} en tu bitácora` : 'Turno cerrado');
              onClose();
            }}
          >
            Cerrar turno y borrar la lista
          </button>
        </>
      }
    >
      <p className="muted small">Elige qué pacientes pasan a tu bitácora de casos (solo sexo, edad, diagnóstico y manejo). Lo demás se borra.</p>
      <ul className="end-list">
        {patients.map((p) => (
          <li key={p.id}>
            <label>
              <input
                type="checkbox"
                disabled={!p.topicId}
                checked={keep.includes(p.id)}
                onChange={(e) => setKeep(e.target.checked ? [...keep, p.id] : keep.filter((x) => x !== p.id))}
              />
              <span>
                {p.bed || 'Sin cama'} · {p.dx || (p.topicId ? TOPIC[p.topicId].title : 'sin tema')}
              </span>
              {!p.topicId && <span className="muted small">(sin tema)</span>}
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
