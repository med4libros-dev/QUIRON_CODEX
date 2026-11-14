import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../components/Icon';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { SPECIALTIES, SPECIALTY, TOPIC } from '../internship/curriculum';
import { ensureTopicNote } from '../internship/openLesson';
import type { SpecialtyId } from '../internship/types';
import { downloadBlob } from '../lib/exportPdf';
import { escapeHtml } from '../lib/html';
import { useBridge } from '../store/bridge';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { HY_KINDS, useHy, type HyItem, type HyKind } from './store';
import { speak, ttsSupported } from '../lib/tts';
import { AskedToggle } from '../components/AskedToggle';
import { MnemoGen } from '../ai/MnemoGen';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KIND_LABEL = Object.fromEntries(HY_KINDS.map((k) => [k.id, k.label])) as Record<HyKind, string>;

/** Vista «Perlas HY»: repositorio de mnemotecnias y datos de alto rendimiento por tema. */
export function HyView() {
  const items = useHy((s) => s.items);
  const importItems = useHy((s) => s.importItems);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<HyKind | ''>('');
  const [sp, setSp] = useState<SpecialtyId | ''>('');
  const [starOnly, setStarOnly] = useState(false);
  const [askedOnly, setAskedOnly] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const n = norm(q.trim());
    return items.filter(
      (i) =>
        (!kind || i.kind === kind) &&
        (!sp || (i.topicId && TOPIC[i.topicId]?.specialty === sp)) &&
        (!starOnly || i.starred) &&
        (!askedOnly || i.asked) &&
        (!n || norm(`${i.title} ${i.text} ${i.explain} ${i.topicId ? TOPIC[i.topicId]?.title ?? '' : ''}`).includes(n)),
    );
  }, [items, q, kind, sp, starOnly, askedOnly]);

  const doImport = async (f: File) => {
    try {
      const n = importItems(JSON.parse(await f.text()));
      useUI.getState().showToast(n ? `Importada${n === 1 ? ' 1 perla nueva' : `s ${n} perlas nuevas`}` : 'No había perlas nuevas en el archivo');
    } catch (e) {
      alert(`No se pudo importar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="page hy-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Perlas de alto rendimiento</h2>
          <p className="muted small">Mnemotecnias, tríadas, signos y datos de 1 línea que el ENARM pregunta y se olvidan a las 2 semanas.</p>
        </div>
        <div className="spacer" />
        {ttsSupported() && (
          <button className="btn ghost" onClick={() => speak(list.map((i) => ({ title: i.title || KIND_LABEL[i.kind], text: [i.text, i.explain].filter(Boolean).join('. ') })), 'Perlas HY')} disabled={!list.length} title="Escuchar las perlas de la lista">
            <Icon name="speaker" size={16} /> Escuchar
          </button>
        )}
        <button className={`btn${quiz ? ' primary' : ' ghost'}`} onClick={() => setQuiz((v) => !v)} disabled={!list.length}>
          <Icon name="sparkles" size={16} /> Repaso relámpago
        </button>
        <button
          className="btn ghost"
          onClick={() => downloadBlob(new Blob([JSON.stringify(items.filter((i) => !i.seed), null, 2)], { type: 'application/json' }), 'quiron-codex-perlas.json')}
          title="Exporta tus perlas para compartirlas con tus compañeros"
        >
          <Icon name="download" size={16} /> Exportar
        </button>
        <button className="btn ghost" onClick={() => fileRef.current?.click()} title="Importa perlas de un compañero (archivo .json)">
          <Icon name="upload" size={16} /> Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void doImport(f);
          }}
        />
      </header>

      {quiz && <QuickQuiz items={list} onClose={() => setQuiz(false)} />}

      <HyEditor />
      <MnemoGen />

      <div className="field-row tight hy-filters">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (p. ej. «colangitis», «Charcot», «embarazo»)…" aria-label="Buscar perlas" />
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as HyKind | '')} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {HY_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <select className="select" value={sp} onChange={(e) => setSp(e.target.value as SpecialtyId | '')} aria-label="Especialidad">
          <option value="">Todas las especialidades</option>
          {SPECIALTIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className={`btn ghost sm${starOnly ? ' active' : ''}`} onClick={() => setStarOnly((v) => !v)} aria-pressed={starOnly}>
          ★ Favoritas
        </button>
        <button className={`btn ghost sm${askedOnly ? ' active' : ''}`} onClick={() => setAskedOnly((v) => !v)} aria-pressed={askedOnly} title="Solo lo que te preguntaron">
          <Icon name="mic" size={13} /> Preguntadas
        </button>
        <span className="muted small tabular">{list.length}</span>
      </div>
      <HyList items={list} />
    </div>
  );
}

/** Formulario para agregar una perla (opcionalmente fijo a un tema). */
export function HyEditor({ topicId: fixedTopic }: { topicId?: string }) {
  const add = useHy((s) => s.add);
  const [kind, setKind] = useState<HyKind>('perla');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [explain, setExplain] = useState('');
  const [topicId, setTopicId] = useState<string | null>(fixedTopic ?? null);
  const [open, setOpen] = useState(false);
  const save = () => {
    if (!text.trim()) return;
    add({ kind, title: title.trim(), text: text.trim(), explain: explain.trim(), topicId: fixedTopic ?? topicId, source: null });
    setTitle('');
    setText('');
    setExplain('');
    useUI.getState().showToast('Perla guardada');
  };
  if (!open)
    return (
      <button className="btn sm hy-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} /> Nueva perla o mnemotecnia
      </button>
    );
  return (
    <section className="card hy-editor">
      <div className="field-row tight">
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value as HyKind)} aria-label="Tipo">
          {HY_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input className="input grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre corto (opcional): «Tríada de…», «MONA»…" aria-label="Nombre" maxLength={120} />
        {!fixedTopic && <TopicSelect value={topicId} onChange={setTopicId} className="select hy-topic" />}
      </div>
      <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="La perla en una línea" aria-label="Perla" maxLength={600} />
      <textarea className="input" rows={2} value={explain} onChange={(e) => setExplain(e.target.value)} placeholder="Qué significa cada letra o cómo recordarla (opcional)" aria-label="Explicación" maxLength={1200} />
      <div className="field-row tight">
        <span className="muted small">Si es un dato de manejo o dosis, cópialo de la GPC vigente.</span>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => setOpen(false)}>
          Cerrar
        </button>
        <button className="btn primary sm" onClick={save} disabled={!text.trim()}>
          Guardar
        </button>
      </div>
    </section>
  );
}

export function HyList({ items, compact = false }: { items: HyItem[]; compact?: boolean }) {
  if (!items.length) return <div className="ts-empty muted">Sin perlas todavía.</div>;
  return (
    <ul className={`hy-list${compact ? ' compact' : ''}`}>
      {items.map((i) => (
        <HyRow key={i.id} item={i} />
      ))}
    </ul>
  );
}

function HyRow({ item }: { item: HyItem }) {
  const update = useHy((s) => s.update);
  const remove = useHy((s) => s.remove);
  const toggleStar = useHy((s) => s.toggleStar);
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState(item);
  const t = item.topicId ? TOPIC[item.topicId] : null;

  const toNote = () => {
    if (!t) return alert('Asigna un tema a esta perla para enviarla a su nota.');
    const { noteId, notebookId } = ensureTopicNote(t);
    const st = useSettings.getState();
    if (st.notebookScope !== notebookId) st.setNotebookScope(notebookId);
    useSettings.getState().setActiveNote(noteId);
    const html = `<blockquote class="pearl"><b>${escapeHtml(item.title || KIND_LABEL[item.kind])}:</b> ${escapeHtml(item.text)}${item.explain ? `<br><em>${escapeHtml(item.explain)}</em>` : ''}</blockquote>`;
    useBridge.getState().insertIntoNote(html, { noteId, append: true });
    useUI.getState().showToast(`Enviada a «${t.title}»`);
  };

  if (editing)
    return (
      <li className="hy-item editing">
        <div className="field-row tight">
          <select className="select" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as HyKind })} aria-label="Tipo">
            {HY_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input className="input grow" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} aria-label="Nombre" />
          <TopicSelect value={d.topicId} onChange={(v) => setD({ ...d, topicId: v })} className="select hy-topic" />
        </div>
        <textarea className="input" rows={2} value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} aria-label="Perla" />
        <textarea className="input" rows={2} value={d.explain} onChange={(e) => setD({ ...d, explain: e.target.value })} aria-label="Explicación" />
        <div className="field-row tight">
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button
            className="btn primary sm"
            onClick={() => {
              update(item.id, { kind: d.kind, title: d.title, text: d.text, explain: d.explain, topicId: d.topicId });
              setEditing(false);
            }}
          >
            Guardar
          </button>
        </div>
      </li>
    );

  return (
    <li className={`hy-item kind-${item.kind}`} style={t ? ({ '--sp': SPECIALTY[t.specialty].color } as CSSProperties) : undefined}>
      <button className={`hy-star${item.starred ? ' on' : ''}`} onClick={() => toggleStar(item.id)} aria-pressed={item.starred} aria-label="Favorita" title="Favorita">
        ★
      </button>
      <div className="hy-body">
        <div className="hy-top">
          <span className="badge">{KIND_LABEL[item.kind]}</span>
          {item.title && <b>{item.title}</b>}
          {item.seed && (
            <span className="muted small" title="Viene precargada con la app (semiología clásica)">
              · base
            </span>
          )}
        </div>
        <div className="hy-text">{item.text}</div>
        {item.explain && <div className="hy-explain muted">{item.explain}</div>}
        <div className="hy-meta muted small">
          {t ? (
            <button className="link" onClick={() => useUI.getState().openTopic(t.id, 'hy')}>
              {t.title}
            </button>
          ) : (
            'Sin tema'
          )}
          {item.source && ` · 📑 ${item.source.docName}, p. ${item.source.page}`}
        </div>
      </div>
      <div className="hy-actions">
        <AskedToggle on={!!item.asked} onToggle={() => useHy.setState((st) => ({ items: st.items.map((x) => (x.id === item.id ? { ...x, asked: !x.asked } : x)) }))} />
        <button className="icon-btn xs" onClick={toNote} title="Enviar a la nota del tema" aria-label="Enviar a la nota">
          <Icon name="text" size={14} />
        </button>
        <button
          className="icon-btn xs"
          onClick={() =>
            useUI.getState().setCardDraft({ topicId: item.topicId, front: item.title ? `${item.title}: ¿qué es?` : '', back: [item.text, item.explain].filter(Boolean).join('\n'), source: item.source ?? undefined })
          }
          title="Convertir en flashcard"
          aria-label="Convertir en flashcard"
        >
          <Icon name="cards" size={14} />
        </button>
        <button
          className="icon-btn xs"
          onClick={() => {
            setD(item);
            setEditing(true);
          }}
          title="Editar"
          aria-label="Editar"
        >
          <Icon name="pen" size={14} />
        </button>
        <button className="icon-btn xs" onClick={() => confirm('¿Eliminar esta perla?') && remove(item.id)} title="Eliminar" aria-label="Eliminar">
          <Icon name="trash" size={14} />
        </button>
      </div>
    </li>
  );
}

/** Tarjeta al azar: ves el nombre (o el tema) y tratas de recordar la perla. */
function QuickQuiz({ items, onClose }: { items: HyItem[]; onClose: () => void }) {
  // Lo que te preguntaron sale primero.
  const [order] = useState(() => [...items].map((x) => ({ x, k: Math.random() - (x.asked ? 1 : 0) })).sort((a, b) => a.k - b.k).map((o) => o.x));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const it = order[i % order.length];
  if (!it) return null;
  const t = it.topicId ? TOPIC[it.topicId] : null;
  return (
    <section className="card hy-quiz">
      <div className="field-row tight">
        <span className="badge">{KIND_LABEL[it.kind]}</span>
        <span className="muted small">
          {(i % order.length) + 1} / {order.length}
        </span>
        <span className="spacer" />
        <button className="icon-btn xs" onClick={onClose} aria-label="Cerrar repaso">
          <Icon name="x" size={14} />
        </button>
      </div>
      <button className="hy-quiz-card" onClick={() => setShown((v) => !v)}>
        <div className="fc-front">{it.title || (t ? `Perla de ${t.title}` : 'Perla')}</div>
        {shown ? (
          <div className="fc-back">
            <p>{it.text}</p>
            {it.explain && <p className="muted">{it.explain}</p>}
          </div>
        ) : (
          <div className="muted small">Recuérdala y toca para ver</div>
        )}
      </button>
      <div className="field-row tight">
        <span className="spacer" />
        <button
          className="btn primary sm"
          onClick={() => {
            setI((n) => n + 1);
            setShown(false);
          }}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
