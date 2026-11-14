import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { CALCULATORS, calculatorsForTopic } from '../../clinical/calculators';
import { useCards } from '../../flashcards/store';
import { SPECIALTIES, SPECIALTY, TOPICS } from '../../internship/curriculum';
import { GUARD_FIELDS, useTopicStore } from '../../internship/topicStore';
import type { SpecialtyId } from '../../internship/types';
import { useUI } from '../../store/ui';
import { CalculatorCard } from './CalculatorCard';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Temario completo con lo que tienes en cada tema (GPC, casos, flashcards, ficha de guardia). */
export function TemarioModal() {
  const open = useUI((s) => s.temarioOpen);
  const setOpen = useUI((s) => s.setTemarioOpen);
  const openTopic = useUI((s) => s.openTopic);
  const info = useTopicStore((s) => s.info);
  const cards = useCards((s) => s.cards);
  const [q, setQ] = useState('');
  const [sp, setSp] = useState<SpecialtyId | ''>('');
  const cardCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) if (c.topicId) m.set(c.topicId, (m.get(c.topicId) ?? 0) + 1);
    return m;
  }, [cards]);
  if (!open) return null;
  const needle = norm(q.trim());
  const list = TOPICS.filter((t) => (!sp || t.specialty === sp) && (!needle || norm(t.title).includes(needle)));
  return (
    <Modal title="Temario" onClose={() => setOpen(false)} width={720}>
      <div className="temario">
        <div className="field-row tight">
          <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tema…" aria-label="Buscar tema" autoFocus />
          <select className="select" value={sp} onChange={(e) => setSp(e.target.value as SpecialtyId | '')} aria-label="Especialidad">
            <option value="">Todas</option>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <ul className="temario-list">
          {list.map((t) => {
            const i = info[t.id];
            const kinds = new Set(i?.attachments.map((a) => a.kind));
            const guard = i && GUARD_FIELDS.some((f) => i.guard[f.id].trim());
            return (
              <li key={t.id} style={{ '--sp': SPECIALTY[t.specialty].color } as CSSProperties}>
                <button onClick={() => openTopic(t.id, 'docs')}>
                  <span className="sp-tag">{SPECIALTY[t.specialty].short}</span>
                  <span className="ellipsis grow">{t.title}</span>
                  {kinds.has('GRR') && <span className="badge grr">GRR</span>}
                  {kinds.has('GER') && <span className="badge ger">GER</span>}
                  {kinds.has('otro') && <span className="badge">PDF</span>}
                  {guard && (
                    <span className="badge" title="Ficha de guardia">
                      <Icon name="shield" size={11} />
                    </span>
                  )}
                  {!!i?.cases.length && <span className="badge">{i.cases.length} caso{i.cases.length === 1 ? '' : 's'}</span>}
                  {!!cardCount.get(t.id) && <span className="badge">{cardCount.get(t.id)} fc</span>}
                </button>
              </li>
            );
          })}
          {!list.length && <li className="muted ts-empty">Sin resultados.</li>}
        </ul>
      </div>
    </Modal>
  );
}

/** Modo Guardia/Pocket: fichas de lectura rápida + calculadoras, a un toque desde cualquier pantalla. */
export function GuardQuick() {
  const open = useUI((s) => s.guardQuickOpen);
  const setOpen = useUI((s) => s.setGuardQuickOpen);
  const info = useTopicStore((s) => s.info);
  const [q, setQ] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);
  const [calcId, setCalcId] = useState('');
  if (!open) return null;
  const needle = norm(q.trim());
  const withCard = TOPICS.filter((t) => {
    const i = info[t.id];
    return i && GUARD_FIELDS.some((f) => i.guard[f.id].trim());
  });
  const results = needle ? TOPICS.filter((t) => norm(t.title).includes(needle)).slice(0, 12) : withCard;
  const t = topicId ? TOPICS.find((x) => x.id === topicId) : null;
  const g = t ? info[t.id]?.guard : null;
  const calcs = t ? calculatorsForTopic(t.id) : [];
  const calc = CALCULATORS.find((c) => c.id === calcId);

  return (
    <Modal title="Vista de Guardia" onClose={() => setOpen(false)} width={760}>
      <div className="guard-quick">
        <div className="field-row tight">
          <input
            className="input grow"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTopicId(null);
            }}
            placeholder="¿Qué tienes enfrente? Busca un tema…"
            aria-label="Buscar tema"
            autoFocus
          />
          <select className="select" value={calcId} onChange={(e) => setCalcId(e.target.value)} aria-label="Calculadora">
            <option value="">Calculadoras…</option>
            {CALCULATORS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {calc && <CalculatorCard key={calc.id} calc={calc} defaultOpen />}
        {!t ? (
          <>
            <div className="muted small gq-label">{needle ? 'Resultados' : withCard.length ? 'Temas con ficha de guardia' : 'Aún no tienes fichas: ábrelas desde Temario → Vista de Guardia.'}</div>
            <div className="gq-chips">
              {results.map((x) => (
                <button key={x.id} className="chip big" style={{ '--chip': SPECIALTY[x.specialty].color } as CSSProperties} onClick={() => setTopicId(x.id)}>
                  <i /> {x.title}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="pocket">
            <div className="pocket-head">
              <button className="btn ghost sm" onClick={() => setTopicId(null)}>
                <Icon name="chevronLeft" size={14} /> Temas
              </button>
              <h4>{t.title}</h4>
              <span className="spacer" />
              <button className="btn sm" onClick={() => useUI.getState().openTopic(t.id, 'guard')}>
                Editar ficha
              </button>
            </div>
            <div className="pocket-grid">
              {GUARD_FIELDS.map((f) => {
                const lines = (g?.[f.id] ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
                return (
                  <section key={f.id} className={`pocket-card f-${f.id}`}>
                    <h5>{f.label}</h5>
                    {lines.length ? (
                      <ul>
                        {lines.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">Sin datos todavía.</p>
                    )}
                  </section>
                );
              })}
            </div>
            {calcs.map((c) => (
              <CalculatorCard key={c.id} calc={c} defaultOpen={calcs.length === 1} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
