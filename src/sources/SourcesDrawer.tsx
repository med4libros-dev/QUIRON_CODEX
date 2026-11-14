import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { useTopicStore } from '../internship/topicStore';
import { copyText } from '../soap/SoapModal';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { OfflineNote, openNotebook } from './SourcesView';
import { useSources } from './store';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Panel lateral de NotebookLM, disponible desde cualquier pantalla (barra superior):
 * accesos directos a tus cuadernos, consulta rápida y captura de fragmentos sin salir de lo que estudias.
 */
export function SourcesDrawer() {
  const open = useUI((s) => s.sourcesDrawer);
  const setOpen = useUI((s) => s.setSourcesDrawer);
  const notebooks = useSources((s) => s.notebooks);
  const snippets = useSources((s) => s.snippets);
  const addSnippet = useSources((s) => s.addSnippet);
  const lastTopicId = useTopicStore((s) => s.lastTopicId);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [text, setText] = useState('');
  const [cite, setCite] = useState('');
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTopicId((t) => t ?? lastTopicId);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lastTopicId, setOpen]);

  const n = norm(q.trim());
  const list = useMemo(
    () => [...notebooks].filter((nb) => !n || norm(`${nb.title} ${nb.description}`).includes(n)).sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0)),
    [notebooks, n],
  );
  const hits = useMemo(() => (n ? snippets.filter((s) => norm(`${s.question} ${s.text} ${s.cite}`).includes(n)).slice(0, 6) : []), [snippets, n]);
  const nb = notebooks.find((x) => x.id === target) ?? list[0] ?? notebooks[0] ?? null;

  if (!open) return null;
  return createPortal(
    <aside className="src-drawer" role="dialog" aria-label="NotebookLM">
      <header className="src-drawer-head">
        <Icon name="link" size={18} />
        <h3>NotebookLM</h3>
        <span className="spacer" />
        <button
          className="btn ghost sm"
          onClick={() => {
            setOpen(false);
            useSettings.getState().setView('sources');
          }}
        >
          Ver todo
        </button>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar panel">
          <Icon name="x" size={16} />
        </button>
      </header>
      <OfflineNote />
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cuadernos y fragmentos…" aria-label="Buscar en NotebookLM" />
      <ul className="src-quick">
        {list.map((x) => (
          <li key={x.id}>
            <button className={`src-quick-item${nb?.id === x.id ? ' active' : ''}`} onClick={() => setTarget(x.id)} title="Seleccionar para consultar">
              <span className="src-emoji">{x.emoji || '📓'}</span>
              <span className="ellipsis">{x.title}</span>
            </button>
            <button className="icon-btn xs" onClick={() => openNotebook(x)} aria-label={`Abrir ${x.title}`} title="Abrir en NotebookLM">
              <Icon name="external" size={14} />
            </button>
          </li>
        ))}
        {!list.length && <li className="muted small">Sin coincidencias.</li>}
      </ul>
      {hits.length > 0 && (
        <div className="src-quick-hits">
          <h5 className="ts-h">Fragmentos</h5>
          {hits.map((h) => (
            <button key={h.id} className="snip mini" onClick={() => void copyText(h.text).then((ok) => ok && useUI.getState().showToast('Fragmento copiado'))} title="Copiar fragmento">
              <span className="snip-text">{h.text.length > 180 ? `${h.text.slice(0, 180)}…` : h.text}</span>
              {h.cite && <span className="muted small">{h.cite}</span>}
            </button>
          ))}
        </div>
      )}
      {nb && (
        <div className="src-ask">
          <h5 className="ts-h">
            Consultar · {nb.emoji} {nb.title}
          </h5>
          <textarea className="input" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tu pregunta" aria-label="Pregunta rápida" />
          <button
            className="btn sm"
            onClick={async () => {
              if (question.trim()) await copyText(question.trim());
              openNotebook(nb);
              useUI.getState().showToast(question.trim() ? 'Pregunta copiada: pégala en NotebookLM' : 'Cuaderno abierto');
            }}
          >
            <Icon name="clipboard" size={14} /> {question.trim() ? 'Copiar y abrir' : 'Abrir'}
          </button>
          <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega la respuesta o el fragmento" aria-label="Fragmento rápido" />
          <input className="input sm" value={cite} onChange={(e) => setCite(e.target.value)} placeholder="Cita (documento, página)" aria-label="Cita rápida" />
          <div className="field-row tight">
            <TopicSelect value={topicId} onChange={setTopicId} className="select grow" />
            <button
              className="btn primary sm"
              disabled={!text.trim()}
              onClick={() => {
                addSnippet({ notebookId: nb.id, question: question.trim(), text: text.trim(), cite: cite.trim(), topicId });
                setText('');
                setCite('');
                setQuestion('');
                useUI.getState().showToast('Fragmento guardado en Fuentes');
              }}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </aside>,
    document.body,
  );
}
