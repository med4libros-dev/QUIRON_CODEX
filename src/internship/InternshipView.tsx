import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { WEEKDAYS, addDays, addMonths, fmt, formatMinutes, fromKey, startOfMonth, startOfWeek, toKey, todayKey } from '../lib/date';
import { SPECIALTIES, SPECIALTY, TOPIC, TOPICS, gpcSearchUrl } from './curriculum';
import { openTopicNote } from './openLesson';
import { applyAdjustments, diffDays, generatePlan, survivalMoves, type PlanResult } from './planner';
import { SetupWizard } from './SetupWizard';
import { useInternship } from './store';
import { useTopicStore } from './topicStore';
import { dueCards, useCards } from '../flashcards/store';
import { TopicSelect, expressDeck } from '../flashcards/FlashcardUI';
import { CasesTab } from '../features/topics/TopicSheet';
import { Modal } from '../components/Modal';
import { useUI } from '../store/ui';
import type { DayPlan, InternshipConfig, Lesson } from './types';

const KIND_LABEL = { new: 'Tema nuevo', review: 'Repaso espaciado', final: 'Repaso integral' } as const;

/** Inicio: el «centro de mando» del internado. */
export function InternshipView() {
  const config = useInternship((s) => s.config);
  const [editing, setEditing] = useState(false);
  if (!config) return <SetupWizard />;
  if (editing) return <SetupWizard initial={config} onDone={() => setEditing(false)} />;
  return <Dashboard config={config} onEdit={() => setEditing(true)} />;
}

function Dashboard({ config, onEdit }: { config: InternshipConfig; onEdit: () => void }) {
  const done = useInternship((s) => s.done);
  const toggleDone = useInternship((s) => s.toggleDone);
  const shifts = useInternship((s) => s.shifts);
  const survival = useInternship((s) => s.survival);
  const basePlan = useMemo(() => generatePlan(config, TOPICS), [config]);
  // El plan anual no se regenera: los ajustes (Modo supervivencia) se superponen.
  const plan = useMemo(() => applyAdjustments(basePlan, shifts), [basePlan, shifts]);
  const cards = useCards((s) => s.cards);
  const due = dueCards(cards);
  const info = useTopicStore((s) => s.info);
  const recentCases = useMemo(
    () =>
      Object.entries(info)
        .flatMap(([topicId, i]) => i.cases.map((c) => ({ ...c, topicId })))
        .sort((a, b) => b.createdAt - a.createdAt),
    [info],
  );
  const [caseOpen, setCaseOpen] = useState(false);
  const today = todayKey();
  const clamp = (k: string) => (k < config.start ? config.start : k > config.end ? config.end : k);
  const [selected, setSelected] = useState(() => clamp(today));
  const [month, setMonth] = useState(() => startOfMonth(fromKey(clamp(today))));
  const [showAllOverdue, setShowAllOverdue] = useState(false);

  const dayIndex = diffDays(config.start, today) + 1;
  const total = plan.keys.length;
  const todayPlan = plan.days.get(today);
  const rotation = todayPlan?.rotation ? config.rotations.find((r) => today >= r.start && today <= r.end) : undefined;
  const selectedPlan = plan.days.get(selected);

  // Progreso del temario: un tema cuenta cuando todas sus partes están hechas.
  const topicDone = (id: string) => {
    const parts = plan.topicParts.get(id) ?? 0;
    if (!parts) return false;
    for (let p = 1; p <= parts; p++) if (!done[`${id}:${p}`]) return false;
    return true;
  };
  const doneTopics = TOPICS.filter((t) => topicDone(t.id));
  const bySpecialty = SPECIALTIES.map((s) => {
    const all = TOPICS.filter((t) => t.specialty === s.id);
    return { s, all: all.length, done: all.filter((t) => topicDone(t.id)).length };
  });

  // Pendientes: temas nuevos de días pasados sin marcar (últimos 21 días).
  const overdue: { date: string; lesson: Lesson }[] = [];
  for (let i = 21; i >= 1; i--) {
    const k = toKey(addDays(fromKey(today), -i));
    for (const l of plan.days.get(k)?.lessons ?? []) if (l.kind === 'new' && !done[l.id]) overdue.push({ date: k, lesson: l });
  }

  const next7 = Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(today), i + 1))).filter((k) => plan.days.has(k));
  const status =
    today < config.start
      ? `Tu internado empieza en ${diffDays(today, config.start)} días`
      : today > config.end
        ? 'Internado concluido'
        : `Día ${dayIndex} de ${total}`;

  return (
    <div className="page intern">
      <header className="page-head">
        <div>
          <h2 className="page-title">Internado</h2>
          <div className="intern-status">
            <span className="chip">{status}</span>
            {rotation && (
              <span className="chip" style={{ '--chip': SPECIALTY[rotation.specialty].color } as CSSProperties}>
                <i /> {SPECIALTY[rotation.specialty].name} · semana {Math.floor(diffDays(rotation.start, today) / 7) + 1} de{' '}
                {Math.ceil((diffDays(rotation.start, rotation.end) + 1) / 7)}
              </span>
            )}
            {todayPlan?.guardia && <span className="chip warn">Guardia hoy</span>}
            {todayPlan?.postGuardia && <span className="chip">Postguardia · carga reducida</span>}
          </div>
        </div>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => useUI.getState().setTemarioOpen(true)}>
          <Icon name="list" size={16} /> Temario
        </button>
        <button className="btn ghost" onClick={() => useUI.getState().setGuardQuickOpen(true)}>
          <Icon name="shield" size={16} /> Vista de Guardia
        </button>
        <button className="btn ghost" onClick={onEdit}>
          <Icon name="settings" size={16} /> Ajustar plan
        </button>
      </header>

      <div className="intern-grid">
        <div className="intern-main">
          {survival[selected] ? (
            <SurvivalCard date={selected} isToday={selected === today} plan={plan} moved={survival[selected]} shifts={shifts} />
          ) : (
            <DayCard
              plan={selectedPlan}
              date={selected}
              isToday={selected === today}
              done={done}
              onToggle={(id) => toggleDone(id, today)}
              onBackToToday={selected !== today && plan.days.has(today) ? () => setSelected(today) : undefined}
              onSurvival={
                selected === today && selectedPlan && !selectedPlan.guardia && selectedPlan.lessons.some((l) => !done[l.id])
                  ? () => {
                      const st = useInternship.getState();
                      const moves = survivalMoves(plan, today, st.done, st.survival);
                      st.activateSurvival(today, moves);
                      const n = Object.keys(moves).length;
                      useUI.getState().showToast(`Modo supervivencia: ${n} lección${n === 1 ? '' : 'es'} reprogramada${n === 1 ? '' : 's'}. Hoy solo 10 min de flashcards.`);
                    }
                  : undefined
              }
            />
          )}

          {overdue.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h4>Pendientes</h4>
                <span className="muted small">{overdue.length} de las últimas 3 semanas</span>
                <span className="spacer" />
                <button
                  className="btn ghost sm"
                  onClick={() => overdue.forEach(({ lesson }) => toggleDone(lesson.id, today))}
                  title="Marcar todas las pendientes como estudiadas"
                >
                  <Icon name="check" size={14} /> Ya las estudié
                </button>
              </div>
              <ul className="lesson-list compact">
                {(showAllOverdue ? overdue : overdue.slice(0, 5)).map(({ date, lesson }) => (
                  <LessonRow key={lesson.id} lesson={lesson} done={false} onToggle={() => toggleDone(lesson.id, today)} note={fmt(fromKey(date), { weekday: 'short', day: 'numeric' })} />
                ))}
              </ul>
              {overdue.length > 5 && (
                <button className="btn ghost sm more-btn" onClick={() => setShowAllOverdue((v) => !v)}>
                  {showAllOverdue ? 'Mostrar menos' : `Mostrar ${overdue.length - 5} más`}
                </button>
              )}
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h4>Próximos días</h4>
            </div>
            <ul className="next-list">
              {next7.map((k) => {
                const d = plan.days.get(k)!;
                const mins = d.lessons.reduce((a, l) => a + l.minutes, 0);
                const firstNew = d.lessons.find((l) => l.kind === 'new');
                return (
                  <li key={k}>
                    <button
                      onClick={() => {
                        setSelected(k);
                        setMonth(startOfMonth(fromKey(k)));
                      }}
                    >
                      <span className="next-date">{fmt(fromKey(k), { weekday: 'short', day: 'numeric' })}</span>
                      <span className="next-topic ellipsis">{d.guardia ? 'Guardia · repaso breve' : firstNew ? TOPIC[firstNew.topicId].title : d.lessons.length ? 'Repasos' : 'Libre'}</span>
                      <span className="muted small tabular">{mins ? formatMinutes(mins) : '—'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="intern-side">
          <section className="card fc-card">
            <div className="card-head">
              <h4>Flashcards</h4>
              <span className="spacer" />
              <span className="muted small tabular">{cards.length} en total</span>
            </div>
            <div className="fc-due">
              <b className="tabular">{due.length}</b>
              <span className="muted">{due.length === 1 ? 'toca hoy' : 'tocan hoy'}</span>
              <span className="spacer" />
              <button
                className="btn primary sm"
                disabled={!due.length}
                onClick={() => useUI.getState().startReview({ cardIds: due.map((c) => c.id), title: 'Repaso de hoy' })}
              >
                <Icon name="play" size={14} /> Repasar
              </button>
            </div>
            {!cards.length && <p className="muted small">Selecciona texto en una GPC y elige «Flashcard».</p>}
          </section>
          <section className="card">
            <div className="card-head">
              <h4>Casos vistos</h4>
              <span className="muted small tabular">{recentCases.length}</span>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => setCaseOpen(true)}>
                <Icon name="plus" size={14} /> Registrar
              </button>
            </div>
            {recentCases.length ? (
              <ul className="case-mini">
                {recentCases.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => useUI.getState().openTopic(c.topicId, 'cases')}>
                      <span className="muted small">{TOPIC[c.topicId]?.title}</span>
                      <span className="ellipsis">
                        {c.patient} · {c.finding}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Tu bitácora de pacientes reales (anónima): 3 líneas por caso, ligadas al tema.</p>
            )}
          </section>
          <MonthCalendar
            month={month}
            setMonth={setMonth}
            plan={plan}
            config={config}
            selected={selected}
            today={today}
            done={done}
            survival={survival}
            onPick={(k) => setSelected(k)}
          />
          <section className="card">
            <div className="card-head">
              <h4>Rotaciones</h4>
            </div>
            <div className="timeline">
              {config.rotations.map((r) => {
                const days = diffDays(r.start, r.end) + 1;
                const active = today >= r.start && today <= r.end;
                return (
                  <div
                    key={r.id}
                    className={`tl-seg${active ? ' active' : ''}`}
                    style={{ flexGrow: days, background: SPECIALTY[r.specialty].color }}
                    title={`${SPECIALTY[r.specialty].name}: ${fmt(fromKey(r.start), { day: 'numeric', month: 'short' })} – ${fmt(fromKey(r.end), { day: 'numeric', month: 'short' })}`}
                  >
                    {SPECIALTY[r.specialty].short}
                  </div>
                );
              })}
              {today >= config.start && today <= config.end && (
                <span className="tl-now" style={{ left: `${((dayIndex - 0.5) / total) * 100}%` }} title="Hoy" />
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <h4>Temario</h4>
              <span className="spacer" />
              <b className="tabular">
                {doneTopics.length}/{TOPICS.length}
              </b>
            </div>
            <div className="bar big">
              <span style={{ width: `${(doneTopics.length / TOPICS.length) * 100}%` }} />
            </div>
            <ul className="spec-bars">
              {bySpecialty.map(({ s, all, done: d }) => (
                <li key={s.id}>
                  <span className="spec-name">{s.name}</span>
                  <div className="bar">
                    <span style={{ width: `${(d / all) * 100}%`, background: s.color }} />
                  </div>
                  <span className="muted small tabular">
                    {d}/{all}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      {caseOpen && <CaseQuick defaultTopic={todayPlan?.lessons[0]?.topicId ?? null} onClose={() => setCaseOpen(false)} />}
    </div>
  );
}

function CaseQuick({ defaultTopic, onClose }: { defaultTopic: string | null; onClose: () => void }) {
  const [topicId, setTopicId] = useState<string | null>(defaultTopic);
  return (
    <Modal title="Registrar caso visto" onClose={onClose} width={560}>
      <label className="field">
        <span>Tema</span>
        <TopicSelect value={topicId} onChange={setTopicId} allowNone={false} />
      </label>
      {topicId ? <CasesTab topicId={topicId} /> : <p className="muted">Elige el tema del caso.</p>}
    </Modal>
  );
}

function SurvivalCard({
  date,
  isToday,
  plan,
  moved,
  shifts,
}: {
  date: string;
  isToday: boolean;
  plan: PlanResult;
  moved: string[];
  shifts: Record<string, string>;
}) {
  const cards = useCards((s) => s.cards);
  const undo = useInternship((s) => s.undoSurvival);
  const lessons = useMemo(() => {
    const out: { lesson: Lesson; to: string }[] = [];
    for (const id of moved) {
      const to = shifts[id];
      const l = plan.days.get(to)?.lessons.find((x) => x.id === id);
      if (l) out.push({ lesson: l, to });
    }
    return out.sort((a, b) => (a.to < b.to ? -1 : 1));
  }, [moved, shifts, plan]);
  const deck = expressDeck(cards);
  return (
    <section className="card day-card survival">
      <div className="card-head">
        <div>
          <h4>Modo supervivencia</h4>
          <div className="day-title">{fmt(fromKey(date), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => undo(date)} title="Devolver las lecciones a este día">
          <Icon name="undo" size={14} /> Deshacer
        </button>
      </div>
      <p className="survival-msg">
        Lectura pesada suspendida{isToday ? ' por hoy' : ''}. Solo una sesión exprés de 10 minutos y a descansar: dormir también es estudiar.
      </p>
      <button
        className="btn primary big"
        disabled={!deck.length}
        onClick={() => useUI.getState().startReview({ cardIds: deck, title: 'Sesión exprés · 10 min', minutes: 10 })}
      >
        <Icon name="play" size={16} /> Flashcards exprés · 10 min
      </button>
      {!deck.length && <p className="muted small">Aún no tienes flashcards: hoy solo descansa.</p>}
      {lessons.length > 0 && (
        <>
          <h5 className="ts-h">Reprogramadas sin tocar el resto del año</h5>
          <ul className="moved-list">
            {lessons.map(({ lesson, to }) => (
              <li key={lesson.id}>
                <span className="ellipsis">{TOPIC[lesson.topicId].title}</span>
                <span className="muted small">
                  {KIND_LABEL[lesson.kind]} · {lesson.minutes} min
                </span>
                <span className="chip">→ {fmt(fromKey(to), { weekday: 'short', day: 'numeric' })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function DayCard({
  plan,
  date,
  isToday,
  done,
  onToggle,
  onBackToToday,
  onSurvival,
}: {
  plan?: DayPlan;
  date: string;
  isToday: boolean;
  done: Record<string, string>;
  onToggle: (id: string) => void;
  onBackToToday?: () => void;
  onSurvival?: () => void;
}) {
  const lessons = plan?.lessons ?? [];
  const mins = lessons.reduce((a, l) => a + l.minutes, 0);
  const doneMins = lessons.filter((l) => done[l.id]).reduce((a, l) => a + l.minutes, 0);
  const first = lessons.find((l) => l.kind === 'new' && !done[l.id]) ?? lessons.find((l) => !done[l.id]);
  return (
    <section className="card day-card">
      <div className="card-head">
        <div>
          <h4>{isToday ? 'Lección de hoy' : 'Lección del día'}</h4>
          <div className="day-title">{fmt(fromKey(date), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
        <span className="spacer" />
        {onBackToToday && (
          <button className="btn ghost sm" onClick={onBackToToday}>
            Volver a hoy
          </button>
        )}
        {onSurvival && (
          <button className="btn survival-btn" onClick={onSurvival} title="Suspende la lectura de hoy, reprograma lo pendiente en tus días libres y deja solo 10 min de flashcards">
            <Icon name="battery" size={15} /> Hoy no doy más<span className="hide-narrow"> / Postguardia</span>
          </button>
        )}
        {first && (
          <button className="btn primary" onClick={() => openTopicNote(TOPIC[first.topicId], { prefer: first.kind === 'new' ? 'GER' : 'GRR' })}>
            <Icon name="play" size={15} /> Empezar
          </button>
        )}
      </div>
      {plan?.guardia && <p className="guardia-note">Día de guardia: solo repasos breves. Descansa cuando puedas.</p>}
      {lessons.length > 0 ? (
        <>
          <div className="day-progress">
            <div className="bar">
              <span style={{ width: `${mins ? (doneMins / mins) * 100 : 0}%` }} />
            </div>
            <span className="muted small tabular">
              {formatMinutes(doneMins)} de {formatMinutes(mins)}
            </span>
          </div>
          <ul className="lesson-list">
            {lessons.map((l) => (
              <LessonRow key={l.id} lesson={l} done={!!done[l.id]} onToggle={() => onToggle(l.id)} />
            ))}
          </ul>
        </>
      ) : (
        <p className="muted">{plan ? 'Día libre: no hay lecciones programadas.' : 'Fuera del periodo del internado.'}</p>
      )}
    </section>
  );
}

function LessonRow({ lesson, done, onToggle, note }: { lesson: Lesson; done: boolean; onToggle: () => void; note?: string }) {
  const t = TOPIC[lesson.topicId];
  const atts = useTopicStore((s) => s.info[lesson.topicId]?.attachments);
  const kinds = new Set((atts ?? []).map((a) => a.kind));
  const sp = SPECIALTY[t.specialty];
  const detail =
    lesson.kind === 'new'
      ? lesson.parts > 1
        ? `Parte ${lesson.part} de ${lesson.parts}`
        : 'Tema completo'
      : lesson.kind === 'review'
        ? `Repaso ${lesson.part} de ${lesson.parts}`
        : 'Repaso integral';
  return (
    <li className={`lesson${done ? ' done' : ''} kind-${lesson.kind}`} style={{ '--sp': sp.color } as CSSProperties}>
      <button className="lesson-check" onClick={onToggle} aria-pressed={done} aria-label={done ? 'Marcar como pendiente' : 'Marcar como hecha'}>
        {done && <Icon name="check" size={14} />}
      </button>
      <div className="lesson-body">
        <button className="lesson-title" onClick={() => useUI.getState().openTopic(t.id, 'docs')} title="Ficha del tema: GPC, guardia, casos y flashcards">
          <span className="sp-tag">{sp.short}</span>
          {t.title}
          {kinds.has('GRR') && <span className="badge grr">GRR</span>}
          {kinds.has('GER') && <span className="badge ger">GER</span>}
        </button>
        <div className="lesson-meta">
          {KIND_LABEL[lesson.kind]} · {detail} · {lesson.minutes} min
          {t.yield === 3 && <span className="hy"> · Prioridad alta</span>}
          {note && <span> · {note}</span>}
          {lesson.movedFrom && <span> · reprogramada del {fmt(fromKey(lesson.movedFrom), { weekday: 'short', day: 'numeric' })}</span>}
        </div>
      </div>
      <a className="btn ghost sm" href={gpcSearchUrl(t)} target="_blank" rel="noopener noreferrer" title="Buscar la GPC en sitios oficiales">
        GPC <Icon name="external" size={13} />
      </a>
      <button className="btn sm" onClick={() => openTopicNote(t, { prefer: lesson.kind === 'new' ? 'GER' : 'GRR' })} title="Abrir apuntes del tema (y su GPC, si la adjuntaste) en Estudio">
        Estudiar
      </button>
    </li>
  );
}

function MonthCalendar({
  month,
  setMonth,
  plan,
  config,
  selected,
  today,
  done,
  survival,
  onPick,
}: {
  survival: Record<string, string[]>;
  month: Date;
  setMonth: (d: Date) => void;
  plan: PlanResult;
  config: InternshipConfig;
  selected: string;
  today: string;
  done: Record<string, string>;
  onPick: (k: string) => void;
}) {
  const start = startOfWeek(month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const canPrev = toKey(addMonths(month, -1)) >= toKey(startOfMonth(fromKey(config.start)));
  const canNext = toKey(addMonths(month, 1)) <= config.end;
  return (
    <section className="card mini-cal">
      <div className="card-head">
        <button className="icon-btn xs" onClick={() => setMonth(addMonths(month, -1))} disabled={!canPrev} aria-label="Mes anterior">
          <Icon name="chevronLeft" size={15} />
        </button>
        <h4 className="cal-title">{fmt(month, { month: 'long', year: 'numeric' })}</h4>
        <button className="icon-btn xs" onClick={() => setMonth(addMonths(month, 1))} disabled={!canNext} aria-label="Mes siguiente">
          <Icon name="chevronRight" size={15} />
        </button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd">
            {w[0]}
          </span>
        ))}
        {cells.map((d) => {
          const k = toKey(d);
          const p = plan.days.get(k);
          const out = d.getMonth() !== month.getMonth();
          const complete = !!p && p.lessons.length > 0 && p.lessons.every((l) => done[l.id]);
          return (
            <button
              key={k}
              className={`cal-cell${out ? ' out' : ''}${k === today ? ' today' : ''}${k === selected ? ' sel' : ''}${p ? '' : ' off'}${complete ? ' complete' : ''}`}
              style={p?.rotation ? ({ '--rot': SPECIALTY[p.rotation].color } as CSSProperties) : undefined}
              onClick={() => p && onPick(k)}
              disabled={!p}
              title={p ? `${p.guardia ? 'Guardia · ' : ''}${p.lessons.length} lecciones` : undefined}
            >
              <span>{d.getDate()}</span>
              {p?.guardia && <i className="g-dot" />}
              {survival[k] && <i className="s-dot" title="Modo supervivencia" />}
            </button>
          );
        })}
      </div>
      <div className="cal-legend muted small">
        <span>
          <i className="g-dot" /> Guardia
        </span>
        <span>
          <i className="c-dot" /> Día completado
        </span>
        {Object.keys(survival).length > 0 && (
          <span>
            <i className="s-dot" /> Supervivencia
          </span>
        )}
      </div>
    </section>
  );
}
