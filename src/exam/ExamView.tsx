import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { useCards } from '../flashcards/store';
import { SPECIALTIES, SPECIALTY, TOPIC } from '../internship/curriculum';
import { useInternship } from '../internship/store';
import { addDays, fromKey, toKey, todayKey } from '../lib/date';
import { downloadBlob } from '../lib/exportPdf';
import { openPdfPage } from '../store/navigate';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { topicMastery, weakTopics } from '../analytics/mastery';
import { generateQuestions } from './generate';
import { questionStats, useExam, type Question } from './store';

const LETTERS = 'ABCDEF';
type Source = 'week' | 'weak' | 'pick' | 'all';

/** Temas que estudiaste en los últimos 7 días (lecciones marcadas como hechas). */
function topicsThisWeek(done: Record<string, string>): string[] {
  const since = toKey(addDays(fromKey(todayKey()), -7));
  const set = new Set<string>();
  for (const [id, date] of Object.entries(done)) if (date >= since) set.add(id.split(':')[0]);
  return [...set].filter((t) => TOPIC[t]);
}

/** Vista «Simulacros»: banco de casos tipo ENARM, generación con IA desde tu GPC y bloques cronometrados. */
export function ExamView() {
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const done = useInternship((s) => s.done);
  const cards = useCards((s) => s.cards);
  const [source, setSource] = useState<Source>('week');
  const [picked, setPicked] = useState<string[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [count, setCount] = useState(20);
  const [mode, setMode] = useState<'exam' | 'study'>('exam');
  const [run, setRun] = useState<{ ids: string[]; title: string; minutes: number; mode: 'exam' | 'study' } | null>(null);
  const [tab, setTab] = useState<'block' | 'bank' | 'gen'>('block');

  const week = useMemo(() => topicsThisWeek(done), [done]);
  const weak = useMemo(() => weakTopics(topicMastery(cards, questions, attempts), 8), [cards, questions, attempts]);
  const topicsFor = (s: Source) => (s === 'week' ? week : s === 'weak' ? weak : s === 'pick' ? picked : null);
  const pool = useMemo(() => {
    const ts = topicsFor(source);
    return questions.filter((q) => (ts === null ? true : q.topicId !== null && ts.includes(q.topicId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, source, week, weak, picked]);
  const stats = useMemo(() => questionStats(attempts, questions), [attempts, questions]);
  const recent = attempts.slice(0, 10);
  const recentPct = (() => {
    let seen = 0;
    let right = 0;
    const byId = new Map(questions.map((q) => [q.id, q]));
    for (const a of recent)
      a.questionIds.forEach((id, i) => {
        const q = byId.get(id);
        if (!q || a.answers[i] === null) return;
        seen++;
        if (a.answers[i] === q.correct) right++;
      });
    return seen ? Math.round((right / seen) * 100) : null;
  })();

  const start = () => {
    // Prioridad: nunca vistas → falladas la última vez → el resto; luego al azar dentro de cada grupo.
    const rank = (q: Question) => {
      const s = stats.get(q.id);
      return !s ? 0 : !s.last ? 1 : 2;
    };
    const ids = [...pool]
      .map((q) => ({ q, r: rank(q), k: Math.random() }))
      .sort((a, b) => a.r - b.r || a.k - b.k)
      .slice(0, count)
      .map((x) => x.q.id);
    if (!ids.length) return;
    const label = source === 'week' ? 'Lo de esta semana' : source === 'weak' ? 'Temas débiles' : source === 'pick' ? 'Temas elegidos' : 'Todo el banco';
    setRun({ ids, title: `Simulacro · ${label}`, minutes: Math.max(5, ids.length), mode });
  };

  const pending = questions.filter((q) => !q.reviewed).length;

  return (
    <div className="page exam-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Simulacros ENARM</h2>
          <p className="muted small">Casos clínicos con distractores, generados de tus GPC y con la página que sustenta cada respuesta.</p>
        </div>
        <div className="spacer" />
        <div className="exam-kpis">
          <span>
            <b className="tabular">{questions.length}</b> en el banco
          </span>
          {pending > 0 && (
            <span>
              <b className="tabular">{pending}</b> por revisar
            </span>
          )}
          <span>
            <b className="tabular">{recentPct === null ? '—' : `${recentPct}%`}</b> aciertos recientes
          </span>
        </div>
      </header>
      <div className="seg exam-tabs" role="tablist">
        {(
          [
            ['block', 'Nuevo simulacro'],
            ['gen', 'Generar casos'],
            ['bank', 'Banco de preguntas'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'block' && (
        <section className="card exam-setup">
          <div className="field">
            <span>¿De qué?</span>
            <div className="seg">
              {(
                [
                  ['week', `Lo de esta semana (${week.length})`],
                  ['weak', `Temas débiles (${weak.length})`],
                  ['pick', 'Elegir temas'],
                  ['all', 'Todo el banco'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={source === id ? 'active' : ''} onClick={() => setSource(id)} aria-pressed={source === id}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {source === 'pick' && (
            <div className="field">
              <div className="field-row tight">
                <TopicSelect value={pick} onChange={setPick} className="select grow" />
                <button className="btn sm" disabled={!pick || picked.includes(pick)} onClick={() => pick && setPicked([...picked, pick])}>
                  Agregar
                </button>
              </div>
              <div className="src-tags">
                {picked.map((t) => (
                  <button key={t} className="badge link-badge" onClick={() => setPicked(picked.filter((x) => x !== t))}>
                    {TOPIC[t].title} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="field-row">
            <label className="field">
              <span>Preguntas</span>
              <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 20, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Modo</span>
              <div className="seg">
                <button className={mode === 'exam' ? 'active' : ''} onClick={() => setMode('exam')}>
                  Examen (resultados al final)
                </button>
                <button className={mode === 'study' ? 'active' : ''} onClick={() => setMode('study')}>
                  Estudio (explicación inmediata)
                </button>
              </div>
            </div>
          </div>
          <div className="field-row">
            <span className="muted small">
              {pool.length} preguntas disponibles · 1 min por pregunta. Primero las que nunca has visto y las que fallaste.
            </span>
            <span className="spacer" />
            <button className="btn primary big" onClick={start} disabled={!pool.length}>
              <Icon name="play" size={16} /> Empezar
            </button>
          </div>
          {!pool.length && (
            <p className="muted small">
              No hay preguntas para esa selección. Ve a <b>Generar casos</b> (con tu GPC adjunta) o agrega preguntas en el banco.
            </p>
          )}
        </section>
      )}

      {tab === 'gen' && <Generator week={week} weak={weak} />}
      {tab === 'bank' && <Bank />}

      {attempts.length > 0 && tab === 'block' && (
        <section className="card">
          <div className="card-head">
            <h4>Últimos simulacros</h4>
          </div>
          <ul className="attempt-list">
            {attempts.slice(0, 8).map((a) => {
              const byId = new Map(questions.map((q) => [q.id, q]));
              const right = a.questionIds.filter((id, i) => byId.get(id)?.correct === a.answers[i]).length;
              return (
                <li key={a.id}>
                  <span>{a.title}</span>
                  <span className="muted small">{a.date}</span>
                  <span className="spacer" />
                  <b className="tabular">
                    {right}/{a.questionIds.length}
                  </b>
                  <span className="muted small tabular">{Math.round(a.seconds / 60)} min</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {run && <Runner {...run} onClose={() => setRun(null)} />}
    </div>
  );
}

function Generator({ week, weak }: { week: string[]; weak: string[] }) {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const addQuestions = useExam((s) => s.addQuestions);
  const [topicId, setTopicId] = useState<string | null>(week[0] ?? weak[0] ?? null);
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const go = async () => {
    if (!topicId) return;
    setBusy(true);
    setMsg(null);
    try {
      const qs = await generateQuestions(topicId, n, apiKey, model);
      addQuestions(qs);
      setMsg(`Listo: ${qs.length} casos de «${TOPIC[topicId].title}» en el banco, marcados «por revisar».`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card exam-setup">
      <p className="muted small">
        Claude lee la <b>GER</b> adjunta al tema (o tus apuntes, si no hay GPC) y redacta casos con viñeta, distractores y la explicación de cada opción, citando la página. Revísalos antes de confiar en ellos: entran como «por revisar».
      </p>
      {!apiKey && (
        <div className="field-row tight">
          <input className="input grow" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Tu API key de Anthropic (sk-ant-…)" aria-label="API key" />
          <button className="btn sm" disabled={!key.trim()} onClick={() => useSettings.getState().setApiKey(key.trim())}>
            Guardar clave
          </button>
        </div>
      )}
      <div className="field-row tight">
        <TopicSelect value={topicId} onChange={setTopicId} allowNone={false} className="select grow" />
        <select className="select" value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Cantidad">
          {[3, 5, 8, 10].map((x) => (
            <option key={x} value={x}>
              {x} casos
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={() => void go()} disabled={busy || !topicId || !apiKey}>
          <Icon name="sparkles" size={15} /> {busy ? 'Generando…' : 'Generar'}
        </button>
      </div>
      {(week.length > 0 || weak.length > 0) && (
        <div className="src-tags">
          <span className="muted small">Sugeridos:</span>
          {[...new Set([...weak, ...week])].slice(0, 8).map((t) => (
            <button key={t} className="badge link-badge" onClick={() => setTopicId(t)}>
              {TOPIC[t].title}
            </button>
          ))}
        </div>
      )}
      {msg && <p className="small exam-msg">{msg}</p>}
    </section>
  );
}

function Bank() {
  const questions = useExam((s) => s.questions);
  const update = useExam((s) => s.updateQuestion);
  const remove = useExam((s) => s.removeQuestion);
  const importQuestions = useExam((s) => s.importQuestions);
  const addQuestions = useExam((s) => s.addQuestions);
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [topic, setTopic] = useState<string | null>(null);
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const list = questions.filter((q) => (filter === 'all' || !q.reviewed) && (!topic || q.topicId === topic));
  return (
    <section className="card">
      <div className="field-row tight">
        <div className="seg">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            Todas
          </button>
          <button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>
            Por revisar
          </button>
        </div>
        <TopicSelect value={topic} onChange={setTopic} className="select grow" />
        <button className="btn sm" onClick={() => setEditing('new')}>
          <Icon name="plus" size={14} /> Nueva
        </button>
        <button className="btn ghost sm" onClick={() => downloadBlob(new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' }), 'quiron-codex-preguntas.json')}>
          <Icon name="download" size={14} /> Exportar
        </button>
        <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={14} /> Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const n = importQuestions(JSON.parse(await f.text()));
              useUI.getState().showToast(n ? `Importadas: ${n}` : 'El archivo no tenía preguntas válidas');
            } catch (err) {
              alert(`No se pudo importar: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
        />
      </div>
      {list.length ? (
        <ul className="bank-list">
          {list.map((q) => (
            <li key={q.id}>
              <div className="grow">
                <div className="bank-q">{q.question}</div>
                <div className="muted small">
                  {q.topicId ? TOPIC[q.topicId]?.title : 'Sin tema'} · {q.origin === 'ia' ? 'IA' : q.origin === 'importada' ? 'importada' : 'manual'}
                  {q.cite && ` · 📑 p. ${q.cite.page}`}
                </div>
              </div>
              {!q.reviewed ? (
                <button className="btn sm" onClick={() => update(q.id, { reviewed: true })} title="Ya la revisé y es correcta">
                  <Icon name="check" size={14} /> Validar
                </button>
              ) : (
                <span className="badge">revisada</span>
              )}
              <button className="icon-btn xs" onClick={() => setEditing(q)} aria-label="Editar pregunta">
                <Icon name="pen" size={14} />
              </button>
              <button className="icon-btn xs" onClick={() => confirm('¿Eliminar esta pregunta?') && remove(q.id)} aria-label="Eliminar pregunta">
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ts-empty muted">Sin preguntas con ese filtro.</div>
      )}
      {editing && (
        <QuestionEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            if (editing === 'new') addQuestions([{ ...q, origin: 'manual', reviewed: true, cite: null }]);
            else update(editing.id, { ...q, reviewed: true });
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function QuestionEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: Question | null;
  onClose: () => void;
  onSave: (q: Pick<Question, 'topicId' | 'vignette' | 'question' | 'options' | 'correct'>) => void;
}) {
  const [topicId, setTopicId] = useState<string | null>(initial?.topicId ?? null);
  const [vignette, setVignette] = useState(initial?.vignette ?? '');
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [options, setOptions] = useState(initial?.options ?? [0, 1, 2, 3].map(() => ({ text: '', why: '' })));
  const [correct, setCorrect] = useState(initial?.correct ?? 0);
  const ok = vignette.trim() && question.trim() && options.filter((o) => o.text.trim()).length >= 3 && options[correct]?.text.trim();
  return (
    <Modal
      title={initial ? 'Editar pregunta' : 'Nueva pregunta'}
      onClose={onClose}
      width={720}
      footer={
        <>
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!ok} onClick={() => onSave({ topicId, vignette: vignette.trim(), question: question.trim(), options: options.filter((o) => o.text.trim()), correct })}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form">
        <TopicSelect value={topicId} onChange={setTopicId} />
        <textarea className="input" rows={4} value={vignette} onChange={(e) => setVignette(e.target.value)} placeholder="Caso clínico (4–6 líneas)" aria-label="Caso clínico" />
        <input className="input" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Pregunta" aria-label="Pregunta" />
        {options.map((o, i) => (
          <div key={i} className="opt-edit">
            <label className="opt-radio">
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Opción ${LETTERS[i]} correcta`} />
              <b>{LETTERS[i]}</b>
            </label>
            <div className="grow">
              <input className="input" value={o.text} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`Opción ${LETTERS[i]}`} aria-label={`Opción ${LETTERS[i]}`} />
              <input className="input sm" value={o.why} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, why: e.target.value } : x)))} placeholder="Por qué es correcta / incorrecta" aria-label={`Explicación ${LETTERS[i]}`} />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Aplicación de un bloque: una pregunta a la vez, cronómetro, marcar para revisar, resultados con explicaciones. */
function Runner({ ids, title, minutes, mode, onClose }: { ids: string[]; title: string; minutes: number; mode: 'exam' | 'study'; onClose: () => void }) {
  const questions = useExam((s) => s.questions);
  const addAttempt = useExam((s) => s.addAttempt);
  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const qs = ids.map((id) => byId.get(id)!).filter(Boolean);
  // Orden de opciones barajado por pregunta (las respuestas se guardan con el índice original).
  const [orders] = useState(() => qs.map((q) => q.options.map((_, i) => i).sort(() => Math.random() - 0.5)));
  const [answers, setAnswers] = useState<(number | null)[]>(() => qs.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => qs.map(() => false));
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(minutes * 60);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [finished]);
  useEffect(() => {
    if (left <= 0 && !finished) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  function finish() {
    setFinished(true);
    addAttempt({ date: todayKey(), title, questionIds: qs.map((q) => q.id), answers, seconds: Math.round((Date.now() - startedAt.current) / 1000) });
  }

  const q = qs[i];
  const answered = answers.filter((a) => a !== null).length;
  const right = qs.filter((qq, k) => answers[k] === qq.correct).length;
  const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0');
  const ss = String(Math.max(0, left % 60)).padStart(2, '0');
  const reveal = finished || (mode === 'study' && answers[i] !== null);

  if (finished && i === -1) return null;
  return (
    <Modal title={title} onClose={() => (finished || confirm('¿Salir del simulacro? Se perderá este intento.') ? onClose() : undefined)} width={860}>
      <div className="runner">
        <div className="runner-top">
          {!finished ? (
            <>
              <span className={`chip timer${left < 120 ? ' warn' : ''}`}>
                ⏱ {mm}:{ss}
              </span>
              <span className="chip">
                {answered}/{qs.length} respondidas
              </span>
            </>
          ) : (
            <span className="chip result">
              Resultado: <b>{right}</b> de {qs.length} ({Math.round((right / qs.length) * 100)}%)
            </span>
          )}
          <span className="spacer" />
          {!finished && (
            <button className="btn primary sm" onClick={() => (answered < qs.length && !confirm(`Te faltan ${qs.length - answered}. ¿Terminar?`) ? null : finish())}>
              Terminar
            </button>
          )}
        </div>
        <div className="runner-dots" role="list">
          {qs.map((qq, k) => (
            <button
              key={qq.id}
              role="listitem"
              className={`rdot${k === i ? ' cur' : ''}${answers[k] !== null ? ' ans' : ''}${flags[k] ? ' flag' : ''}${finished ? (answers[k] === qq.correct ? ' ok' : ' bad') : ''}`}
              onClick={() => setI(k)}
              aria-label={`Pregunta ${k + 1}`}
            >
              {k + 1}
            </button>
          ))}
        </div>
        {q && (
          <article className="case">
            <div className="muted small">
              {q.topicId ? `${SPECIALTY[TOPIC[q.topicId].specialty].short} · ${finished ? TOPIC[q.topicId].title : 'Caso clínico'}` : 'Caso clínico'}
              {!q.reviewed && ' · por revisar'}
            </div>
            <p className="case-vignette">{q.vignette}</p>
            <p className="case-question">{q.question}</p>
            <ol className="case-options">
              {orders[i].map((orig, pos) => {
                const chosen = answers[i] === orig;
                const cls = reveal ? (orig === q.correct ? ' correct' : chosen ? ' wrong' : '') : chosen ? ' chosen' : '';
                return (
                  <li key={orig}>
                    <button
                      className={`case-opt${cls}`}
                      disabled={finished || (mode === 'study' && answers[i] !== null)}
                      onClick={() => setAnswers(answers.map((a, k) => (k === i ? orig : a)))}
                    >
                      <b>{LETTERS[pos]}</b>
                      <span>{q.options[orig].text}</span>
                    </button>
                    {reveal && q.options[orig].why && <p className="case-why">{q.options[orig].why}</p>}
                  </li>
                );
              })}
            </ol>
            {reveal && q.cite && (
              <button className="link small" onClick={() => openPdfPage(q.cite!.docId, q.cite!.page) && onClose()}>
                📑 {q.cite.docName} · p. {q.cite.page}
              </button>
            )}
          </article>
        )}
        <div className="runner-nav">
          <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Anterior
          </button>
          {!finished && (
            <button className={`btn ghost${flags[i] ? ' active' : ''}`} onClick={() => setFlags(flags.map((f, k) => (k === i ? !f : f)))}>
              ⚑ {flags[i] ? 'Marcada' : 'Marcar'}
            </button>
          )}
          <span className="spacer" />
          <button className="btn" disabled={i >= qs.length - 1} onClick={() => setI(i + 1)}>
            Siguiente →
          </button>
        </div>
        {finished && <SpecialtyBreakdown qs={qs} answers={answers} />}
      </div>
    </Modal>
  );
}

function SpecialtyBreakdown({ qs, answers }: { qs: Question[]; answers: (number | null)[] }) {
  const rows = SPECIALTIES.map((sp) => {
    const idx = qs.map((q, k) => ({ q, k })).filter(({ q }) => q.topicId && TOPIC[q.topicId].specialty === sp.id);
    const ok = idx.filter(({ q, k }) => answers[k] === q.correct).length;
    return { sp, n: idx.length, ok };
  }).filter((r) => r.n);
  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div key={r.sp.id} className="bk-row">
          <span className="sp-tag" style={{ background: r.sp.color }}>
            {r.sp.short}
          </span>
          <div className="bk-bar">
            <span style={{ width: `${(r.ok / r.n) * 100}%` }} />
          </div>
          <span className="tabular small">
            {r.ok}/{r.n}
          </span>
        </div>
      ))}
    </div>
  );
}
