import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { PROC_ROLES, procCounts, useLogbook, type ProcRole } from '../logbook/store';
import { privacyWarnings, useTopicStore } from '../internship/topicStore';
import { SPECIALTY, TOPICS } from '../internship/curriculum';
import { useUI } from '../store/ui';

/**
 * Bitácora a una mano, para el pasillo: el caso se anota cuando pasa, no en la noche
 * cuando ya se te olvidó la mitad. Mismas reglas de anonimato que en la tableta.
 */
export function PocketLog() {
  const [modo, setModo] = useState<'caso' | 'proc'>('caso');
  return (
    <>
      <div className="pk-seg">
        <button className={`chip${modo === 'caso' ? ' on' : ''}`} aria-pressed={modo === 'caso'} onClick={() => setModo('caso')}>
          Caso
        </button>
        <button className={`chip${modo === 'proc' ? ' on' : ''}`} aria-pressed={modo === 'proc'} onClick={() => setModo('proc')}>
          Procedimiento
        </button>
      </div>
      {modo === 'caso' ? <CasoRapido /> : <ProcRapido />}
    </>
  );
}

const SETTINGS = ['Urgencias', 'Piso', 'Consulta', 'Quirófano', 'Tococirugía', 'Otro'] as const;

function CasoRapido() {
  const [topicId, setTopicId] = useState('');
  const [setting, setSetting] = useState<(typeof SETTINGS)[number]>('Urgencias');
  const [paciente, setPaciente] = useState('');
  const [resumen, setResumen] = useState('');
  const [aprendi, setAprendi] = useState('');
  const addCase = useTopicStore((s) => s.addCase);
  const showToast = useUI((s) => s.showToast);
  const avisos = useMemo(() => privacyWarnings(`${paciente} ${resumen} ${aprendi}`), [paciente, resumen, aprendi]);
  const listo = topicId && resumen.trim().length > 4;

  return (
    <form
      className="pk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!listo) return;
        addCase(topicId, {
          date: new Date().toISOString().slice(0, 10),
          setting,
          patient: paciente.trim(),
          finding: resumen.trim(),
          management: aprendi.trim(),
        });
        setPaciente('');
        setResumen('');
        setAprendi('');
        showToast('Caso guardado en la ficha del tema.');
      }}
    >
      <p className="muted small">
        Tres líneas, <b>sin datos identificables</b>: nada de nombres, expediente, NSS, CURP ni cama. Usa sexo, edad y el antecedente clave
        («M 67 a, DM2 de 10 años»).
      </p>
      <label className="field">
        <span>Tema</span>
        <select className="select" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">Elige el tema…</option>
          {TOPICS.map((t) => (
            <option key={t.id} value={t.id}>
              {SPECIALTY[t.specialty].short} · {t.title}
            </option>
          ))}
        </select>
      </label>
      <div className="pk-seg">
        {SETTINGS.map((x) => (
          <button key={x} className={`chip${setting === x ? ' on' : ''}`} aria-pressed={setting === x} onClick={() => setSetting(x)}>
            {x}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Paciente (anónimo)</span>
        <input className="input" value={paciente} onChange={(e) => setPaciente(e.target.value)} placeholder="M 67 a, DM2 de 10 años" />
      </label>
      <label className="field">
        <span>Hallazgo</span>
        <textarea className="input" rows={3} value={resumen} onChange={(e) => setResumen(e.target.value)} placeholder="Llegó con…" />
      </label>
      <label className="field">
        <span>Manejo / qué aprendí</span>
        <textarea className="input" rows={2} value={aprendi} onChange={(e) => setAprendi(e.target.value)} placeholder="Lo que no quiero olvidar" />
      </label>
      {avisos.length > 0 && (
        <p className="small warn-text">
          <Icon name="shield" size={14} /> Revisa: parece haber {avisos.join(', ')}. Quítalo antes de guardar.
        </p>
      )}
      <button className="btn primary" type="submit" disabled={!listo}>
        Guardar caso
      </button>
    </form>
  );
}

function ProcRapido() {
  const types = useLogbook((s) => s.types);
  const entries = useLogbook((s) => s.entries);
  const addEntry = useLogbook((s) => s.addEntry);
  const showToast = useUI((s) => s.showToast);
  const [typeId, setTypeId] = useState('');
  const [role, setRole] = useState<ProcRole>('realicé');

  return (
    <div className="pk-form">
      <p className="muted small">Un toque por procedimiento. El conteo es el mismo que ves en la Bitácora de la tableta.</p>
      <label className="field">
        <span>Procedimiento</span>
        <select className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Elige…</option>
          {types.map((t) => {
            const c = procCounts(entries, t.id);
            return (
              <option key={t.id} value={t.id}>
                {t.name} ({c.observé + c.asistí + c.realicé}
                {t.target ? ` / ${t.target}` : ''})
              </option>
            );
          })}
        </select>
      </label>
      <div className="pk-seg">
        {PROC_ROLES.map((r) => (
          <button key={r} className={`chip${role === r ? ' on' : ''}`} aria-pressed={role === r} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={!typeId}
        onClick={() => {
          addEntry({ typeId, role, date: new Date().toISOString().slice(0, 10), specialty: null, note: '' });
          const t = types.find((x) => x.id === typeId);
          showToast(`${t?.name}: +1 (${role}).`);
        }}
      >
        Registrar
      </button>
      {typeId && (
        <p className="small muted">
          Llevas {(() => { const c = procCounts(entries, typeId); return c.observé + c.asistí + c.realicé; })()} de «
          {types.find((t) => t.id === typeId)?.name}».
        </p>
      )}
    </div>
  );
}

