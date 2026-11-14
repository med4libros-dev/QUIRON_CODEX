import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { SPECIALTIES, SPECIALTY, TOPIC } from '../internship/curriculum';
import { ensureTopicNote } from '../internship/openLesson';
import type { SpecialtyId } from '../internship/types';
import { escapeHtml } from '../lib/html';
import { openExternal, useOnline } from '../lib/platform';
import { copyText } from '../soap/SoapModal';
import { useBridge } from '../store/bridge';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { isNotebookUrl, useSources, type Snippet, type SourceNotebook } from './store';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Abre el cuaderno en una pestaña nueva (Gemini/NotebookLM no se dejan incrustar). */
export function openNotebook(n: SourceNotebook) {
  useSources.getState().touch(n.id);
  openExternal(n.url);
}

/**
 * Hub de conocimiento conectado a NotebookLM:
 * lista y busca tus cuadernos, lanza consultas y guarda los fragmentos que traes de vuelta.
 */
export function SourcesView() {
  const notebooks = useSources((s) => s.notebooks);
  const snippets = useSources((s) => s.snippets);
  const [q, setQ] = useState('');
  const [sp, setSp] = useState<SpecialtyId | ''>('');
  const [sel, setSel] = useState<string | null>(null);
  const [editing, setEditing] = useState<SourceNotebook | 'new' | null>(null);

  const needle = norm(q.trim());
  const visible = useMemo(
    () =>
      notebooks
        .filter((n) => (!sp || n.specialty === sp) && (!needle || norm(`${n.title} ${n.description} ${n.topicIds.map((t) => TOPIC[t]?.title ?? '').join(' ')}`).includes(needle)))
        .sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0) || a.title.localeCompare(b.title)),
    [notebooks, sp, needle],
  );
  // La búsqueda también recorre los fragmentos guardados (referencias cruzadas).
  const hits = useMemo(
    () => (needle ? snippets.filter((s) => norm(`${s.question} ${s.text} ${s.cite}`).includes(needle)) : []),
    [snippets, needle],
  );
  const current = notebooks.find((n) => n.id === sel) ?? visible[0] ?? null;

  return (
    <div className="page sources-page">
      <header className="page-head">
        <div>
          <h2 className="page-title">Fuentes · NotebookLM</h2>
          <p className="muted small">Tus cuadernos de NotebookLM / Gemini y los fragmentos que traes de ellos, ligados a tus temas.</p>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Agregar cuaderno
        </button>
      </header>

      <OfflineNote />
      <div className="field-row tight">
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en cuadernos y fragmentos…" aria-label="Buscar fuentes" />
        <select className="select" value={sp} onChange={(e) => setSp(e.target.value as SpecialtyId | '')} aria-label="Especialidad">
          <option value="">Todas las especialidades</option>
          {SPECIALTIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {hits.length > 0 && (
        <section className="card src-hits">
          <div className="card-head">
            <h4>Fragmentos que coinciden</h4>
            <span className="muted small tabular">{hits.length}</span>
          </div>
          <SnippetList snippets={hits.slice(0, 20)} showNotebook />
        </section>
      )}

      <div className="src-layout">
        <ul className="src-list" aria-label="Cuadernos">
          {visible.map((n) => (
            <li key={n.id}>
              <button className={`src-item${current?.id === n.id ? ' active' : ''}`} onClick={() => setSel(n.id)}>
                <span className="src-emoji">{n.emoji || '📓'}</span>
                <span className="src-title">
                  <b className="ellipsis">{n.title}</b>
                  <span className="muted small">
                    {n.specialty ? SPECIALTY[n.specialty].name : 'General'} · {snippets.filter((s) => s.notebookId === n.id).length} fragmentos
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!visible.length && <li className="ts-empty muted">Sin cuadernos con ese filtro.</li>}
        </ul>
        {current ? <NotebookPanel key={current.id} nb={current} onEdit={() => setEditing(current)} /> : <div className="ts-empty muted">Agrega tu primer cuaderno.</div>}
      </div>

      {editing && <NotebookDialog initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(id) => setSel(id)} />}
    </div>
  );
}

function NotebookPanel({ nb, onEdit }: { nb: SourceNotebook; onEdit: () => void }) {
  const snippets = useSources((s) => s.snippets).filter((s) => s.notebookId === nb.id);
  const addSnippet = useSources((s) => s.addSnippet);
  const [question, setQuestion] = useState('');
  const [text, setText] = useState('');
  const [cite, setCite] = useState('');
  const [topicId, setTopicId] = useState<string | null>(nb.topicIds[0] ?? null);

  const ask = async () => {
    const qtext = question.trim();
    if (qtext) await copyText(qtext);
    openNotebook(nb);
    useUI.getState().showToast(qtext ? 'Pregunta copiada: pégala en NotebookLM (Ctrl+V) y trae la respuesta aquí' : 'Cuaderno abierto en una pestaña nueva');
  };
  const save = () => {
    if (!text.trim()) return;
    addSnippet({ notebookId: nb.id, question: question.trim(), text: text.trim(), cite: cite.trim(), topicId });
    setText('');
    setCite('');
    setQuestion('');
    useUI.getState().showToast('Fragmento guardado');
  };

  return (
    <section className="card src-panel">
      <div className="src-head">
        <span className="src-emoji big">{nb.emoji || '📓'}</span>
        <div className="grow">
          <h3>{nb.title}</h3>
          {nb.description && <p className="muted small">{nb.description}</p>}
          <div className="src-tags">
            {nb.specialty && <span className="badge">{SPECIALTY[nb.specialty].name}</span>}
            {nb.topicIds.map((t) =>
              TOPIC[t] ? (
                <button key={t} className="badge link-badge" onClick={() => useUI.getState().openTopic(t, 'sources')}>
                  {TOPIC[t].title}
                </button>
              ) : null,
            )}
          </div>
        </div>
        <button className="btn primary" onClick={() => openNotebook(nb)}>
          Abrir <Icon name="external" size={14} />
        </button>
        <button className="icon-btn" onClick={onEdit} title="Editar cuaderno" aria-label="Editar cuaderno">
          <Icon name="pen" size={16} />
        </button>
      </div>

      <div className="src-ask">
        <h5 className="ts-h">Consultar</h5>
        <textarea
          className="input"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Escribe tu pregunta (p. ej. «Criterios de Glasgow-Blatchford y cuándo dar egreso»)"
          aria-label="Pregunta para NotebookLM"
        />
        <div className="field-row tight">
          <button className="btn" onClick={() => void ask()}>
            <Icon name="clipboard" size={15} /> {question.trim() ? 'Copiar pregunta y abrir' : 'Abrir cuaderno'}
          </button>
          <span className="muted small">NotebookLM no permite consultas desde otras apps: la pregunta se copia y la pegas allá.</span>
        </div>
        <h5 className="ts-h">Guardar fragmento o respuesta</h5>
        <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí la respuesta o el fragmento de NotebookLM" aria-label="Fragmento" />
        <div className="field-row tight">
          <input className="input grow" value={cite} onChange={(e) => setCite(e.target.value)} placeholder="Cita / fuente que mostró NotebookLM (documento, página)" aria-label="Cita" />
          <TopicSelect value={topicId} onChange={setTopicId} className="select hy-topic" />
          <button className="btn primary" onClick={save} disabled={!text.trim()}>
            Guardar
          </button>
        </div>
      </div>

      <h5 className="ts-h">Fragmentos ({snippets.length})</h5>
      {snippets.length ? <SnippetList snippets={snippets} /> : <div className="ts-empty muted">Aún no traes fragmentos de este cuaderno.</div>}
    </section>
  );
}

/** Lista de fragmentos con acciones: a la nota del tema, flashcard, perla HY, copiar. */
export function SnippetList({ snippets, showNotebook = false }: { snippets: Snippet[]; showNotebook?: boolean }) {
  const notebooks = useSources((s) => s.notebooks);
  const remove = useSources((s) => s.removeSnippet);
  const update = useSources((s) => s.updateSnippet);
  return (
    <ul className="snip-list">
      {snippets.map((s) => {
        const nb = notebooks.find((n) => n.id === s.notebookId);
        const t = s.topicId ? TOPIC[s.topicId] : null;
        const toNote = () => {
          if (!t) return alert('Asigna un tema al fragmento para enviarlo a su nota.');
          const { noteId, notebookId } = ensureTopicNote(t);
          const st = useSettings.getState();
          if (st.notebookScope !== notebookId) st.setNotebookScope(notebookId);
          useSettings.getState().setActiveNote(noteId);
          const src = [nb ? `${nb.emoji || '📓'} ${nb.title}` : 'NotebookLM', s.cite].filter(Boolean).join(' · ');
          const link = nb ? `<a href="${escapeHtml(nb.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(src)}</a>` : escapeHtml(src);
          const html = `<blockquote class="pearl">${escapeHtml(s.text).replace(/\n/g, '<br>')}</blockquote><p class="pearl-src">${link}</p>`;
          useBridge.getState().insertIntoNote(html, { noteId, append: true });
          useUI.getState().showToast(`Fragmento enviado a «${t.title}»`);
        };
        return (
          <li key={s.id} className="snip">
            {s.question && <div className="snip-q">❓ {s.question}</div>}
            <div className="snip-text">{s.text}</div>
            <div className="snip-meta muted small">
              {showNotebook && nb && <span>{nb.emoji} {nb.title} · </span>}
              {s.cite && <span>{s.cite} · </span>}
              <TopicSelect value={s.topicId} onChange={(v) => update(s.id, { topicId: v })} className="select xs bare" />
            </div>
            <div className="snip-actions">
              <button className="btn ghost sm" onClick={toNote}>
                <Icon name="text" size={14} /> A la nota
              </button>
              <button className="btn ghost sm" onClick={() => useUI.getState().setCardDraft({ topicId: s.topicId, front: s.question, back: s.text })}>
                <Icon name="cards" size={14} /> Flashcard
              </button>
              <button className="btn ghost sm" onClick={() => void copyText(s.text).then((ok) => ok && useUI.getState().showToast('Copiado'))}>
                <Icon name="clipboard" size={14} /> Copiar
              </button>
              <span className="spacer" />
              <button className="icon-btn xs" onClick={() => confirm('¿Eliminar este fragmento?') && remove(s.id)} aria-label="Eliminar fragmento">
                <Icon name="trash" size={14} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const EMOJIS = ['📄', '🩺', '📓', '🫀', '🧠', '🫁', '🩸', '🤰', '👶', '🔪', '🚑', '💊', '🦠', '📊'];

function NotebookDialog({ initial, onClose, onSaved }: { initial: SourceNotebook | null; onClose: () => void; onSaved: (id: string) => void }) {
  const add = useSources((s) => s.addNotebook);
  const update = useSources((s) => s.updateNotebook);
  const removeNb = useSources((s) => s.removeNotebook);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📓');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [specialty, setSpecialty] = useState<SpecialtyId | null>(initial?.specialty ?? null);
  const [topicIds, setTopicIds] = useState<string[]>(initial?.topicIds ?? []);
  const [pick, setPick] = useState<string | null>(null);
  const urlOk = isNotebookUrl(url);
  const save = () => {
    if (!title.trim() || !urlOk) return;
    const p = { title: title.trim(), url: url.trim(), emoji, description: description.trim(), specialty, topicIds };
    if (initial) {
      update(initial.id, p);
      onSaved(initial.id);
    } else onSaved(add(p));
    onClose();
  };
  return (
    <Modal
      title={initial ? 'Editar cuaderno' : 'Agregar cuaderno de NotebookLM'}
      onClose={onClose}
      width={560}
      footer={
        <>
          {initial && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (!confirm('¿Quitar este cuaderno? Sus fragmentos guardados se conservan.')) return;
                removeNb(initial.id);
                onClose();
              }}
            >
              Quitar
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={save} disabled={!title.trim() || !urlOk}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form">
        <label className="field">
          <span>Enlace del cuaderno</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://notebooklm.google.com/notebook/… o https://gemini.google.com/notebook/…" />
          {url && !urlOk && <span className="privacy-warn">Debe ser un enlace https de notebooklm.google.com o gemini.google.com/notebook/.</span>}
        </label>
        <label className="field">
          <span>Nombre</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
        </label>
        <div className="field">
          <span>Ícono</span>
          <div className="emoji-row">
            {EMOJIS.map((e) => (
              <button key={e} className={`emoji-btn${emoji === e ? ' active' : ''}`} onClick={() => setEmoji(e)} aria-label={`Ícono ${e}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span>Descripción (opcional)</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={240} />
        </label>
        <label className="field">
          <span>Especialidad</span>
          <select className="select" value={specialty ?? ''} onChange={(e) => setSpecialty((e.target.value || null) as SpecialtyId | null)}>
            <option value="">General</option>
            {SPECIALTIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Temas vinculados</span>
          <div className="src-tags">
            {topicIds.map((t) => (
              <button key={t} className="badge link-badge" onClick={() => setTopicIds(topicIds.filter((x) => x !== t))} title="Quitar">
                {TOPIC[t]?.title} ✕
              </button>
            ))}
          </div>
          <div className="field-row tight">
            <TopicSelect value={pick} onChange={setPick} className="select grow" />
            <button
              className="btn sm"
              disabled={!pick || topicIds.includes(pick)}
              onClick={() => {
                if (pick) setTopicIds([...topicIds, pick]);
                setPick(null);
              }}
            >
              Vincular
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Aviso sin conexión: tus fragmentos siguen disponibles; los cuadernos se abren cuando vuelva internet. */
export function OfflineNote() {
  const online = useOnline();
  if (online) return null;
  return (
    <p className="offline-note" role="status">
      Sin conexión: tus fragmentos guardados siguen aquí. Los cuadernos de NotebookLM se abrirán cuando vuelva el internet.
    </p>
  );
}
