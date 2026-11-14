import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SPECIALTIES, SPECIALTY, TOPIC } from '../internship/curriculum';
import { rotationOn } from '../internship/planner';
import { useInternship } from '../internship/store';
import { privacyWarnings, useTopicStore } from '../internship/topicStore';
import type { SpecialtyId } from '../internship/types';
import { fmt, fromKey, todayKey } from '../lib/date';
import { useUI } from '../store/ui';
import { useSettings } from '../store/settings';
import { PROC_ROLES, procCounts, useLogbook, type ProcRole } from './store';

type Tab = 'proc' | 'cases' | 'journal';

/** Bitácora del internado: procedimientos con conteo, casos vistos y diario de reflexión. */
export function LogbookView() {
  const [tab, setTab] = useState<Tab>('proc');
  return (
    <div className="page logbook-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Bitácora</h2>
          <p className="muted small">Lo que haces y aprendes en el hospital. Sin datos de pacientes: solo fecha, rotación y lo que hiciste.</p>
        </div>
      </header>
      <div className="seg lb-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'proc'} className={tab === 'proc' ? 'active' : ''} onClick={() => setTab('proc')}>
          <Icon name="scalpel" size={15} /> Procedimientos
        </button>
        <button role="tab" aria-selected={tab === 'cases'} className={tab === 'cases' ? 'active' : ''} onClick={() => setTab('cases')}>
          <Icon name="list" size={15} /> Casos vistos
        </button>
        <button role="tab" aria-selected={tab === 'journal'} className={tab === 'journal' ? 'active' : ''} onClick={() => setTab('journal')}>
          <Icon name="journal" size={15} /> Diario
        </button>
      </div>
      {tab === 'proc' && <Procedures />}
      {tab === 'cases' && <AllCases />}
      {tab === 'journal' && <Journal />}
    </div>
  );
}

const currentRotation = (): SpecialtyId | null => {
  const cfg = useInternship.getState().config;
  return cfg ? rotationOn(cfg, todayKey())?.specialty ?? null : null;
};

function Procedures() {
  const types = useLogbook((s) => s.types);
  const entries = useLogbook((s) => s.entries);
  const { addEntry, removeEntry, addType, updateType, removeType } = useLogbook.getState();
  const [typeId, setTypeId] = useState(types[0]?.id ?? '');
  const [date, setDate] = useState(todayKey());
  const [role, setRole] = useState<ProcRole>('realicé');
  const [sp, setSp] = useState<SpecialtyId | ''>(currentRotation() ?? '');
  const [note, setNote] = useState('');
  const [newType, setNewType] = useState('');
  const [filter, setFilter] = useState<SpecialtyId | ''>('');
  const [open, setOpen] = useState<string | null>(null);
  const [editGoals, setEditGoals] = useState(false);
  const shown = filter ? entries.filter((e) => e.specialty === filter) : entries;
  const warn = privacyWarnings(note);

  return (
    <div className="lb-grid">
      <section className="card lb-form">
        <h4>Registrar procedimiento</h4>
        <label className="field">
          <span>Procedimiento</span>
          <select className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Procedimiento">
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field-row tight">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
          <select className="select" value={sp} onChange={(e) => setSp(e.target.value as SpecialtyId | '')} aria-label="Rotación">
            <option value="">Rotación…</option>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short} · {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="seg" role="radiogroup" aria-label="Participación">
          {PROC_ROLES.map((r) => (
            <button key={r} className={role === r ? 'active' : ''} onClick={() => setRole(r)} aria-pressed={role === r}>
              {r}
            </button>
          ))}
        </div>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (qué aprendiste, complicación…) — sin datos del paciente" aria-label="Nota del procedimiento" />
        {warn.length > 0 && (
          <p className="privacy-warn">
            <Icon name="shield" size={13} /> Parece haber {warn.join(', ')}.
          </p>
        )}
        <button
          className="btn primary"
          disabled={!typeId}
          onClick={() => {
            addEntry({ typeId, date, specialty: sp || null, role, note: note.trim() });
            setNote('');
            useUI.getState().showToast('Procedimiento registrado');
          }}
        >
          <Icon name="plus" size={15} /> Registrar
        </button>
        <form
          className="field-row tight"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newType.trim()) return;
            setTypeId(addType(newType.trim()));
            setNewType('');
          }}
        >
          <input className="input sm grow" value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Otro procedimiento…" aria-label="Nuevo tipo de procedimiento" />
          <button className="btn sm" type="submit" disabled={!newType.trim()}>
            Agregar
          </button>
        </form>
      </section>

      <section className="card lb-counts">
        <div className="field-row tight">
          <h4>Conteo</h4>
          <span className="spacer" />
          <button className={`btn ghost sm${editGoals ? ' active' : ''}`} onClick={() => setEditGoals((v) => !v)} aria-pressed={editGoals}>
            <Icon name="pencil" size={13} /> {editGoals ? 'Listo' : 'Editar metas'}
          </button>
        </div>
        <table className="lb-table">
          <thead>
            <tr>
              <th>Procedimiento</th>
              {PROC_ROLES.map((r) => (
                <th key={r}>{r}</th>
              ))}
              <th title="Tu meta de veces «realicé»">Meta</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const c = procCounts(entries, t.id);
              const reached = t.target !== null && c['realicé'] >= t.target;
              return (
                <tr key={t.id} className={reached ? 'reached' : ''}>
                  <td>
                    <button className="linkish" onClick={() => setOpen(open === t.id ? null : t.id)} title="Tus pasos y material">
                      {t.name}
                    </button>
                    {open === t.id && (
                      <textarea
                        className="input lb-steps"
                        rows={4}
                        defaultValue={t.steps}
                        placeholder="Tus pasos, material y complicaciones a vigilar (de tu manual o tu adscrito)"
                        onBlur={(e) => updateType(t.id, { steps: e.target.value })}
                        aria-label={`Pasos de ${t.name}`}
                      />
                    )}
                  </td>
                  {PROC_ROLES.map((r) => (
                    <td key={r} className="tabular">
                      {c[r] || ''}
                    </td>
                  ))}
                  <td className="tabular">
                    {editGoals ? (
                      <input
                        className="input xs num"
                        inputMode="numeric"
                        defaultValue={t.target ?? ''}
                        onBlur={(e) => updateType(t.id, { target: e.target.value.trim() ? Math.max(0, Number(e.target.value) || 0) : null })}
                        aria-label={`Meta de ${t.name}`}
                      />
                    ) : t.target !== null ? (
                      <span className={reached ? 'ok-text' : 'muted'}>
                        {c['realicé']}/{t.target}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {editGoals && (
                      <button className="icon-btn xs" onClick={() => confirm(`¿Quitar «${t.name}» y sus registros?`) && removeType(t.id)} aria-label={`Quitar ${t.name}`}>
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card lb-history">
        <div className="field-row tight">
          <h4>Historial</h4>
          <span className="spacer" />
          <select className="select xs" value={filter} onChange={(e) => setFilter(e.target.value as SpecialtyId | '')} aria-label="Filtrar por rotación">
            <option value="">Todas las rotaciones</option>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short}
              </option>
            ))}
          </select>
        </div>
        {shown.length ? (
          <ul className="lb-list">
            {shown.map((e) => (
              <li key={e.id}>
                <span className="tabular muted small">{fmt(fromKey(e.date), { day: 'numeric', month: 'short' })}</span>
                {e.specialty && <span className="sp-tag" style={{ background: SPECIALTY[e.specialty].color }}>{SPECIALTY[e.specialty].short}</span>}
                <b>{types.find((t) => t.id === e.typeId)?.name ?? '—'}</b>
                <span className={`role r-${e.role}`}>{e.role}</span>
                <span className="grow muted small">{e.note}</span>
                <button className="icon-btn xs" onClick={() => removeEntry(e.id)} aria-label="Borrar registro">
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-mini">
            <p className="muted small">Aún no hay registros. Ejemplo: «Venopunción · realicé · primer intento con supervisión».</p>
            <button className="btn sm" onClick={() => (document.querySelector('.lb-form select') as HTMLSelectElement | null)?.focus()}>
              <Icon name="plus" size={14} /> Registrar mi primer procedimiento
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function AllCases() {
  const info = useTopicStore((s) => s.info);
  const all = useMemo(
    () =>
      Object.entries(info)
        .flatMap(([topicId, i]) => i.cases.map((c) => ({ ...c, topicId })))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [info],
  );
  return (
    <section className="card">
      <p className="muted small">Todos tus casos de todas las rotaciones. Se agregan desde la ficha de cada tema o al terminar el turno.</p>
      {all.length ? (
        <ul className="lb-list">
          {all.map((c) => {
            const t = TOPIC[c.topicId];
            return (
              <li key={c.id}>
                <span className="tabular muted small">{fmt(fromKey(c.date), { day: 'numeric', month: 'short' })}</span>
                {t && <span className="sp-tag" style={{ background: SPECIALTY[t.specialty].color }}>{SPECIALTY[t.specialty].short}</span>}
                <button className="linkish" onClick={() => useUI.getState().openTopic(c.topicId, 'cases')}>
                  {t?.title ?? c.topicId}
                </button>
                <span className="grow muted small">
                  {c.patient} · {c.finding}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-mini">
          <p className="muted small">Aún no has registrado casos. Al terminar el Turno puedes pasar ahí a tus pacientes (anónimos), o registrarlos desde Inicio → Casos vistos.</p>
          <button className="btn sm" onClick={() => useSettings.getState().setView('internado')}>
            Ir a Inicio
          </button>
        </div>
      )}
    </section>
  );
}

function Journal() {
  const journal = useLogbook((s) => s.journal);
  const save = useLogbook((s) => s.saveJournal);
  const remove = useLogbook((s) => s.removeJournal);
  const [date, setDate] = useState(todayKey());
  const cur = journal.find((j) => j.date === date);
  const [draft, setDraft] = useState({ learned: cur?.learned ?? '', hard: cur?.hard ?? '', differently: cur?.differently ?? '' });
  const load = (d: string) => {
    setDate(d);
    const j = journal.find((x) => x.date === d);
    setDraft({ learned: j?.learned ?? '', hard: j?.hard ?? '', differently: j?.differently ?? '' });
  };
  const warn = privacyWarnings(`${draft.learned} ${draft.hard} ${draft.differently}`);
  const FIELDS: { k: keyof typeof draft; label: string; hint: string }[] = [
    { k: 'learned', label: '¿Qué aprendí hoy?', hint: 'Una cosa clínica y una humana' },
    { k: 'hard', label: '¿Qué me costó?', hint: 'Lo que te frustró o te dio miedo' },
    { k: 'differently', label: '¿Qué haría distinto?', hint: 'Para la próxima guardia' },
  ];
  return (
    <div className="lb-grid journal">
      <section className="card">
        <p className="muted small">
          <Icon name="lock" size={13} /> Privado: se guarda solo en tu equipo (y en tus respaldos; ponles contraseña en Ajustes → Respaldo). No escribas datos de pacientes.
        </p>
        <div className="field-row tight">
          <input className="input" type="date" value={date} onChange={(e) => load(e.target.value)} aria-label="Fecha del diario" />
          {cur && <span className="muted small">Entrada guardada</span>}
        </div>
        {FIELDS.map((f) => (
          <label key={f.k} className="field">
            <span>{f.label}</span>
            <textarea className="input" rows={3} placeholder={f.hint} value={draft[f.k]} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })} aria-label={f.label} />
          </label>
        ))}
        {warn.length > 0 && (
          <p className="privacy-warn">
            <Icon name="shield" size={13} /> Parece haber {warn.join(', ')}.
          </p>
        )}
        <button
          className="btn primary"
          disabled={!draft.learned.trim() && !draft.hard.trim() && !draft.differently.trim()}
          onClick={() => {
            save({ date, ...draft });
            useUI.getState().showToast('Entrada del diario guardada');
          }}
        >
          Guardar entrada
        </button>
      </section>
      <section className="card">
        <h4>Entradas</h4>
        {journal.length ? (
          <ul className="journal-list">
            {journal.map((j) => (
              <li key={j.id} className={j.date === date ? 'active' : ''}>
                <button className="linkish" onClick={() => load(j.date)}>
                  {fmt(fromKey(j.date), { weekday: 'short', day: 'numeric', month: 'short' })}
                </button>
                <span className="grow muted small ellipsis">{j.learned || j.hard || j.differently}</span>
                <button className="icon-btn xs" onClick={() => confirm('¿Borrar esta entrada?') && remove(j.id)} aria-label="Borrar entrada">
                  <Icon name="x" size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-mini">
            <p className="muted small">Aún no hay entradas. Dos minutos al final de cada guardia bastan. Ejemplo: «Aprendí a explicar un pronóstico con calma».</p>
            <button className="btn sm" onClick={() => (document.querySelector('textarea[aria-label="¿Qué aprendí hoy?"]') as HTMLTextAreaElement | null)?.focus()}>
              <Icon name="pen" size={14} /> Escribir la de hoy
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
