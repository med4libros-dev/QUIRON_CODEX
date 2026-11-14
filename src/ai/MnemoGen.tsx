import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { topicMastery, weakTopics } from '../analytics/mastery';
import { useExam } from '../exam/store';
import { useCards } from '../flashcards/store';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { TOPIC } from '../internship/curriculum';
import { useHy } from '../hy/store';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { generateMnemonics, type MnemoCandidate } from './features';

/** Mnemotecnias con IA para tus temas débiles: tú eliges cuáles se guardan en Perlas HY. */
export function MnemoGen() {
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const cards = useCards((s) => s.cards);
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const weak = useMemo(() => weakTopics(topicMastery(cards, questions, attempts), 6), [cards, questions, attempts]);
  const [open, setOpen] = useState(false);
  const [topicId, setTopicId] = useState<string | null>(weak[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cands, setCands] = useState<(MnemoCandidate & { pick: boolean })[]>([]);

  const go = async () => {
    if (!topicId) return;
    setBusy(true);
    setMsg(null);
    setCands([]);
    try {
      const list = await generateMnemonics(topicId, { apiKey, model });
      setCands(list.map((m) => ({ ...m, pick: false })));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const chosen = cands.filter((c) => c.pick);
    for (const c of chosen) useHy.getState().add({ topicId, kind: 'mnemo', title: c.title, text: c.text, explain: c.explain, source: null });
    useUI.getState().showToast(`${chosen.length} mnemotecnia${chosen.length === 1 ? '' : 's'} en Perlas HY`);
    setCands([]);
  };

  if (!open)
    return (
      <button className="btn ghost sm mnemo-open" onClick={() => setOpen(true)}>
        <Icon name="sparkles" size={14} /> Mnemotecnias con IA {weak.length > 0 && <span className="muted">· {weak.length} tema{weak.length === 1 ? '' : 's'} débil{weak.length === 1 ? '' : 'es'}</span>}
      </button>
    );
  return (
    <section className="card mnemo-gen">
      <div className="field-row tight">
        <h4>Mnemotecnias con IA</h4>
        <span className="spacer" />
        <button className="icon-btn xs" onClick={() => setOpen(false)} aria-label="Cerrar">
          <Icon name="x" size={14} />
        </button>
      </div>
      <p className="muted small">Claude lee la GPC adjunta al tema (o tus apuntes) y propone mnemotecnias. Elige las que te sirvan: solo esas se guardan.</p>
      <div className="field-row tight">
        <TopicSelect value={topicId} onChange={setTopicId} allowNone={false} className="select grow" />
        <button className="btn primary sm" onClick={() => void go()} disabled={busy || !topicId || !apiKey} title={apiKey ? '' : 'Agrega tu API key en Ajustes → Preferencias'}>
          <Icon name="sparkles" size={14} /> {busy ? 'Pensando…' : 'Proponer'}
        </button>
      </div>
      {weak.length > 0 && (
        <div className="src-tags">
          <span className="muted small">Débiles:</span>
          {weak.map((t) => (
            <button key={t} className={`badge link-badge${t === topicId ? ' active' : ''}`} onClick={() => setTopicId(t)}>
              {TOPIC[t]?.title}
            </button>
          ))}
        </div>
      )}
      {!apiKey && <p className="small warn-text">Necesitas tu API key de Anthropic (Ajustes → Preferencias → IA).</p>}
      {msg && <p className="small error">{msg}</p>}
      {cands.length > 0 && (
        <>
          <ul className="mnemo-list">
            {cands.map((c, i) => (
              <li key={i} className={c.pick ? 'picked' : ''}>
                <label>
                  <input type="checkbox" checked={c.pick} onChange={(e) => setCands(cands.map((x, j) => (j === i ? { ...x, pick: e.target.checked } : x)))} />
                  <span>
                    <b>{c.title}</b> — {c.text}
                    {c.explain && <em className="muted small"> {c.explain}</em>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="field-row tight">
            <span className="spacer" />
            <button className="btn primary sm" disabled={!cands.some((c) => c.pick)} onClick={save}>
              Guardar elegidas
            </button>
          </div>
        </>
      )}
    </section>
  );
}
