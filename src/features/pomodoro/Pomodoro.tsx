import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { pad, todayKey } from '../../lib/date';
import { usePlanner } from '../../store/planner';
import { PHASE_LABEL, phaseMs, usePomodoro } from '../../store/pomodoro';

/** Pomodoro compacto en la barra superior. Clic en el tiempo para ajustes y materia. */
export function Pomodoro() {
  const s = usePomodoro();
  const subjects = usePlanner((p) => p.subjects);
  const logs = usePlanner((p) => p.logs);
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!s.running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [s.running]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const remaining = s.running && s.endAt ? Math.max(0, s.endAt - Date.now()) : s.remainingMs;
  const total = phaseMs(s, s.phase);
  const progress = total ? 1 - remaining / total : 0;
  const label = `${pad(Math.floor(remaining / 60000))}:${pad(Math.floor((remaining % 60000) / 1000))}`;
  const today = todayKey();
  const todayFocus = logs.filter((l) => l.date === today).reduce((a, l) => a + l.minutes, 0);

  useEffect(() => {
    document.title = s.running ? `${label} · ${PHASE_LABEL[s.phase]} — Quirón Codex` : 'Quirón Codex';
  }, [label, s.running, s.phase]);

  const start = () => {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    s.start();
  };

  return (
    <div className={`pomo phase-${s.phase}${s.running ? ' running' : ''}`} ref={boxRef}>
      <span className="pomo-ring" style={{ '--p': progress } as CSSProperties} aria-hidden="true" />
      <button className="pomo-time tabular" onClick={() => setOpen((o) => !o)} title="Ajustes del Pomodoro" aria-expanded={open}>
        {label}
      </button>
      <span className="pomo-phase hide-narrow">{PHASE_LABEL[s.phase]}</span>
      {s.running ? (
        <button className="icon-btn" onClick={s.pause} title="Pausar">
          <Icon name="pause" size={16} />
        </button>
      ) : (
        <button className="icon-btn" onClick={start} title="Iniciar">
          <Icon name="play" size={16} />
        </button>
      )}
      <button className="icon-btn" onClick={s.skip} title="Saltar a la siguiente fase">
        <Icon name="skip" size={16} />
      </button>
      <button className="icon-btn" onClick={s.reset} title="Reiniciar fase">
        <Icon name="reset" size={16} />
      </button>

      {open && (
        <div className="popover pomo-pop" role="dialog" aria-label="Ajustes del Pomodoro">
          <label className="field">
            <span>Materia del bloque</span>
            <select className="select" value={s.subjectId ?? ''} onChange={(e) => s.setSubject(e.target.value || null)}>
              <option value="">Sin materia</option>
              {subjects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-grid three">
            {(
              [
                ['focusMin', 'Enfoque'],
                ['shortMin', 'Descanso'],
                ['longMin', 'Largo'],
              ] as const
            ).map(([k, l]) => (
              <label className="field" key={k}>
                <span>{l} (min)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={180}
                  value={s[k]}
                  onChange={(e) => s.setDurations({ [k]: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                />
              </label>
            ))}
          </div>
          <label className="field">
            <span>Descanso largo cada</span>
            <select className="select" value={s.longEvery} onChange={(e) => s.setDurations({ longEvery: parseInt(e.target.value, 10) })}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} pomodoros
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Hoy: {todayFocus} min de enfoque · {s.completedFocus} pomodoros completados en total
          </p>
        </div>
      )}
    </div>
  );
}
