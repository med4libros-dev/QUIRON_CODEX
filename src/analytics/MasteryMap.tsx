import { useMemo, type CSSProperties } from 'react';
import { useExam } from '../exam/store';
import { useCards } from '../flashcards/store';
import { SPECIALTIES, TOPICS } from '../internship/curriculum';
import { useUI } from '../store/ui';
import { masteryColor, topicMastery, weakTopics } from './mastery';

/** Mapa de calor del dominio por tema y especialidad (simulacros + flashcards). */
export function MasteryMap() {
  const cards = useCards((s) => s.cards);
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const m = useMemo(() => topicMastery(cards, questions, attempts), [cards, questions, attempts]);
  const weak = weakTopics(m, 10);
  return (
    <section className="card mastery-card">
      <div className="card-head">
        <h4>Mapa de debilidades</h4>
        <span className="spacer" />
        <span className="legend small muted">
          <i style={{ background: masteryColor(30) }} /> &lt; 40 <i style={{ background: masteryColor(50) }} /> 40–59 <i style={{ background: masteryColor(70) }} /> 60–79{' '}
          <i style={{ background: masteryColor(90) }} /> ≥ 80 <i style={{ background: masteryColor(null) }} /> sin datos
        </span>
      </div>
      {m.size === 0 && <p className="muted small">Aparecerá cuando respondas simulacros o repases flashcards. Los temas débiles reciben repasos de refuerzo en tu plan.</p>}
      <div className="mastery-grid">
        {SPECIALTIES.map((sp) => {
          const ts = TOPICS.filter((t) => t.specialty === sp.id);
          const scored = ts.map((t) => m.get(t.id)).filter(Boolean);
          const avg = scored.length ? Math.round(scored.reduce((a, x) => a + x!.score, 0) / scored.length) : null;
          return (
            <div key={sp.id} className="mastery-sp" style={{ '--sp': sp.color } as CSSProperties}>
              <div className="mastery-sp-head">
                <span className="sp-tag">{sp.short}</span>
                <span className="small">{sp.name}</span>
                <span className="spacer" />
                <b className="tabular small">{avg === null ? '—' : `${avg}%`}</b>
              </div>
              <div className="mastery-cells">
                {ts.map((t) => {
                  const v = m.get(t.id);
                  return (
                    <button
                      key={t.id}
                      className={`mcell${weak.includes(t.id) ? ' weak' : ''}`}
                      style={{ background: masteryColor(v ? v.score : null) }}
                      title={`${t.title}: ${v ? `${v.score}% · ${v.exam.seen} respuestas · ${v.cards.reviewed} tarjetas` : 'sin datos'}`}
                      aria-label={`${t.title} ${v ? `${v.score}%` : 'sin datos'}`}
                      onClick={() => useUI.getState().openTopic(t.id, 'cards')}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
