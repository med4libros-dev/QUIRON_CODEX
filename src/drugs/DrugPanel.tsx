import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useUI } from '../store/ui';
import { computeDose, useDrugs, type Drug } from './store';

const num = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};

/** Fármacos con cálculo por peso. Las dosis las capturas tú desde la GPC. */
export function DrugPanel() {
  const drugs = useDrugs((s) => s.drugs);
  const remove = useDrugs((s) => s.remove);
  const weight = useUI((s) => s.drugWeight);
  const [kgText, setKgText] = useState(weight ? String(weight) : '');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Drug | 'new' | null>(null);
  const kg = num(kgText);
  const list = drugs.filter((d) => !q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="drug-panel">
      <div className="field-row tight">
        <label className="drug-kg">
          <span>Peso</span>
          <input className="input" inputMode="decimal" value={kgText} onChange={(e) => setKgText(e.target.value)} placeholder="kg" aria-label="Peso del paciente en kg" />
          <span className="muted">kg</span>
        </label>
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fármaco…" aria-label="Buscar fármaco" />
        <button className="btn sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={14} /> Ficha
        </button>
      </div>
      {!drugs.length && (
        <div className="ts-empty muted">
          Crea tus fichas con la dosis por kg <b>tal como aparece en tu GPC</b>; aquí solo se calcula. Así cada número tiene su fuente.
        </div>
      )}
      <ul className="drug-list">
        {list.map((d) => {
          const r = kg ? computeDose(d, kg) : null;
          return (
            <li key={d.id} className={r?.capped ? 'capped' : ''}>
              <div className="drug-head">
                <b>{d.name}</b>
                <span className="muted small">{d.presentation}</span>
                <span className="spacer" />
                <button className="icon-btn xs" onClick={() => setEditing(d)} aria-label={`Editar ${d.name}`}>
                  <Icon name="pen" size={14} />
                </button>
                <button className="icon-btn xs" onClick={() => confirm(`¿Eliminar la ficha de ${d.name}?`) && remove(d.id)} aria-label={`Eliminar ${d.name}`}>
                  <Icon name="trash" size={14} />
                </button>
              </div>
              <div className="muted small">
                {d.mgPerKg} mg/kg/{d.basis === 'dose' ? 'dosis' : 'día'}
                {d.basis === 'day' ? ` ÷ ${d.divisions}` : d.divisions > 1 ? ` · ${d.divisions} dosis/día` : ''}
                {d.maxMgPerDose ? ` · máx ${d.maxMgPerDose} mg/dosis` : ''}
                {d.maxMgPerDay ? ` · máx ${d.maxMgPerDay} mg/día` : ''}
                {d.route && ` · ${d.route}`}
                {d.frequency && ` · ${d.frequency}`}
              </div>
              {r && (
                <div className="drug-result" aria-live="polite">
                  <span>
                    <b className="tabular">{r.perDoseMg} mg</b> por dosis
                  </span>
                  {r.perDoseMl !== null && (
                    <span>
                      = <b className="tabular">{r.perDoseMl} mL</b>
                    </span>
                  )}
                  <span className="muted">
                    · <span className="tabular">{r.perDayMg}</span> mg/día
                  </span>
                </div>
              )}
              {r?.warnings.map((w) => (
                <p key={w} className="privacy-warn">
                  {w}
                </p>
              ))}
              {d.source && <div className="muted small">Fuente: {d.source}</div>}
            </li>
          );
        })}
      </ul>
      {editing && <DrugEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DrugEditor({ initial, onClose }: { initial: Drug | null; onClose: () => void }) {
  const add = useDrugs((s) => s.add);
  const update = useDrugs((s) => s.update);
  const [f, setF] = useState({
    name: initial?.name ?? '',
    presentation: initial?.presentation ?? '',
    concMg: initial?.concMg?.toString() ?? '',
    concMl: initial?.concMl?.toString() ?? '',
    basis: initial?.basis ?? ('dose' as Drug['basis']),
    mgPerKg: initial?.mgPerKg?.toString() ?? '',
    divisions: initial?.divisions?.toString() ?? '1',
    maxMgPerDose: initial?.maxMgPerDose?.toString() ?? '',
    maxMgPerDay: initial?.maxMgPerDay?.toString() ?? '',
    route: initial?.route ?? '',
    frequency: initial?.frequency ?? '',
    notes: initial?.notes ?? '',
    source: initial?.source ?? '',
  });
  const s = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim() && (num(f.mgPerKg) ?? 0) > 0;
  const save = () => {
    const d = {
      name: f.name.trim(),
      presentation: f.presentation.trim(),
      concMg: num(f.concMg),
      concMl: num(f.concMl),
      basis: f.basis,
      mgPerKg: num(f.mgPerKg) ?? 0,
      divisions: Math.max(1, Math.round(num(f.divisions) ?? 1)),
      maxMgPerDose: num(f.maxMgPerDose),
      maxMgPerDay: num(f.maxMgPerDay),
      route: f.route.trim(),
      frequency: f.frequency.trim(),
      notes: f.notes.trim(),
      source: f.source.trim(),
    };
    if (initial) update(initial.id, d);
    else add(d);
    onClose();
  };
  return (
    <div className="drug-editor card">
      <div className="drug-grid">
        <label className="field">
          <span>Fármaco</span>
          <input className="input" value={f.name} onChange={s('name')} aria-label="Nombre del fármaco" />
        </label>
        <label className="field">
          <span>Presentación</span>
          <input className="input" value={f.presentation} onChange={s('presentation')} placeholder="p. ej. Suspensión" />
        </label>
        <label className="field">
          <span>Concentración: mg</span>
          <input className="input" inputMode="decimal" value={f.concMg} onChange={s('concMg')} aria-label="mg de la presentación" />
        </label>
        <label className="field">
          <span>en mL</span>
          <input className="input" inputMode="decimal" value={f.concMl} onChange={s('concMl')} aria-label="mL de la presentación" />
        </label>
        <label className="field">
          <span>Dosis</span>
          <input className="input" inputMode="decimal" value={f.mgPerKg} onChange={s('mgPerKg')} aria-label="mg por kg" />
        </label>
        <label className="field">
          <span>Base</span>
          <select className="select" value={f.basis} onChange={s('basis')} aria-label="Base de la dosis">
            <option value="dose">mg/kg por dosis</option>
            <option value="day">mg/kg/día (dividido)</option>
          </select>
        </label>
        <label className="field">
          <span>{f.basis === 'day' ? 'Dividido en (tomas)' : 'Dosis al día'}</span>
          <input className="input" inputMode="numeric" value={f.divisions} onChange={s('divisions')} aria-label="Divisiones" />
        </label>
        <label className="field">
          <span>Máx. mg/dosis</span>
          <input className="input" inputMode="decimal" value={f.maxMgPerDose} onChange={s('maxMgPerDose')} aria-label="Máximo por dosis" />
        </label>
        <label className="field">
          <span>Máx. mg/día</span>
          <input className="input" inputMode="decimal" value={f.maxMgPerDay} onChange={s('maxMgPerDay')} aria-label="Máximo por día" />
        </label>
        <label className="field">
          <span>Vía</span>
          <input className="input" value={f.route} onChange={s('route')} placeholder="VO, IV…" />
        </label>
        <label className="field">
          <span>Frecuencia</span>
          <input className="input" value={f.frequency} onChange={s('frequency')} placeholder="p. ej. cada 8 h" />
        </label>
        <label className="field">
          <span>Fuente (GPC, página)</span>
          <input className="input" value={f.source} onChange={s('source')} aria-label="Fuente" />
        </label>
      </div>
      <div className="field-row tight">
        <span className="muted small">Copia los valores de tu GPC vigente.</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn primary sm" disabled={!ok} onClick={save}>
          Guardar ficha
        </button>
      </div>
    </div>
  );
}
