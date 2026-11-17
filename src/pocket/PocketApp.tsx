import { lazy, Suspense, useMemo, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { CALCULATORS } from '../clinical/calculators';
import { CalculatorCard } from '../features/topics/CalculatorCard';
import { GUARD_FIELDS, useTopicStore } from '../internship/topicStore';
import { SPECIALTY, TOPIC, TOPICS } from '../internship/curriculum';
import { dueCards, useCards } from '../flashcards/store';
import { useSettings } from '../store/settings';
import { FileBackupBar } from '../features/backup/FileBackupBar';

const DrugPanel = lazy(() => import('../drugs/DrugPanel').then((m) => ({ default: m.DrugPanel })));
const FlashcardReview = lazy(() => import('../flashcards/FlashcardUI').then((m) => ({ default: m.FlashcardReview })));

type Tab = 'guardia' | 'dosis' | 'escalas' | 'repaso';
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'guardia', icon: 'shield', label: 'Guardia' },
  { id: 'dosis', icon: 'target', label: 'Dosis' },
  { id: 'escalas', icon: 'chart', label: 'Escalas' },
  { id: 'repaso', icon: 'star', label: 'Repaso' },
];

/**
 * Bolsillo: lo que sirve en guardia, en el teléfono y a una mano.
 * No es la app recortada, son cuatro cosas, con los dedos en la mitad de abajo de la pantalla.
 */
export function PocketApp() {
  const [tab, setTab] = useState<Tab>('guardia');
  const pend = dueCards(useCards((s) => s.cards)).length;
  return (
    <div className="pocket" data-tab={tab}>
      <header className="pk-top">
        <b className="pk-title">{TABS.find((t) => t.id === tab)!.label}</b>
        <button className="pk-exit" onClick={() => useSettings.getState().setPocketFull(true)}>
          Ver todo
        </button>
      </header>
      <FileBackupBar />
      <main className="pk-body">
        {tab === 'guardia' && <Guardia />}
        {tab === 'dosis' && (
          <Suspense fallback={<p className="muted pk-empty">Abriendo…</p>}>
            <DrugPanel />
          </Suspense>
        )}
        {tab === 'escalas' && <Escalas />}
        {tab === 'repaso' && (
          <Suspense fallback={<p className="muted pk-empty">Abriendo…</p>}>
            <FlashcardReview />
          </Suspense>
        )}
      </main>
      <nav className="pk-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`pk-tab${tab === t.id ? ' on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={21} />
            <span>{t.label}</span>
            {t.id === 'repaso' && pend > 0 ? <i className="pk-dot">{pend > 99 ? '99+' : pend}</i> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Las fichas que ya llenaste, buscables. Solo lectura: en guardia se consulta, no se captura. */
function Guardia() {
  const infos = useTopicStore((s) => s.info);
  const [q, setQ] = useState('');
  const conFicha = useMemo(() => {
    const out = TOPICS.filter((t) => {
      const g = infos[t.id]?.guard;
      return g && (g.criteria || g.firstLine || g.secondLine || g.referral);
    });
    const needle = q.trim().toLowerCase();
    return needle ? out.filter((t) => t.title.toLowerCase().includes(needle)) : out;
  }, [infos, q]);

  return (
    <>
      <input className="input pk-search" placeholder="Buscar tema…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar tema" />
      {conFicha.length === 0 ? (
        <p className="muted pk-empty">
          {q
            ? 'Ningún tema con ficha coincide.'
            : 'Todavía no hay fichas de guardia. Se llenan en la tableta, desde la ficha del tema, con lo que dice tu GPC.'}
        </p>
      ) : (
        conFicha.map((t) => <FichaCard key={t.id} topicId={t.id} />)
      )}
    </>
  );
}

function FichaCard({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  const g = useTopicStore((s) => s.info[topicId]?.guard);
  if (!g) return null;
  return (
    <section className={`pk-card${open ? ' open' : ''}`}>
      <button className="pk-card-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="pk-spec">{SPECIALTY[TOPIC[topicId].specialty].short}</span>
        <b>{TOPIC[topicId].title}</b>
      </button>
      {open && (
        <div className="pk-card-body">
          {GUARD_FIELDS.map(({ id, label }) =>
            g[id]?.trim() ? (
              <div key={id} className="pk-field">
                <h4>{label}</h4>
                <ul>
                  {g[id]
                    .split('\n')
                    .filter((l) => l.trim())
                    .map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}

function Escalas() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? CALCULATORS.filter((c) => c.name.toLowerCase().includes(needle)) : CALCULATORS;
  }, [q]);
  return (
    <>
      <input className="input pk-search" placeholder="Buscar escala…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar escala" />
      {list.length === 0 ? <p className="muted pk-empty">Ninguna escala coincide.</p> : list.map((c) => <CalculatorCard key={c.id} calc={c} />)}
    </>
  );
}
