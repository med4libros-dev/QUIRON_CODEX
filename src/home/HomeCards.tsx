import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { FoldBtn, useFold } from '../components/Fold';
import { topicMastery, weakTopics } from '../analytics/mastery';
import { useDrugs } from '../drugs/store';
import { useExam } from '../exam/store';
import { useCards } from '../flashcards/store';
import { generatePlan } from '../internship/planner';
import { TOPIC, TOPICS } from '../internship/curriculum';
import { useInternship } from '../internship/store';
import { useTopicStore } from '../internship/topicStore';
import { fmt, fromKey, todayKey, weekBounds } from '../lib/date';
import { escapeHtml } from '../lib/html';
import { exportToPdf } from '../lib/exportPdf';
import { focusMinutes } from '../lib/stats';
import { useLogbook } from '../logbook/store';
import { usePlanner } from '../store/planner';
import { useUI } from '../store/ui';

/** Índice estable por día: el mismo fármaco todo el día, otro mañana. */
export function dailyIndex(key: string, n: number) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return n ? h % n : 0;
}

/** Fármaco del día: una de TUS fichas (no trae dosis precargadas), para repasarla en 30 s. */
export function DrugOfDay() {
  const drugs = useDrugs((s) => s.drugs);
  const today = todayKey();
  const [shift, setShift] = useState(0);
  const [open, toggle] = useFold('drug');
  const d = drugs.length ? drugs[(dailyIndex(today, drugs.length) + shift) % drugs.length] : null;
  return (
    <section className="card dod-card">
      <div className="card-head">
        <h4>
          <Icon name="pill" size={15} /> Fármaco del día
        </h4>
        <span className="spacer" />
        {open && drugs.length > 1 && (
          <button className="btn ghost sm" onClick={() => setShift((x) => x + 1)} title="Otro">
            <Icon name="shuffle" size={14} />
          </button>
        )}
        <FoldBtn open={open} onToggle={toggle} label="fármaco del día" />
      </div>
      {!open ? null : d ? (
        <>
          <div className="dod-name">{d.name}</div>
          <div className="muted small">{[d.presentation, d.route, d.frequency].filter(Boolean).join(' · ')}</div>
          <div className="small">
            {d.mgPerKg} mg/kg/{d.basis === 'day' ? `día en ${d.divisions} tomas` : 'dosis'}
            {d.maxMgPerDose ? ` · máx ${d.maxMgPerDose} mg/dosis` : ''}
            {d.maxMgPerDay ? ` · máx ${d.maxMgPerDay} mg/día` : ''}
          </div>
          {d.notes && <div className="muted small dod-notes">{d.notes}</div>}
          <div className="field-row tight">
            <button
              className="btn sm"
              onClick={() =>
                useUI.getState().setCardDraft({
                  topicId: null,
                  front: `${d.name}: ¿dosis, vía y frecuencia?`,
                  back: [
                    `${d.mgPerKg} mg/kg/${d.basis === 'day' ? `día en ${d.divisions} tomas` : 'dosis'}`,
                    d.maxMgPerDose ? `Máx ${d.maxMgPerDose} mg/dosis` : '',
                    d.maxMgPerDay ? `Máx ${d.maxMgPerDay} mg/día` : '',
                    [d.route, d.frequency].filter(Boolean).join(' · '),
                    d.notes,
                    d.source ? `Fuente: ${d.source}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                })
              }
            >
              <Icon name="cards" size={14} /> Hacer flashcard
            </button>
            <button className="btn ghost sm" onClick={() => useUI.getState().openDrugs()}>
              Abrir fichas
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">
          Captura tus fármacos en <button className="linkish" onClick={() => useUI.getState().openDrugs()}>Guardia → Fármacos por peso</button> y aquí te tocará uno cada día.
        </p>
      )}
    </section>
  );
}

interface WeekStats {
  range: [string, string];
  lessons: number;
  minutes: number;
  cards: number;
  exams: number;
  seen: number;
  right: number;
  procs: number;
  cases: number;
  journal: number;
  weak: string[];
  /** Minutos que el plan pedía esta semana (para comparar con lo que de verdad hiciste). */
  planned: number;
  /** Temas que quedaron terminados esta semana. */
  closed: string[];
  /** Lecciones que el modo supervivencia movió y cayeron en esta semana. */
  moved: number;
}

export function useWeekStats(): WeekStats {
  const done = useInternship((s) => s.done);
  const logs = usePlanner((s) => s.logs);
  const cards = useCards((s) => s.cards);
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const entries = useLogbook((s) => s.entries);
  const journal = useLogbook((s) => s.journal);
  const info = useTopicStore((s) => s.info);
  const config = useInternship((s) => s.config);
  const shifts = useInternship((s) => s.shifts);
  return useMemo(() => {
    const range = weekBounds(new Date());
    const inR = (k?: string) => !!k && k >= range[0] && k <= range[1];
    const byId = new Map(questions.map((q) => [q.id, q]));
    let seen = 0;
    let right = 0;
    const weekAtt = attempts.filter((a) => inR(a.date));

    // Lo que el plan pedía esta semana y qué temas quedaron cerrados.
    let planned = 0;
    const closed: string[] = [];
    if (config) {
      const plan = generatePlan(config, TOPICS);
      const byTopic = new Map<string, { ids: string[]; last: string }>();
      for (const [k, day] of plan.days) {
        for (const l of day.lessons) {
          if (inR(k)) planned += l.minutes;
          const e = byTopic.get(l.topicId) ?? { ids: [], last: '' };
          e.ids.push(l.id);
          byTopic.set(l.topicId, e);
        }
      }
      for (const [topicId, e] of byTopic) {
        const dates = e.ids.map((id) => done[id]);
        // Cerrado = todas sus lecciones hechas, y la última cayó dentro de esta semana.
        if (dates.every(Boolean) && inR(dates.sort().at(-1))) closed.push(topicId);
      }
    }
    for (const a of weekAtt)
      a.questionIds.forEach((id, i) => {
        const q = byId.get(id);
        if (!q || a.answers[i] === null) return;
        seen++;
        if (a.answers[i] === q.correct) right++;
      });
    return {
      range,
      lessons: Object.values(done).filter(inR).length,
      minutes: focusMinutes(logs, range),
      cards: cards.filter((c) => inR(c.lastReview)).length,
      exams: weekAtt.length,
      seen,
      right,
      procs: entries.filter((e) => inR(e.date)).length,
      cases: Object.values(info).reduce((n, i) => n + i.cases.filter((c) => inR(c.date)).length, 0),
      journal: journal.filter((j) => inR(j.date)).length,
      weak: weakTopics(topicMastery(cards, questions, attempts), 3),
      planned,
      closed,
      moved: Object.values(shifts).filter(inR).length,
    };
  }, [done, logs, cards, questions, attempts, entries, journal, info, config, shifts]);
}

export function weekSummaryHtml(w: WeekStats): string {
  const pct = w.seen ? Math.round((w.right / w.seen) * 100) : null;
  const row = (k: string, v: string) => `<li><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</li>`;
  return (
    `<h3>Lo que hiciste</h3><ul>` +
    row('Lecciones completadas', String(w.lessons)) +
    row('Minutos de estudio enfocado', w.planned ? `${w.minutes} de ${w.planned} planeados (${Math.round((w.minutes / w.planned) * 100)} %)` : String(w.minutes)) +
    row('Temas cerrados', w.closed.length ? w.closed.map((id) => TOPIC[id]?.title ?? id).join(', ') : 'Ninguno') +
    (w.moved ? row('Pendientes que se movieron a esta semana', String(w.moved)) : '') +
    row('Flashcards repasadas', String(w.cards)) +
    row('Simulacros', `${w.exams}${pct !== null ? ` · ${w.right}/${w.seen} aciertos (${pct}%)` : ''}`) +
    row('Procedimientos registrados', String(w.procs)) +
    row('Casos vistos', String(w.cases)) +
    row('Entradas del diario', String(w.journal)) +
    `</ul><h3>Para la próxima semana</h3><ul>` +
    (w.weak.length ? w.weak.map((id) => `<li>Reforzar: ${escapeHtml(TOPIC[id]?.title ?? id)}</li>`).join('') : '<li>Sin temas débiles detectados.</li>') +
    `</ul>`
  );
}

/** Resumen semanal: se destaca el domingo y se exporta a PDF. */
export function WeeklySummary() {
  const w = useWeekStats();
  const sunday = new Date().getDay() === 0;
  const [open, setOpen] = useState(sunday);
  const [busy, setBusy] = useState(false);
  const pct = w.seen ? Math.round((w.right / w.seen) * 100) : null;
  const label = `${fmt(fromKey(w.range[0]), { day: 'numeric', month: 'short' })} – ${fmt(fromKey(w.range[1]), { day: 'numeric', month: 'short' })}`;
  return (
    <section className={`card week-card${sunday ? ' sunday' : ''}`}>
      <div className="card-head">
        <h4>{sunday ? 'Resumen del domingo' : 'Tu semana'}</h4>
        <span className="muted small">{label}</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      {open && (
        <>
          <div className="week-grid">
            <span>
              <b className="tabular">{w.lessons}</b> lecciones
            </span>
            <span title={w.planned ? `El plan pedía ${w.planned} min esta semana` : undefined}>
              <b className="tabular">{w.minutes}</b> min enfocado{w.planned ? ` de ${w.planned}` : ''}
            </span>
            <span>
              <b className="tabular">{w.closed.length}</b> tema{w.closed.length === 1 ? '' : 's'} cerrado{w.closed.length === 1 ? '' : 's'}
            </span>
            <span>
              <b className="tabular">{w.cards}</b> flashcards
            </span>
            <span>
              <b className="tabular">{pct === null ? '—' : `${pct}%`}</b> en {w.exams} simulacro{w.exams === 1 ? '' : 's'}
            </span>
            <span>
              <b className="tabular">{w.procs}</b> procedimientos
            </span>
            <span>
              <b className="tabular">{w.cases}</b> casos
            </span>
          </div>
          {w.closed.length > 0 && <p className="small muted">Cerraste: {w.closed.map((id) => TOPIC[id]?.title ?? id).join(' · ')}</p>}
          {w.moved > 0 && (
            <p className="small muted">
              {w.moved} pendiente{w.moved === 1 ? '' : 's'} que habías movido cayó{w.moved === 1 ? '' : 'eron'} en esta semana.
            </p>
          )}
          {w.weak.length > 0 && <p className="small muted">Refuerza: {w.weak.map((id) => TOPIC[id]?.title).join(' · ')}</p>}
          <button
            className="btn sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await exportToPdf({ title: `Resumen semanal · ${label}`, subtitle: 'Quirón Codex', html: weekSummaryHtml(w) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="download" size={14} /> Exportar PDF
          </button>
        </>
      )}
    </section>
  );
}
