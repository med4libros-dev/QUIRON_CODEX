import { useMemo, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { fmt } from '../../lib/date';
import { htmlToText } from '../../lib/html';
import { useLibrary } from '../../store/library';
import { aiMissingMsg, aiReady } from '../../lib/ai';
import { recognizeNotes } from '../../lib/inkOcr';
import { useNotes } from '../../store/notes';
import { useUI } from '../../store/ui';
import { usePlanner } from '../../store/planner';
import { useSettings } from '../../store/settings';
import type { Note, Notebook } from '../../types';
import { NotebookDialog } from './NotebookDialog';

const LOOSE = '__loose';

/** Vista de cuadernos: organiza todas las notas por materia o por tema. */
export function NotebooksView() {
  const notebooks = useNotes((s) => s.notebooks);
  const notes = useNotes((s) => s.notes);
  const createNotebook = useNotes((s) => s.createNotebook);
  const createNote = useNotes((s) => s.createNote);
  const updateNote = useNotes((s) => s.updateNote);
  const subjects = usePlanner((s) => s.subjects);
  const docs = useLibrary((s) => s.docs);
  const setView = useSettings((s) => s.setView);
  const setActiveDoc = useSettings((s) => s.setActiveDoc);
  const setActiveNote = useSettings((s) => s.setActiveNote);
  const setNotebookScope = useSettings((s) => s.setNotebookScope);

  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ notebook?: Notebook } | null>(null);
  const [q, setQ] = useState('');
  /** Filtro por etiqueta (null = todas). */
  const [tag, setTag] = useState<string | null>(null);
  /** Texto del botón mientras se transcribe el cuaderno (null = en reposo). */
  const [ocr, setOcr] = useState<string | null>(null);

  const docName = useMemo(() => new Map(docs.map((d) => [d.id, d.name])), [docs]);
  const subjectName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const byBook = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const k = n.notebookId ?? LOOSE;
      const list = m.get(k);
      if (list) list.push(n);
      else m.set(k, [n]);
    }
    for (const list of m.values()) list.sort((a, b) => b.updatedAt - a.updatedAt);
    return m;
  }, [notes]);

  const missingSubjects = subjects.filter((s) => !notebooks.some((b) => b.subjectId === s.id));
  const current = selected ?? notebooks[0]?.id ?? (byBook.get(LOOSE)?.length ? LOOSE : null);
  const currentBook = notebooks.find((b) => b.id === current);
  /** Transcribe la letra de todas las notas visibles que tengan hojas escritas. */
  const recognizeBook = async () => {
    if (!aiReady()) return useUI.getState().showToast(aiMissingMsg());
    const ids = list.filter((n) => n.inkPages > 0).map((n) => n.id);
    if (!ids.length) return;
    if (!confirm(`Se van a transcribir ${ids.length} nota(s) con tu motor de IA. Puede tardar un par de minutos. ¿Seguir?`)) return;
    setOcr('Leyendo…');
    try {
      const r = await recognizeNotes(ids, (done, total) => setOcr(`${done}/${total}…`));
      useUI.getState().showToast(
        `${r.done} nota(s) transcritas: ya puedes buscarlas con Ctrl+K.${r.failed.length ? ` ${r.failed.length} fallaron.` : ''}`,
      );
    } catch (e) {
      useUI.getState().showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setOcr(null);
    }
  };

  const needle = q.trim().toLowerCase();
  const inBook = current ? byBook.get(current) ?? [] : [];
  // Etiquetas que existen en este cuaderno, con cuántas notas tiene cada una.
  const tagCounts = new Map<string, number>();
  for (const n of inBook) for (const t of n.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tags = [...tagCounts.keys()].sort();
  const list = inBook.filter(
    (n) =>
      (!tag || (n.tags ?? []).includes(tag)) &&
      (!needle ||
        n.title.toLowerCase().includes(needle) ||
        htmlToText(n.html).toLowerCase().includes(needle) ||
        (n.inkText ?? '').toLowerCase().includes(needle) ||
        (n.tags ?? []).some((t) => t.includes(needle))),
  );

  const open = (n: Note) => {
    if (n.docId && docName.has(n.docId)) setActiveDoc(n.docId);
    setNotebookScope(n.notebookId ?? null);
    setActiveNote(n.id);
    setView('study');
  };

  const newNoteHere = () => {
    if (!currentBook) return;
    const id = createNote({
      docId: null,
      notebookId: currentBook.id,
      title: `${currentBook.name} · ${fmt(new Date(), { day: 'numeric', month: 'short' })}`,
    });
    setNotebookScope(currentBook.id);
    setActiveNote(id);
    setView('study');
  };

  return (
    <div className="page notebooks">
      <header className="page-head">
        <h2 className="page-title">Cuadernos</h2>
        <span className="muted small">
          {notebooks.length} cuaderno{notebooks.length === 1 ? '' : 's'} · {notes.length} nota{notes.length === 1 ? '' : 's'}
        </span>
        <div className="spacer" />
        {missingSubjects.length > 0 && (
          <button
            className="btn ghost"
            onClick={() => {
              missingSubjects.forEach((s) => createNotebook({ name: s.name, subjectId: s.id, color: s.color }));
            }}
            title={`Crea un cuaderno para: ${missingSubjects.map((s) => s.name).join(', ')}`}
          >
            <Icon name="tag" size={16} /> Uno por materia ({missingSubjects.length})
          </button>
        )}
        <button className="btn primary" onClick={() => setDialog({})}>
          <Icon name="plus" size={16} /> Nuevo cuaderno
        </button>
      </header>

      {notebooks.length === 0 && !byBook.get(LOOSE)?.length ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="notebook" size={26} />
          </div>
          <h3>Organiza tus notas en cuadernos</h3>
          <p className="muted">
            Crea uno por materia (Cardiología, Pediatría…) o por tema (Choque séptico, Casos ENARM). Una nota puede venir de cualquier PDF.
          </p>
          <button className="btn primary" onClick={() => setDialog({})}>
            <Icon name="plus" size={16} /> Crear cuaderno
          </button>
        </div>
      ) : (
        <div className="nb-layout">
          <ul className="nb-grid" aria-label="Cuadernos">
            {notebooks.map((b) => {
              const items = byBook.get(b.id) ?? [];
              return (
                <li key={b.id}>
                  <button
                    className={`nb-card${current === b.id ? ' active' : ''}`}
                    style={{ '--nb': b.color } as CSSProperties}
                    onClick={() => setSelected(b.id)}
                    onDoubleClick={() => setDialog({ notebook: b })}
                  >
                    <span className="nb-spine" />
                    <span className="nb-name">{b.name}</span>
                    <span className="muted small">
                      {b.subjectId ? (subjectName.get(b.subjectId) === b.name ? 'Materia' : subjectName.get(b.subjectId) ?? 'Materia') : 'Tema'} · {items.length} nota{items.length === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              );
            })}
            {(byBook.get(LOOSE)?.length ?? 0) > 0 && (
              <li>
                <button
                  className={`nb-card loose${current === LOOSE ? ' active' : ''}`}
                  style={{ '--nb': 'var(--border-strong)' } as CSSProperties}
                  onClick={() => setSelected(LOOSE)}
                >
                  <span className="nb-spine" />
                  <span className="nb-name">Sin cuaderno</span>
                  <span className="muted small">{byBook.get(LOOSE)?.length} notas sueltas</span>
                </button>
              </li>
            )}
          </ul>

          <section className="card nb-notes">
            <div className="card-head">
              <h4>{currentBook?.name ?? (current === LOOSE ? 'Sin cuaderno' : 'Notas')}</h4>
              {currentBook && (
                <button className="icon-btn xs" onClick={() => setDialog({ notebook: currentBook })} title="Editar cuaderno">
                  <Icon name="settings" size={14} />
                </button>
              )}
              <div className="spacer" />
              <label className="search compact">
                <Icon name="search" size={15} />
                <input className="input sm" placeholder="Buscar en notas y en tu letra…" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              {list.some((n) => n.inkPages > 0) && (
                <button
                  className="btn ghost sm"
                  disabled={!!ocr}
                  onClick={() => void recognizeBook()}
                  title="Transcribir la letra de todas las notas de este cuaderno (usa tu motor de IA)"
                >
                  <Icon name="pencil" size={15} /> {ocr ?? 'Reconocer letra'}
                </button>
              )}
              {currentBook && (
                <button className="btn primary sm" onClick={newNoteHere}>
                  <Icon name="plus" size={15} /> Nota
                </button>
              )}
            </div>
            {tags.length > 0 && (
              <div className="tag-row filter">
                <button className={`tag ghost${tag === null ? ' on' : ''}`} onClick={() => setTag(null)} aria-pressed={tag === null}>
                  Todas
                </button>
                {tags.map((t) => (
                  <button key={t} className={`tag ghost${tag === t ? ' on' : ''}`} onClick={() => setTag(tag === t ? null : t)} aria-pressed={tag === t}>
                    {t} <span className="muted small">{tagCounts.get(t)}</span>
                  </button>
                ))}
              </div>
            )}
            {list.length === 0 ? (
              <p className="muted small">
                {needle
                  ? 'Sin resultados.'
                  : 'Aún no hay notas aquí. Crea una nueva o, desde Estudio, mueve una nota a este cuaderno con el selector «Cuaderno».'}
              </p>
            ) : (
              <ul className="nb-note-list">
                {list.map((n) => (
                  <li key={n.id}>
                    <button className="nb-note" onClick={() => open(n)}>
                      <span className="nb-note-title">
                        {n.kind === 'synth' ? '✦ ' : ''}
                        {n.title || 'Sin título'}
                      </span>
                      <span className="nb-note-snippet muted small">{htmlToText(n.html).slice(0, 140) || 'Nota a mano o vacía'}</span>
                      <span className="muted small">
                        {n.docId && docName.get(n.docId) ? `📄 ${docName.get(n.docId)} · ` : ''}
                        {fmt(new Date(n.updatedAt), { day: 'numeric', month: 'short' })}
                        {(n.tags ?? []).map((t) => (
                          <span key={t} className="tag mini">
                            {t}
                          </span>
                        ))}
                      </span>
                    </button>
                    <select
                      className="select xs"
                      value={n.notebookId ?? ''}
                      onChange={(e) => updateNote(n.id, { notebookId: e.target.value || null })}
                      aria-label="Mover a cuaderno"
                      title="Mover a otro cuaderno"
                    >
                      <option value="">Sin cuaderno</option>
                      {notebooks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {dialog && <NotebookDialog notebook={dialog.notebook} onClose={() => setDialog(null)} onCreated={(id) => setSelected(id)} />}
    </div>
  );
}
