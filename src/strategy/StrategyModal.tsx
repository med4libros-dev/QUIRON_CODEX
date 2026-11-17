import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { BLOCK_NOTE, QUESTIONS } from './questions';
import { gather, summarize, type Evidence } from './evidence';
import { aiProposals, localProposals, type Proposal } from './propose';
import { useInternship } from '../internship/store';
import { usePlanner } from '../store/planner';
import { useCards } from '../flashcards/store';
import { useExam } from '../exam/store';
import { useNotes } from '../store/notes';
import { useHy } from '../hy/store';
import { useSummaries } from '../summaries/store';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { generatePlan } from '../internship/planner';
import { TOPICS } from '../internship/curriculum';
import { todayKey } from '../lib/date';

/**
 * Estrategia de estudio: el cuestionario y los datos reales de la app entran juntos,
 * y salen ajustes concretos al plan que tú apruebas uno por uno. El planificador sigue
 * siendo el mismo, determinista: esto solo mueve sus perillas.
 */
export function StrategyModal({ onClose }: { onClose: () => void }) {
  const [ans, setAns] = useState<Record<string, string>>({});
  const [props, setProps] = useState<Proposal[] | null>(null);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const showToast = useUI((s) => s.showToast);

  const config = useInternship((s) => s.config);
  const done = useInternship((s) => s.done);
  const logs = usePlanner((s) => s.logs);
  const cards = useCards((s) => s.cards);
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const notes = useNotes((s) => s.notes);
  const hy = useHy((s) => s.items);
  const summaries = useSummaries((s) => s.summaries);

  const evidence: Evidence | null = useMemo(() => {
    if (!config) return null;
    const plan = generatePlan(config, TOPICS);
    return gather({
      config,
      plan: [...plan.days.values()].map((d) => ({ key: d.date, lessons: d.lessons })),
      done,
      today: todayKey(),
      logs,
      cards,
      questions,
      attempts,
      inkNotes: notes.filter((n) => (n.inkPages ?? 0) > 0).length,
      audioNotes: notes.filter((n) => n.classText).length,
      hyItems: hy.length,
      summaries: summaries.length,
    });
  }, [config, done, logs, cards, questions, attempts, notes, hy, summaries]);

  const faltan = QUESTIONS.filter((q) => !ans[q.id]).length;

  async function analizar() {
    if (!evidence || !config) return;
    setBusy(true);
    setNote('');
    const labels = QUESTIONS.map((q) => `${q.text} → ${q.options.find((o) => o.value === ans[q.id])?.label ?? 'sin responder'}`).join('\n');
    const locales = localProposals(evidence, ans, config);
    try {
      const ia = await aiProposals(evidence, ans, config, labels);
      if (ia.length) {
        setProps(ia);
        setNote('Propuestas del motor de IA, con tus datos reales. Revisa cada una antes de aplicarla.');
      } else {
        setProps(locales);
        setNote('El motor no devolvió nada aprovechable, así que estas salen de las reglas de la app.');
      }
    } catch (e) {
      setProps(locales);
      setNote(
        e instanceof Error && /clave|key/i.test(e.message)
          ? 'Sin clave de IA configurada: estas salen de las reglas de la app, con tus mismos datos.'
          : 'No se pudo consultar el motor de IA; estas salen de las reglas de la app.',
      );
    } finally {
      setBusy(false);
    }
  }

  function aplicar(p: Proposal) {
    if (p.kind === 'config' && p.patch && config) {
      useInternship.getState().setConfig({ ...config, ...p.patch });
      showToast('Plan actualizado. Tus lecciones marcadas se conservan.');
    } else if (p.kind === 'retention' && p.retention != null) {
      useSettings.getState().setRetention(p.retention);
      showToast('Exigencia del repaso ajustada.');
    } else if (p.kind === 'reminder' && p.reminderHour != null) {
      useSettings.getState().setReminders(true, p.reminderHour);
      showToast('Recordatorio diario activado.');
    } else if (p.kind === 'tool' && p.view) {
      useSettings.getState().setView(p.view as never);
      onClose();
      return;
    }
    setApplied((a) => ({ ...a, [p.id]: true }));
  }

  return (
    <Modal title="Estrategia de estudio" onClose={onClose} width={760}>
      {!config ? (
        <p className="muted">Primero crea tu plan del internado.</p>
      ) : props ? (
        <>
          {note && <p className="muted small">{note}</p>}
          {props.length === 0 ? (
            <p className="muted">
              No hay nada que ajustar: con lo que la app ha visto de ti, tu plan está bien como está. Vuelve en unas semanas, cuando haya más datos.
            </p>
          ) : (
            <ul className="prop-list">
              {props.map((p) => (
                <li key={p.id} className={applied[p.id] ? 'done' : undefined}>
                  <div>
                    <b>{p.title}</b>
                    <p className="muted small">{p.why}</p>
                  </div>
                  {applied[p.id] ? (
                    <span className="ok-text small">
                      <Icon name="check" size={14} /> Aplicado
                    </span>
                  ) : (
                    <button className="btn sm" onClick={() => aplicar(p)}>
                      {p.kind === 'tool' ? 'Abrir' : 'Aplicar'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="field-row">
            <button className="btn ghost sm" onClick={() => setProps(null)}>
              Volver al cuestionario
            </button>
            <span className="spacer" />
            <button className="btn sm" onClick={onClose}>
              Listo
            </button>
          </div>
        </>
      ) : (
        <>
          {(['circunstancias', 'preferencias'] as const).map((block) => (
            <section key={block} className="strat-block">
              <h4>{block === 'circunstancias' ? 'Tu realidad' : 'Cómo te gusta trabajar'}</h4>
              <p className="muted small">{BLOCK_NOTE[block]}</p>
              {QUESTIONS.filter((q) => q.block === block).map((q) => (
                <div key={q.id} className="strat-q">
                  <span>{q.text}</span>
                  <div className="strat-opts">
                    {q.options.map((o) => (
                      <button
                        key={o.value}
                        className={`chip${ans[q.id] === o.value ? ' on' : ''}`}
                        aria-pressed={ans[q.id] === o.value}
                        onClick={() => setAns((a) => ({ ...a, [q.id]: o.value }))}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
          {evidence && (
            <details className="strat-evid">
              <summary>Qué sabe la app de ti (y va a usar)</summary>
              <pre>{summarize(evidence, config) || 'Todavía no hay datos de uso: las propuestas saldrán solo del cuestionario.'}</pre>
            </details>
          )}
          <div className="field-row">
            <span className="muted small">{faltan ? `Faltan ${faltan} respuestas.` : 'Listo para analizar.'}</span>
            <div className="spacer" />
            <button className="btn primary" disabled={busy || faltan > 0} onClick={analizar}>
              {busy ? 'Analizando…' : 'Proponer ajustes'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
