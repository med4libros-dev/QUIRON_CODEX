import { AskedToggle } from '../components/AskedToggle';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { SPECIALTIES, TOPIC, TOPICS } from '../internship/curriculum';
import { todayKey } from '../lib/date';
import { openPdfPage } from '../store/navigate';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { Occluded } from './Occluded';
import { GRADE_LABEL, dueCards, schedule, useCards, type Card, type Grade } from './store';

/** Selector de tema reutilizable (todas las especialidades). */
export function TopicSelect({ value, onChange, allowNone = true, className = 'select' }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean; className?: string }) {
  return (
    <select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="Tema">
      {allowNone && <option value="">Sin tema</option>}
      {SPECIALTIES.map((sp) => (
        <optgroup key={sp.id} label={sp.name}>
          {TOPICS.filter((t) => t.specialty === sp.id).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Modal rápido: el texto de la GPC va al reverso; tú solo escribes la pregunta. */
export function FlashcardModal() {
  const draft = useUI((s) => s.cardDraft);
  if (!draft) return null;
  // Montaje nuevo por borrador: el formulario nace ya lleno (sin parpadeo vacío).
  return <CardForm key={`${draft.topicId}|${draft.front ?? ""}|${(draft.back ?? "").slice(0, 60)}`} draft={draft} />;
}

function CardForm({ draft }: { draft: NonNullable<ReturnType<typeof useUI.getState>['cardDraft']> }) {
  const setDraft = useUI((s) => s.setCardDraft);
  const addCard = useCards((s) => s.addCard);
  const [front, setFront] = useState(draft.front ?? '');
  const [back, setBack] = useState(draft.back ?? '');
  const [topicId, setTopicId] = useState<string | null>(draft.topicId);
  const qRef = useRef<HTMLTextAreaElement>(null);

  const close = () => setDraft(null);
  const save = () => {
    if (!front.trim() || (!back.trim() && !draft.image)) return;
    addCard({ front: front.trim(), back: back.trim(), topicId, image: draft.image, source: draft.source });
    useUI.getState().showToast(`Flashcard creada${topicId ? ` en «${TOPIC[topicId].title}»` : ''}: aparecerá hoy en tu repaso`);
    close();
  };

  return (
    <Modal
      title="Nueva flashcard"
      onClose={close}
      width={520}
      footer={
        <>
          <span className="muted small">Ctrl + Enter para guardar</span>
          <span className="spacer" />
          <button className="btn ghost" onClick={close}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={!front.trim() || (!back.trim() && !draft.image)}>
            Guardar
          </button>
        </>
      }
    >
      <div
        className="form card-form"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
        }}
      >
        <label className="field">
          <span>Pregunta (anverso)</span>
          <textarea ref={qRef} autoFocus className="input" rows={2} value={front} onChange={(e) => setFront(e.target.value)} placeholder="Ej. ¿Cuál es el tratamiento de primera línea de…?" />
        </label>
        <label className="field">
          <span>Respuesta (reverso)</span>
          <textarea className="input" rows={4} value={back} onChange={(e) => setBack(e.target.value)} />
        </label>
        {draft.image && <img className="card-img" src={draft.image} alt="Recorte del reverso" />}
        <div className="row">
          <label className="field grow">
            <span>Tema</span>
            <TopicSelect value={topicId} onChange={setTopicId} />
          </label>
          {draft.source && (
            <span className="muted small card-src">
              📑 {draft.source.docName} · p. {draft.source.page}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Formatea un intervalo en días como texto corto. */
const fmtInterval = (d: number) => (d < 1 ? 'hoy' : d === 1 ? '1 día' : d < 30 ? `${d} días` : d < 365 ? `${Math.round(d / 30)} m` : '1 año');

/** Sesión de repaso. Con `minutes` (modo supervivencia) muestra cuenta regresiva y se detiene al llegar a 0. */
export function FlashcardReview() {
  const review = useUI((s) => s.review);
  const startReview = useUI((s) => s.startReview);
  if (!review) return null;
  return (
    <ReviewSession
      key={review.cardIds.join(',')}
      ids={review.cardIds}
      title={review.title}
      minutes={review.minutes}
      oneHand={review.oneHand}
      onClose={() => startReview(null)}
    />
  );
}

function ReviewSession({ ids, title, minutes, oneHand, onClose }: { ids: string[]; title: string; minutes?: number; oneHand?: boolean; onClose: () => void }) {
  const retention = useSettings((s) => s.retention);
  const cards = useCards((s) => s.cards);
  const grade = useCards((s) => s.grade);
  const [queue, setQueue] = useState<string[]>(ids);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [left, setLeft] = useState(minutes ? minutes * 60 : 0);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const card = queue.map((id) => byId.get(id)).find(Boolean) as Card | undefined;
  const timeUp = !!minutes && left <= 0;

  useEffect(() => {
    if (!minutes) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [minutes]);

  const answer = (g: Grade) => {
    if (!card) return;
    grade(card.id, g);
    setReviewed((n) => n + 1);
    setFlipped(false);
    // «Otra vez» vuelve al final de la sesión de hoy.
    setQueue((q) => {
      const rest = q.filter((id) => id !== card.id);
      return g === 0 ? [...rest, card.id] : rest;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || timeUp) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) answer((Number(e.key) - 1) as Grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <Modal title={title} onClose={onClose} width={600}>
      <div className="review" data-onehand={oneHand ? '1' : undefined}>
        <div className="review-meta">
          <span className="chip">{reviewed} repasadas</span>
          <span className="chip">{queue.length} por ver</span>
          {minutes && <span className={`chip timer${left < 60 ? ' warn' : ''}`}>⏱ {mm}:{ss}</span>}
          <span className="spacer" />
          {card && !timeUp && <AskedToggle on={!!card.asked} onToggle={() => useCards.getState().updateCard(card.id, { asked: !card.asked })} label />}
        </div>
        {timeUp || !card ? (
          <div className="review-end">
            <Icon name="check" size={28} />
            <h3>{timeUp ? 'Listo por hoy' : 'Sesión completa'}</h3>
            <p className="muted">
              {reviewed ? `Repasaste ${reviewed} tarjeta${reviewed === 1 ? '' : 's'}.` : 'No había tarjetas pendientes.'}{' '}
              {minutes ? 'Ahora a descansar: el resto ya quedó reprogramado.' : ''}
            </p>
            <button className="btn primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <button className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Ver pregunta' : 'Ver respuesta'}>
              <div className="fc-topic muted small">{card.topicId ? TOPIC[card.topicId]?.title : 'Sin tema'}</div>
              <div className="fc-front">{card.front}</div>
              {card.occlusion && card.image && <Occluded src={card.image} boxes={card.occlusion.boxes} target={card.occlusion.target} revealed={flipped} />}
              {flipped ? (
                <div className="fc-back">
                  {card.back && <p>{card.back}</p>}
                  {card.image && !card.occlusion && <img src={card.image} alt="Recorte" />}
                  {card.source && (
                    <span
                      className="pdf-ref"
                      role="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openPdfPage(card.source!.docId, card.source!.page)) onClose();
                        else alert('Ese PDF ya no está en tu biblioteca.');
                      }}
                    >
                      📑 {card.source.docName} · p. {card.source.page}
                    </span>
                  )}
                </div>
              ) : (
                <div className="fc-hint muted small">Toca o pulsa espacio para ver la respuesta</div>
              )}
            </button>
            {flipped && (
              <div className="grade-row">
                {([0, 1, 2, 3] as Grade[]).map((g) => (
                  <button key={g} className={`btn grade g${g}`} onClick={() => answer(g)}>
                    <b>{GRADE_LABEL[g]}</b>
                    <span className="small muted">{fmtInterval(schedule(card, g, todayKey(), retention).interval)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Cola de guardia: lo justo para 5–10 minutos de pie, con una mano.
 * Prioriza lo vencido y lo marcado «me lo preguntaron»; calcula unas 5 tarjetas por minuto.
 */
export function guardDeck(cards: Card[], minutes = 10): string[] {
  return expressDeck(cards, Math.max(8, minutes * 5));
}

/** Tarjetas para una sesión exprés: primero las vencidas; si no hay, las más «débiles». */
export function expressDeck(cards: Card[], max = 30): string[] {
  const due = dueCards(cards, todayKey());
  if (due.length) return due.slice(0, max).map((c) => c.id);
  return [...cards]
    // Las más frágiles primero: menor estabilidad (o, en tarjetas viejas, menor facilidad).
    .sort((a, b) => (a.s ?? a.interval ?? 0) - (b.s ?? b.interval ?? 0) || a.ease - b.ease || (a.lastReview ?? '').localeCompare(b.lastReview ?? ''))
    .slice(0, max)
    .map((c) => c.id);
}
