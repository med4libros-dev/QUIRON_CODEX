import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { WEEKDAYS, addDays, addMonths, fmt, formatMinutes, startOfMonth, startOfWeek, toKey, todayKey } from '../../lib/date';
import { usePlanner } from '../../store/planner';
import type { StudySession, Subject } from '../../types';
import { SessionDialog } from './SessionDialog';
import { SubjectsDialog } from './SubjectsDialog';

type Mode = 'week' | 'month';

export function CalendarView() {
  const sessions = usePlanner((s) => s.sessions);
  const subjects = usePlanner((s) => s.subjects);
  const addSession = usePlanner((s) => s.addSession);
  const updateSession = usePlanner((s) => s.updateSession);
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [dialog, setDialog] = useState<{ date: string; session?: StudySession } | null>(null);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [dropKey, setDropKey] = useState<string | null>(null);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const byDay = useMemo(() => {
    const m = new Map<string, StudySession[]>();
    for (const s of sessions) {
      const list = m.get(s.date);
      if (list) list.push(s);
      else m.set(s.date, [s]);
    }
    return m;
  }, [sessions]);

  const today = todayKey();
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const visibleKeys = mode === 'week' ? days.map(toKey) : null;
  const weekSessions = visibleKeys ? visibleKeys.flatMap((k) => byDay.get(k) ?? []) : [];
  const plannedMin = weekSessions.reduce((a, s) => a + s.minutes, 0);
  const doneCount = weekSessions.filter((s) => s.done).length;

  const title =
    mode === 'week'
      ? `${fmt(days[0], { day: 'numeric', month: 'short' })} – ${fmt(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
      : fmt(anchor, { month: 'long', year: 'numeric' });

  const move = (dir: number) => setAnchor((a) => (mode === 'week' ? addDays(a, dir * 7) : addMonths(a, dir)));

  const quickAdd = (date: string, topic: string) => {
    const t = topic.trim();
    if (!t) return;
    const last = sessions[sessions.length - 1];
    addSession({ date, topic: t, subjectId: last?.subjectId ?? subjects[0]?.id ?? null, minutes: 50, docId: null });
  };

  const defaultDate = () => {
    if (mode === 'week') return visibleKeys?.includes(today) ? today : toKey(days[0]);
    return toKey(anchor).slice(0, 7) === today.slice(0, 7) ? today : toKey(startOfMonth(anchor));
  };

  return (
    <div className="page calendar">
      <header className="page-head">
        <div className="seg">
          <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')}>
            Semana
          </button>
          <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')}>
            Mes
          </button>
        </div>
        <div className="group">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior">
            <Icon name="chevronLeft" />
          </button>
          <button className="btn ghost sm" onClick={() => setAnchor(new Date())}>
            Hoy
          </button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Siguiente">
            <Icon name="chevronRight" />
          </button>
        </div>
        <h2 className="page-title">{title}</h2>
        <div className="spacer" />
        {mode === 'week' && (
          <span className="muted small hide-narrow">
            {doneCount}/{weekSessions.length} sesiones · {formatMinutes(plannedMin)} planificadas
          </span>
        )}
        <button className="btn ghost" onClick={() => setSubjectsOpen(true)}>
          <Icon name="tag" size={16} /> Materias
        </button>
        <button className="btn primary" onClick={() => setDialog({ date: defaultDate() })}>
          <Icon name="plus" size={16} /> Sesión
        </button>
      </header>

      {mode === 'week' ? (
        <div className="week">
          {days.map((d, i) => {
            const key = toKey(d);
            const list = byDay.get(key) ?? [];
            const mins = list.reduce((a, s) => a + s.minutes, 0);
            return (
              <section
                key={key}
                className={`day${key === today ? ' today' : ''}${dropKey === key ? ' drop' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropKey(key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropKey((k) => (k === key ? null : k));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) updateSession(id, { date: key });
                  setDropKey(null);
                }}
              >
                <header className="day-head">
                  <span className="day-name">{WEEKDAYS[i]}</span>
                  <span className="day-num">{d.getDate()}</span>
                  <span className="spacer" />
                  {mins > 0 && <span className="muted small">{formatMinutes(mins)}</span>}
                </header>
                <div className="day-list">
                  {list.map((s) => (
                    <SessionCard
                      key={s.id}
                      s={s}
                      subject={s.subjectId ? subjectById.get(s.subjectId) : undefined}
                      onToggle={() => updateSession(s.id, { done: !s.done })}
                      onOpen={() => setDialog({ date: key, session: s })}
                    />
                  ))}
                </div>
                <QuickAdd onAdd={(t) => quickAdd(key, t)} />
              </section>
            );
          })}
        </div>
      ) : (
        <MonthGrid
          anchor={anchor}
          byDay={byDay}
          subjectById={subjectById}
          today={today}
          onPick={(d) => {
            setAnchor(d);
            setMode('week');
          }}
        />
      )}

      {dialog && <SessionDialog date={dialog.date} session={dialog.session} onClose={() => setDialog(null)} />}
      {subjectsOpen && <SubjectsDialog onClose={() => setSubjectsOpen(false)} />}
    </div>
  );
}

function SessionCard({ s, subject, onToggle, onOpen }: { s: StudySession; subject?: Subject; onToggle: () => void; onOpen: () => void }) {
  return (
    <article
      className={`session${s.done ? ' done' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', s.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{ '--subj': subject?.color ?? 'var(--border-strong)' } as CSSProperties}
    >
      <button className="session-check" onClick={onToggle} aria-label={s.done ? 'Marcar como pendiente' : 'Marcar como completada'}>
        {s.done && <Icon name="check" size={13} />}
      </button>
      <button className="session-body" onClick={onOpen}>
        <span className="session-topic">{s.topic}</span>
        <span className="session-meta">
          {subject?.name ?? 'Sin materia'} · {s.minutes} min{s.docId ? ' · PDF' : ''}
        </span>
      </button>
    </article>
  );
}

function QuickAdd({ onAdd }: { onAdd: (topic: string) => void }) {
  const [v, setV] = useState('');
  return (
    <input
      className="quick-add"
      placeholder="+ Añadir tema"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onAdd(v);
          setV('');
        }
      }}
      aria-label="Añadir tema rápido"
    />
  );
}

function MonthGrid({
  anchor,
  byDay,
  subjectById,
  today,
  onPick,
}: {
  anchor: Date;
  byDay: Map<string, StudySession[]>;
  subjectById: Map<string, Subject>;
  today: string;
  onPick: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(anchor));
  const month = anchor.getMonth();
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="month">
      <div className="month-head">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((d) => {
          const key = toKey(d);
          const list = byDay.get(key) ?? [];
          return (
            <button
              key={key}
              className={`month-cell${d.getMonth() !== month ? ' out' : ''}${key === today ? ' today' : ''}`}
              onClick={() => onPick(d)}
            >
              <span className="month-num">{d.getDate()}</span>
              {list.slice(0, 3).map((s) => (
                <span key={s.id} className={`month-item${s.done ? ' done' : ''}`}>
                  <i style={{ background: (s.subjectId && subjectById.get(s.subjectId)?.color) || 'var(--border-strong)' }} />
                  {s.topic}
                </span>
              ))}
              {list.length > 3 && <span className="muted small">+{list.length - 3} más</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
