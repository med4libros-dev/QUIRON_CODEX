import logo from '../assets/quiron-logo.webp';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { addDays, fromKey, toKey, todayKey } from '../lib/date';
import { SPECIALTIES, SPECIALTY, TOPICS } from './curriculum';
import { addMonthsKeep, buildRotations, defaultConfig, generatePlan } from './planner';
import { useInternship } from './store';
import type { InternshipConfig, SpecialtyId } from './types';

/** Asistente para configurar (o ajustar) el plan anual del internado. */
export function SetupWizard({ initial, onDone }: { initial?: InternshipConfig; onDone?: () => void }) {
  const setConfig = useInternship((s) => s.setConfig);
  const base = initial ?? defaultConfig(todayKey());
  const [start, setStart] = useState(base.start);
  const [order, setOrder] = useState<SpecialtyId[]>(base.rotations.map((r) => r.specialty));
  const [months, setMonths] = useState<number[]>(
    base.rotations.map((r) => Math.max(1, Math.round((fromKey(r.end).getTime() - fromKey(r.start).getTime()) / (30.4 * 86_400_000)))),
  );
  const [guardiaEvery, setGuardiaEvery] = useState<0 | 3 | 4>(base.guardiaEvery);
  const [firstGuardia, setFirstGuardia] = useState(base.firstGuardia);
  const [guardiaTouched, setGuardiaTouched] = useState(!!initial);
  const [dailyMinutes, setDaily] = useState(base.dailyMinutes);
  const [weekendMinutes, setWeekend] = useState(base.weekendMinutes);
  const [guardiaMinutes, setGuardiaMin] = useState(base.guardiaMinutes);
  const [postFactor, setPostFactor] = useState(base.postGuardiaFactor);
  const [reviewWeeks, setReviewWeeks] = useState(base.reviewWeeks);
  const [primaryShare, setPrimaryShare] = useState(base.primaryShare);

  const totalMonths = months.reduce((a, m) => a + m, 0);
  const cfg: InternshipConfig = useMemo(() => {
    const rotations = buildRotations(start, order, months);
    const end = toKey(addDays(fromKey(addMonthsKeep(start, totalMonths)), -1));
    return {
      start,
      end,
      rotations,
      guardiaEvery,
      firstGuardia: firstGuardia < start ? start : firstGuardia,
      dailyMinutes,
      weekendMinutes,
      guardiaMinutes,
      postGuardiaFactor: postFactor,
      reviewWeeks,
      primaryShare,
    };
  }, [start, order, months, totalMonths, guardiaEvery, firstGuardia, dailyMinutes, weekendMinutes, guardiaMinutes, postFactor, reviewWeeks, primaryShare]);
  const preview = useMemo(() => generatePlan(cfg, TOPICS), [cfg]);
  const capacity = [...preview.days.values()].reduce((a, d) => a + d.capacity, 0);
  const guardias = [...preview.days.values()].filter((d) => d.guardia).length;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    const m = [...months];
    [o[i], o[j]] = [o[j], o[i]];
    [m[i], m[j]] = [m[j], m[i]];
    setOrder(o);
    setMonths(m);
  };

  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0));

  return (
    <div className="page setup">
      <header className="page-head">
        {!initial && <img className="setup-logo" src={logo} alt="Quirón Codex" draggable={false} />}
        <div>
          {!initial && <div className="brand-kicker">Bienvenido a Quirón Codex</div>}
          <h2 className="page-title">{initial ? 'Ajustar mi plan de internado' : 'Configura tu año de internado'}</h2>
        </div>
        <div className="spacer" />
        {onDone && (
          <button className="btn ghost" onClick={onDone}>
            Cancelar
          </button>
        )}
      </header>

      <div className="setup-grid">
        <section className="card">
          <div className="card-head">
            <h4>1 · Fechas y rotaciones</h4>
          </div>
          <label className="field">
            <span>Inicio del internado</span>
            <input className="input" type="date" value={start} onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setStart(v);
                // La primera guardia acompaña al inicio mientras no la hayas fijado a mano.
                if (!guardiaTouched) setFirstGuardia(toKey(addDays(fromKey(v), 2)));
              }}
            />
          </label>
          <ol className="rot-list">
            {order.map((sp, i) => {
              const r = cfg.rotations[i];
              return (
                <li key={i}>
                  <span className="rot-swatch" style={{ background: SPECIALTY[sp].color }} />
                  <select
                    className="select"
                    value={sp}
                    onChange={(e) => setOrder(order.map((x, k) => (k === i ? (e.target.value as SpecialtyId) : x)))}
                    aria-label={`Rotación ${i + 1}`}
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select className="select xs" value={months[i]} onChange={(e) => setMonths(months.map((m, k) => (k === i ? Number(e.target.value) : m)))} aria-label="Meses">
                    {[1, 2, 3].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? 'mes' : 'meses'}
                      </option>
                    ))}
                  </select>
                  <span className="muted small rot-dates tabular">
                    {fromKey(r.start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – {fromKey(r.end).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </span>
                  <button className="icon-btn xs" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                    <Icon name="chevronLeft" size={14} className="rot-up" />
                  </button>
                  <button className="icon-btn xs" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Bajar">
                    <Icon name="chevronRight" size={14} className="rot-down" />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="muted small">Termina el {fromKey(cfg.end).toLocaleDateString('es-MX', { dateStyle: 'long' })} ({totalMonths} meses).</p>
        </section>

        <section className="card">
          <div className="card-head">
            <h4>2 · Guardias y tiempo de estudio</h4>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Guardias</span>
              <select className="select" value={guardiaEvery} onChange={(e) => setGuardiaEvery(Number(e.target.value) as 0 | 3 | 4)}>
                <option value={3}>Cada 3er día (ABC)</option>
                <option value={4}>Cada 4º día (ABCD)</option>
                <option value={0}>Sin guardias</option>
              </select>
            </label>
            {guardiaEvery > 0 && (
              <label className="field">
                <span>Primera guardia</span>
                <input className="input" type="date" value={firstGuardia} min={start} onChange={(e) => {
                    if (!e.target.value) return;
                    setGuardiaTouched(true);
                    setFirstGuardia(e.target.value);
                  }}
                />
              </label>
            )}
            <label className="field">
              <span>Min. entre semana</span>
              <input className="input" type="number" min={15} max={300} step={5} value={dailyMinutes} onChange={(e) => setDaily(num(e.target.value, 0, 300))} />
            </label>
            <label className="field">
              <span>Min. fin de semana</span>
              <input className="input" type="number" min={0} max={480} step={5} value={weekendMinutes} onChange={(e) => setWeekend(num(e.target.value, 0, 480))} />
            </label>
            {guardiaEvery > 0 && (
              <>
                <label className="field">
                  <span>Min. en guardia (repaso)</span>
                  <input className="input" type="number" min={0} max={120} step={5} value={guardiaMinutes} onChange={(e) => setGuardiaMin(num(e.target.value, 0, 120))} />
                </label>
                <label className="field">
                  <span>Postguardia</span>
                  <select className="select" value={postFactor} onChange={(e) => setPostFactor(Number(e.target.value))}>
                    <option value={0}>Descanso total</option>
                    <option value={0.5}>50% de la carga</option>
                    <option value={0.75}>75% de la carga</option>
                    <option value={1}>Carga normal</option>
                  </select>
                </label>
              </>
            )}
            <label className="field">
              <span>Repaso final (semanas)</span>
              <input className="input" type="number" min={0} max={12} value={reviewWeeks} onChange={(e) => setReviewWeeks(num(e.target.value, 0, 12))} />
            </label>
            <label className="field">
              <span>Enfoque en la rotación: {Math.round(primaryShare * 100)}%</span>
              <input type="range" min={0.4} max={0.9} step={0.05} value={primaryShare} onChange={(e) => setPrimaryShare(Number(e.target.value))} />
            </label>
          </div>
        </section>

        <section className="card span-2 setup-summary">
          <div className="summary-stats">
            <div>
              <span className="stat-label">Temario</span>
              <b className="tabular">{TOPICS.length} temas · {Math.round(preview.totalNewMinutes / 60)} h</b>
            </div>
            <div>
              <span className="stat-label">Tiempo disponible</span>
              <b className="tabular">{Math.round(capacity / 60)} h en {preview.keys.length} días</b>
            </div>
            <div>
              <span className="stat-label">Guardias</span>
              <b className="tabular">{guardias}</b>
            </div>
            <div>
              <span className="stat-label">Cobertura</span>
              <b className={preview.unplannedMinutes ? 'warn-text' : 'ok-text'}>
                {preview.unplannedMinutes ? `Faltan ${Math.ceil(preview.unplannedMinutes / 60)} h` : 'Todo el temario + repasos'}
              </b>
            </div>
          </div>
          {preview.unplannedMinutes > 0 && <p className="small warn-text">No alcanza el tiempo: sube los minutos diarios o reduce las semanas de repaso final.</p>}
          <div className="field-row">
            <span className="muted small">El plan se recalcula al instante con cualquier cambio. Tus lecciones marcadas se conservan.</span>
            <div className="spacer" />
            <button
              className="btn primary"
              onClick={() => {
                setConfig(cfg);
                onDone?.();
              }}
            >
              <Icon name="check" size={16} /> {initial ? 'Guardar cambios' : 'Crear mi plan'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
