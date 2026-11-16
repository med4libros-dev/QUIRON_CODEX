import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { TOPIC, TOPICS } from '../internship/curriculum';
import { generatePlan } from '../internship/planner';
import { useInternship } from '../internship/store';
import { dueCards, useCards } from '../flashcards/store';
import { useHy } from '../hy/store';
import { useStudyToday } from '../lib/autoFocus';
import { fmt, fromKey, todayKey } from '../lib/date';
import { escapeHtml } from '../lib/html';
import { closeSelf, widgetKind, type WidgetKind } from '../lib/widgets';
import { sendToWindows } from '../lib/windowSync';
import { useNotes } from '../store/notes';
import { useWard } from '../ward/store';

/**
 * Las ventanitas flotantes. Comparten los mismos datos que la app (todo va al mismo
 * almacenamiento y se avisa entre ventanas), así que lo que captures aquí aparece allá
 * sin recargar nada. Están pensadas para leerse de reojo: pocas líneas y letra grande.
 */
export function WidgetApp() {
  const kind = widgetKind() ?? 'glance';
  const meta: Record<WidgetKind, string> = {
    glance: 'Cápsula de estudio',
    ward: 'Pendientes del turno',
    review: 'Repaso pendiente',
    capture: 'Captura rápida',
  };
  return (
    <div className="wg" data-kind={kind}>
      <header className="wg-bar" data-tauri-drag-region>
        <span className="wg-title" data-tauri-drag-region>
          {meta[kind]}
        </span>
        <button className="wg-x" onClick={() => void closeSelf()} title="Cerrar este widget" aria-label="Cerrar">
          <Icon name="x" size={13} />
        </button>
      </header>
      <div className="wg-body">
        {kind === 'glance' && <Glance />}
        {kind === 'ward' && <WardWidget />}
        {kind === 'review' && <ReviewWidget />}
        {kind === 'capture' && <CaptureWidget />}
      </div>
    </div>
  );
}

/* ---------- Cápsula de estudio ---------- */

function Glance() {
  const { minutes, counting } = useStudyToday();
  const config = useInternship((s) => s.config);
  const done = useInternship((s) => s.done);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(() => {
    if (!config) return null;
    const day = generatePlan(config, TOPICS).days.get(todayKey());
    if (!day) return null;
    const pend = day.lessons.filter((l) => !done[l.id]);
    return { total: day.lessons.length, pend, minutes: pend.reduce((n, l) => n + l.minutes, 0) };
  }, [config, done]);

  return (
    <>
      <div className="wg-row">
        <span className="wg-big tabular">{fmt(now, { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="wg-dim">{fmt(now, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <div className="wg-row">
        <span className={`wg-chip${counting ? ' live' : ''}`} title={counting ? 'Contando ahora' : 'En pausa'}>
          <Icon name="clock" size={13} /> {minutes} min hoy
        </span>
        {today && (
          <span className="wg-chip" title={`${today.pend.length} de ${today.total} lecciones pendientes`}>
            {today.pend.length ? `${today.pend.length} por estudiar · ${today.minutes} min` : 'Día completo'}
          </span>
        )}
      </div>
      {today?.pend[0] ? (
        <p className="wg-main ellipsis-2" title={TOPIC[today.pend[0].topicId]?.title}>
          {TOPIC[today.pend[0].topicId]?.title ?? 'Tema'}
        </p>
      ) : (
        <p className="wg-main dim">{config ? 'Nada pendiente hoy.' : 'Genera tu plan del internado para ver el tema del día.'}</p>
      )}
    </>
  );
}

/* ---------- Pendientes del turno ---------- */

function WardWidget() {
  const patients = useWard((s) => s.patients);
  const toggleTask = useWard((s) => s.toggleTask);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = patients
    .flatMap((p) => p.tasks.filter((t) => !t.done).map((t) => ({ p, t })))
    .sort((a, b) => (a.t.at ?? '99:99').localeCompare(b.t.at ?? '99:99'))
    .slice(0, 12);

  if (!rows.length) return <p className="wg-main dim">Sin pendientes. Cuando agregues alguno en Turno, aparece aquí.</p>;
  return (
    <ul className="wg-list">
      {rows.map(({ p, t }) => (
        <li key={t.id} className={t.at && t.at <= hm ? 'due' : undefined}>
          <button className="wg-check" onClick={() => toggleTask(p.id, t.id)} title="Marcar como hecho" aria-label={`Marcar ${t.text}`}>
            <Icon name="check" size={12} />
          </button>
          {t.at && <b className="tabular">{t.at}</b>}
          <span className="wg-bed">{p.bed || '—'}</span>
          <span className="ellipsis">{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Repaso pendiente ---------- */

function ReviewWidget() {
  const cards = useCards((s) => s.cards);
  const due = dueCards(cards).length;
  return (
    <>
      <p className="wg-big tabular">{due}</p>
      <p className="wg-dim">{due === 1 ? 'tarjeta por repasar' : 'tarjetas por repasar'}</p>
      {due > 0 && (
        <button
          className="wg-btn"
          onClick={() => {
            // La ventana principal abre el repaso: aquí no cabe.
            sendToWindows('open-review');
          }}
        >
          <Icon name="cards" size={14} /> Repasar en la app
        </button>
      )}
    </>
  );
}

/* ---------- Captura rápida ---------- */

type CaptureKind = 'pearl' | 'note' | 'card';

function CaptureWidget() {
  const [kind, setKind] = useState<CaptureKind>('pearl');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [saved, setSaved] = useState('');

  const labels: Record<CaptureKind, [string, string]> = {
    pearl: ['Perla (una línea)', 'Nombre corto (opcional)'],
    note: ['Lo que quieras recordar', 'Título (opcional)'],
    card: ['Pregunta', 'Respuesta'],
  };

  const save = () => {
    const text = a.trim();
    if (!text) return;
    if (kind === 'pearl') {
      useHy.getState().add({ topicId: null, kind: 'perla', title: b.trim() || text.slice(0, 40), text, explain: '' });
    } else if (kind === 'card') {
      if (!b.trim()) return;
      useCards.getState().addCard({ front: text, back: b.trim(), topicId: null });
    } else {
      // Todo lo capturado va a una sola nota «Capturas», en orden.
      const st = useNotes.getState();
      const existing = st.notes.find((n) => n.title === 'Capturas' && !n.docId);
      const stamp = fmt(new Date(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const block = `<p><b>${escapeHtml(b.trim() || stamp)}</b><br>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
      if (existing) st.updateNote(existing.id, { html: `${existing.html}${block}` });
      else st.createNote({ docId: null, title: 'Capturas', html: block });
    }
    setSaved(kind === 'pearl' ? 'Perla guardada' : kind === 'card' ? 'Flashcard creada' : 'Guardado en «Capturas»');
    setA('');
    setB('');
    setTimeout(() => setSaved(''), 2500);
  };

  return (
    <>
      <div className="wg-seg" role="radiogroup" aria-label="Qué capturar">
        {(
          [
            ['pearl', 'Perla'],
            ['note', 'Nota'],
            ['card', 'Flashcard'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)} aria-checked={kind === k} role="radio">
            {label}
          </button>
        ))}
      </div>
      <textarea
        className="wg-input"
        autoFocus
        rows={3}
        value={a}
        placeholder={labels[kind][0]}
        aria-label={labels[kind][0]}
        onChange={(e) => setA(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
          if (e.key === 'Escape') void closeSelf();
        }}
      />
      <input
        className="wg-input"
        value={b}
        placeholder={labels[kind][1]}
        aria-label={labels[kind][1]}
        onChange={(e) => setB(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <div className="wg-row end">
        {saved ? <span className="wg-ok">{saved}</span> : <span className="wg-dim small">Ctrl+Enter guarda · Esc cierra</span>}
        <button className="wg-btn" onClick={save} disabled={!a.trim() || (kind === 'card' && !b.trim())}>
          Guardar
        </button>
      </div>
    </>
  );
}
