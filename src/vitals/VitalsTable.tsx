import { useState } from 'react';
import { Icon } from '../components/Icon';
import { VITAL_LABEL, useVitals, type VitalKey } from './store';

const KEYS: VitalKey[] = ['fc', 'fr', 'tas'];
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** Tabla de signos vitales normales por edad. Los rangos los capturas tú desde tu fuente. */
export function VitalsTable() {
  const groups = useVitals((s) => s.groups);
  const setRange = useVitals((s) => s.setRange);
  const setAges = useVitals((s) => s.setAges);
  const empty = groups.every((g) => KEYS.every((k) => g[k].min === null && g[k].max === null));
  const [edit, setEdit] = useState(empty);
  const show = (r: { min: number | null; max: number | null }) => (r.min === null && r.max === null ? '—' : `${r.min ?? '…'}–${r.max ?? '…'}`);
  const ageLabel = (m: number) => (m < 24 ? `${m} m` : `${Math.round((m / 12) * 10) / 10} a`);
  return (
    <div className="vitals-table">
      <p className="muted small">
        Captura los rangos <b>de tu fuente</b> (GPC, PALS, tu libro de pediatría). Quirón Codex no precarga valores. En <b>Turno</b>, los signos de cada paciente se marcan con ↑/↓ si salen del rango de su edad.
      </p>
      <div className="field-row tight">
        {empty && <p className="small warn-text">Aún no capturas ningún rango.</p>}
        <span className="spacer" />
        <button className={`btn ghost sm${edit ? ' active' : ''}`} onClick={() => setEdit((v) => !v)} aria-pressed={edit}>
          <Icon name="pencil" size={13} /> {edit ? 'Listo' : 'Editar rangos'}
        </button>
      </div>
      <div className="vt-scroll">
        <table>
          <thead>
            <tr>
              <th>Grupo</th>
              <th title="Edad desde / hasta, en meses">Edad (meses)</th>
              {KEYS.map((k) => (
                <th key={k}>{VITAL_LABEL[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>{g.label}</td>
                <td className="vt-age">
                  {!edit ? (
                    <span className="muted tabular">
                      {ageLabel(g.fromMonths)} – {g.toMonths >= 1200 ? '∞' : ageLabel(g.toMonths)}
                    </span>
                  ) : (
                  <>
                  <input className="input xs num" inputMode="numeric" defaultValue={g.fromMonths} onBlur={(e) => setAges(g.id, Number(e.target.value) || 0, g.toMonths)} aria-label={`${g.label}: edad desde (meses)`} />
                  –
                  <input className="input xs num" inputMode="numeric" defaultValue={g.toMonths} onBlur={(e) => setAges(g.id, g.fromMonths, Number(e.target.value) || g.toMonths)} aria-label={`${g.label}: edad hasta (meses)`} />
                  </>
                  )}
                </td>
                {KEYS.map((k) => (
                  <td key={k} className="vt-range">
                    {!edit ? (
                      <span className="tabular">{show(g[k])}</span>
                    ) : (
                    <>
                    <input
                      className="input xs num"
                      inputMode="numeric"
                      placeholder="mín"
                      defaultValue={g[k].min ?? ''}
                      onBlur={(e) => setRange(g.id, k, { ...g[k], min: num(e.target.value) })}
                      aria-label={`${g.label}: ${VITAL_LABEL[k]} mínima`}
                    />
                    –
                    <input
                      className="input xs num"
                      inputMode="numeric"
                      placeholder="máx"
                      defaultValue={g[k].max ?? ''}
                      onBlur={(e) => setRange(g.id, k, { ...g[k], max: num(e.target.value) })}
                      aria-label={`${g.label}: ${VITAL_LABEL[k]} máxima`}
                    />
                    </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
