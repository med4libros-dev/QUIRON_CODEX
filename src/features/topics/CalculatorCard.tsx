import { useState } from 'react';
import type { Calculator, Values } from '../../clinical/calculators';

/** Calculadora/escala interactiva. Táctil: casillas grandes y selects nativos (cómodos con el lápiz). */
export function CalculatorCard({ calc, defaultOpen = false }: { calc: Calculator; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [v, setV] = useState<Values>({});
  const res = open ? calc.compute(v) : null;
  return (
    <section className={`calc${open ? ' open' : ''}`} data-calc={calc.id}>
      <button className="calc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <b>{calc.name}</b>
        <span className="muted small">{calc.source}</span>
      </button>
      {open && (
        <div className="calc-body">
          {calc.fields.map((f) =>
            f.type === 'check' ? (
              <label key={f.id} className="calc-check">
                <input type="checkbox" checked={!!v[f.id]} onChange={(e) => setV({ ...v, [f.id]: e.target.checked })} />
                <span>{f.label}</span>
                <span className="muted small tabular">{f.points > 0 ? `+${f.points}` : f.points}</span>
              </label>
            ) : f.type === 'select' ? (
              <label key={f.id} className="calc-field">
                <span>{f.label}</span>
                <select
                  className="select"
                  value={typeof v[f.id] === 'number' ? String(v[f.id]) : ''}
                  onChange={(e) => setV({ ...v, [f.id]: e.target.value === '' ? undefined : Number(e.target.value) })}
                >
                  <option value="">—</option>
                  {f.options.map((o, i) => (
                    <option key={i} value={i}>
                      {o.label}
                      {calc.id === 'ckdepi' ? '' : ` (${o.points})`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label key={f.id} className="calc-field">
                <span>
                  {f.label} <em className="muted">({f.unit})</em>
                </span>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={f.min}
                  max={f.max}
                  step={f.step ?? 'any'}
                  value={typeof v[f.id] === 'number' ? String(v[f.id]) : ''}
                  onChange={(e) => setV({ ...v, [f.id]: e.target.value === '' ? undefined : Number(e.target.value) })}
                />
              </label>
            ),
          )}
          <div className={`calc-result ${res ? `lv-${res.level}` : 'empty'}`} aria-live="polite">
            {res ? (
              <>
                <b className="calc-value">{res.value}</b>
                <span>{res.interpretation}</span>
              </>
            ) : (
              <span className="muted">Completa los campos para ver el resultado.</span>
            )}
          </div>
          <div className="calc-foot">
            <button className="btn ghost sm" onClick={() => setV({})}>
              Limpiar
            </button>
            <span className="muted small">Orientativo: confirma con la GPC y tu criterio clínico.</span>
          </div>
        </div>
      )}
    </section>
  );
}
