import { useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { addDays, fmt, formatMinutes, monthBounds, startOfWeek, toKey, weekBounds } from '../../lib/date';
import { focusMinutes, goalValue, minutesByDay, sessionsIn, streak } from '../../lib/stats';
import { usePlanner } from '../../store/planner';
import type { GoalMetric, GoalPeriod } from '../../types';

const WEEKS = 16;
const level = (m: number) => (m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4);
const PERIOD_LABEL: Record<GoalPeriod, string> = { week: 'esta semana', month: 'este mes', total: 'en total' };

export function ProgressView() {
  const logs = usePlanner((s) => s.logs);
  const sessions = usePlanner((s) => s.sessions);
  const goals = usePlanner((s) => s.goals);
  const subjects = usePlanner((s) => s.subjects);
  const removeGoal = usePlanner((s) => s.removeGoal);
  const [adding, setAdding] = useState(false);

  const now = new Date();
  const week = weekBounds(now);
  const month = monthBounds(now);
  const weekFocus = focusMinutes(logs, week);
  const weekSessions = sessionsIn(sessions, week);
  const weekDone = weekSessions.filter((s) => s.done).length;
  const days = streak(logs, sessions, now);
  const goalRows = goals.map((g) => ({ g, value: goalValue(g, logs, sessions, now) }));
  const met = goalRows.filter((r) => r.value >= r.g.target).length;

  const daily = useMemo(() => minutesByDay(logs), [logs]);
  const heatStart = addDays(startOfWeek(now), -(WEEKS - 1) * 7);

  const perSubject = subjects
    .map((s) => {
      const list = sessionsIn(sessions, month, s.id);
      return { s, planned: list.length, done: list.filter((x) => x.done).length, focus: focusMinutes(logs, month, s.id) };
    })
    .filter((r) => r.planned || r.focus);

  const stats: { icon: IconName; label: string; value: string; hint: string }[] = [
    { icon: 'clock', label: 'Enfoque esta semana', value: formatMinutes(weekFocus), hint: 'Minutos de Pomodoro completados' },
    { icon: 'check', label: 'Sesiones de la semana', value: `${weekDone}/${weekSessions.length}`, hint: weekSessions.length ? `${Math.round((weekDone / weekSessions.length) * 100)}% completado` : 'Planifica en el calendario' },
    { icon: 'flame', label: 'Racha', value: `${days} ${days === 1 ? 'día' : 'días'}`, hint: 'Días seguidos con estudio' },
    { icon: 'target', label: 'Metas cumplidas', value: `${met}/${goals.length}`, hint: goals.length ? 'En su periodo actual' : 'Crea tu primera meta' },
  ];

  return (
    <div className="page progress">
      <header className="page-head">
        <h2 className="page-title">Progreso académico</h2>
        <div className="spacer" />
        <span className="muted small">{fmt(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <div className="stat-grid">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <div className="stat-label">
              <Icon name={s.icon} size={16} /> {s.label}
            </div>
            <div className="stat-value tabular">{s.value}</div>
            <div className="muted small">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="progress-grid">
        <section className="card">
          <div className="card-head">
            <h4>Metas</h4>
            <div className="spacer" />
            <button className="btn ghost sm" onClick={() => setAdding((v) => !v)}>
              <Icon name={adding ? 'x' : 'plus'} size={16} /> {adding ? 'Cerrar' : 'Nueva meta'}
            </button>
          </div>
          {adding && <GoalForm onDone={() => setAdding(false)} />}
          {goalRows.length === 0 && !adding && (
            <p className="muted small">Ejemplos: «10 h de enfoque esta semana», «20 sesiones de Cardiología este mes».</p>
          )}
          <ul className="goal-list">
            {goalRows.map(({ g, value }) => {
              const pctDone = Math.min(100, Math.round((value / Math.max(1, g.target)) * 100));
              const subj = g.subjectId ? subjects.find((s) => s.id === g.subjectId) : undefined;
              const fmtVal = (v: number) => (g.metric === 'focusMinutes' ? formatMinutes(v) : `${v} sesiones`);
              return (
                <li key={g.id} className={pctDone >= 100 ? 'met' : ''}>
                  <div className="goal-top">
                    <span className="goal-title">
                      {pctDone >= 100 && <Icon name="check" size={14} />} {g.title}
                    </span>
                    <span className="muted small tabular">
                      {fmtVal(value)} / {fmtVal(g.target)}
                    </span>
                    <button className="icon-btn xs" onClick={() => removeGoal(g.id)} title="Eliminar meta">
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${pctDone}%` }} />
                  </div>
                  <div className="muted small">
                    {subj ? `${subj.name} · ` : ''}
                    {PERIOD_LABEL[g.period]}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <h4>Constancia</h4>
            <div className="spacer" />
            <span className="muted small">Minutos de enfoque, últimas {WEEKS} semanas</span>
          </div>
          <div className="heatmap" role="img" aria-label="Mapa de calor de minutos de estudio por día">
            {Array.from({ length: WEEKS }, (_, w) => (
              <div className="heat-col" key={w}>
                {Array.from({ length: 7 }, (_, d) => {
                  const day = addDays(heatStart, w * 7 + d);
                  const key = toKey(day);
                  const m = daily.get(key) ?? 0;
                  const future = day > now;
                  return (
                    <span
                      key={d}
                      className={`heat l${future ? 'x' : level(m)}`}
                      title={`${fmt(day, { weekday: 'short', day: 'numeric', month: 'short' })}: ${formatMinutes(m)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="heat-legend muted small">
            Menos <span className="heat l0" /> <span className="heat l1" /> <span className="heat l2" /> <span className="heat l3" /> <span className="heat l4" /> Más
          </div>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h4>Por materia · {fmt(now, { month: 'long' })}</h4>
          </div>
          {perSubject.length === 0 ? (
            <p className="muted small">Aún no hay sesiones ni Pomodoros este mes. Planifica en el Calendario y elige materia en el Pomodoro.</p>
          ) : (
            <ul className="subject-bars">
              {perSubject.map(({ s, planned, done, focus }) => (
                <li key={s.id}>
                  <span className="subject-dot" style={{ background: s.color }} />
                  <span className="subject-name">{s.name}</span>
                  <div className="bar">
                    <span style={{ width: `${planned ? (done / planned) * 100 : 0}%`, background: s.color }} />
                  </div>
                  <span className="muted small tabular">
                    {done}/{planned} sesiones · {formatMinutes(focus)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function GoalForm({ onDone }: { onDone: () => void }) {
  const subjects = usePlanner((s) => s.subjects);
  const addGoal = usePlanner((s) => s.addGoal);
  const [metric, setMetric] = useState<GoalMetric>('focusMinutes');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [target, setTarget] = useState(10);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');

  const unit = metric === 'focusMinutes' ? 'horas' : 'sesiones';
  const subjName = subjects.find((s) => s.id === subjectId)?.name;
  const autoTitle = `${target} ${unit}${subjName ? ` de ${subjName}` : ''} ${PERIOD_LABEL[period]}`;

  return (
    <form
      className="goal-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (target <= 0) return;
        addGoal({
          title: title.trim() || autoTitle,
          metric,
          period,
          target: metric === 'focusMinutes' ? Math.round(target * 60) : Math.round(target),
          subjectId: subjectId || null,
        });
        onDone();
      }}
    >
      <div className="field-grid">
        <label className="field">
          <span>Medir</span>
          <select className="select" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
            <option value="focusMinutes">Horas de enfoque</option>
            <option value="sessionsDone">Sesiones completadas</option>
          </select>
        </label>
        <label className="field">
          <span>Objetivo ({unit})</span>
          <input className="input" type="number" min={1} step={metric === 'focusMinutes' ? 0.5 : 1} value={target} onChange={(e) => setTarget(parseFloat(e.target.value) || 0)} />
        </label>
        <label className="field">
          <span>Periodo</span>
          <select className="select" value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
            <option value="week">Semanal</option>
            <option value="month">Mensual</option>
            <option value="total">Total</option>
          </select>
        </label>
        <label className="field">
          <span>Materia</span>
          <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <input className="input grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} aria-label="Nombre de la meta" />
        <button className="btn primary" type="submit">
          Crear meta
        </button>
      </div>
    </form>
  );
}
