import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { SPECIALTY, TOPIC } from '../internship/curriculum';
import type { SpecialtyId } from '../internship/types';
import { fromKey } from '../lib/date';
import { useExam, type Attempt, type Question } from './store';

/**
 * Historial de simulacros: cómo vienes intento a intento y en qué especialidad fallas.
 * Todo sale de los intentos guardados; no hay números inventados ni promedios de nadie más.
 */
export function History({ onRetry }: { onRetry: (ids: string[], title: string) => void }) {
  const attempts = useExam((s) => s.attempts);
  const questions = useExam((s) => s.questions);
  const [open, setOpen] = useState<string | null>(null);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const scored = useMemo(
    () =>
      attempts
        .map((a) => {
          const right = a.questionIds.filter((id, i) => byId.get(id)?.correct === a.answers[i]).length;
          const answered = a.answers.filter((x) => x !== null).length;
          return { a, right, answered, pct: a.questionIds.length ? Math.round((right / a.questionIds.length) * 100) : 0 };
        })
        .sort((x, y) => x.a.date.localeCompare(y.a.date)),
    [attempts, byId],
  );

  /** Aciertos por especialidad, sumando todos los intentos. */
  const bySpec = useMemo(() => {
    const m = new Map<SpecialtyId, { seen: number; right: number }>();
    for (const { a } of scored) {
      a.questionIds.forEach((id, i) => {
        const q = byId.get(id);
        const sp = q?.topicId ? TOPIC[q.topicId]?.specialty : null;
        if (!q || !sp || a.answers[i] === null) return;
        const e = m.get(sp) ?? { seen: 0, right: 0 };
        e.seen++;
        if (a.answers[i] === q.correct) e.right++;
        m.set(sp, e);
      });
    }
    return [...m.entries()].map(([id, v]) => ({ id, ...v, pct: Math.round((v.right / v.seen) * 100) })).sort((a, b) => a.pct - b.pct);
  }, [scored, byId]);

  if (!attempts.length)
    return <p className="muted small">Todavía no has hecho ningún simulacro. Cuando termines uno, aquí verás cómo vienes.</p>;

  const last = scored.slice(-20);
  const h = 54;
  const step = last.length > 1 ? 100 / (last.length - 1) : 0;
  const line = last.map((s, i) => `${i * step},${h - (s.pct / 100) * h}`).join(' ');
  const avg = Math.round(scored.reduce((n, s) => n + s.pct, 0) / scored.length);
  // Con pocos intentos se compara el último contra el primero; con cuatro o más, las tres medias.
  const n = scored.length >= 4 ? 3 : 1;
  const avgOf = (xs: typeof scored) => xs.reduce((t, s) => t + s.pct, 0) / xs.length;
  const trend = scored.length >= 2 ? Math.round(avgOf(scored.slice(-n)) - avgOf(scored.slice(0, n))) : null;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h4>Cómo vienes</h4>
          <span className="spacer" />
          <span className="muted small tabular">
            {scored.length} simulacro{scored.length === 1 ? '' : 's'} · {avg} % de media
            {trend !== null && (
              <>
                {' · '}
                <b className={trend >= 0 ? 'ok-text' : 'error'}>
                  {trend >= 0 ? '+' : ''}
                  {trend} pts
                </b>{' '}
                {scored.length >= 4 ? 'vs. tus primeros' : 'vs. el primero'}
              </>
            )}
          </span>
        </div>
        {last.length > 1 && (
          <svg className="trend" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" role="img" aria-label={`Tendencia de aciertos: ${last.map((s) => `${s.pct}%`).join(', ')}`}>
            <line x1="0" y1={h - (60 / 100) * h} x2="100" y2={h - (60 / 100) * h} className="trend-goal" />
            <polyline points={line} className="trend-line" />
            {last.map((s, i) => (
              <circle key={s.a.id} cx={i * step} cy={h - (s.pct / 100) * h} r="1.4" className="trend-dot" />
            ))}
          </svg>
        )}
        <p className="muted small">La línea punteada marca el 60 % (el punto de corte orientativo del ENARM varía cada año).</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h4>Por especialidad</h4>
          <span className="spacer" />
          <span className="muted small">De peor a mejor</span>
        </div>
        <ul className="spec-bars">
          {bySpec.map((s) => (
            <li key={s.id}>
              <span className="ellipsis">{SPECIALTY[s.id]?.name ?? s.id}</span>
              <span className="bar" aria-hidden="true">
                <i style={{ width: `${s.pct}%` }} data-low={s.pct < 60 ? '1' : undefined} />
              </span>
              <b className="tabular small">{s.pct} %</b>
              <span className="muted small tabular">{s.seen}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h4>Intentos</h4>
        </div>
        <ul className="attempt-list">
          {[...scored].reverse().map(({ a, right, answered, pct }) => {
            const wrong = a.questionIds.filter((id, i) => a.answers[i] !== null && byId.get(id)?.correct !== a.answers[i]);
            return (
              <li key={a.id} className="attempt-row">
                <button className="attempt-main" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
                  <span className="ellipsis">{a.title}</span>
                  <span className="muted small tabular">{fromKey(a.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                  <b className="tabular">{pct} %</b>
                </button>
                {open === a.id && (
                  <div className="attempt-detail small muted">
                    {right} de {a.questionIds.length} correctas · {answered} respondidas · {Math.round(a.seconds / 60)} min ·{' '}
                    {answered ? Math.round(a.seconds / answered) : 0} s por pregunta
                    {wrong.length > 0 && (
                      <button className="btn ghost sm" onClick={() => onRetry(wrong, `Falladas · ${a.title}`)}>
                        <Icon name="undo" size={14} /> Repetir las {wrong.length} falladas
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

/** Preguntas falladas en los últimos intentos, para un simulacro de refuerzo. */
export function missedIds(attempts: Attempt[], questions: Question[], max = 40): string[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const out: string[] = [];
  for (const a of attempts) {
    a.questionIds.forEach((id, i) => {
      const q = byId.get(id);
      if (q && a.answers[i] !== null && a.answers[i] !== q.correct && !out.includes(id)) out.push(id);
    });
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}
