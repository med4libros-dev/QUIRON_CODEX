import { useEffect, useMemo, useState } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { fmt } from '../../lib/date';
import { exportToPdf } from '../../lib/exportPdf';
import { exportToWord } from '../../lib/exportWord';
import { useBridge } from '../../store/bridge';
import { idb } from '../../lib/idb';
import { loadInkImages } from '../../lib/inkImages';
import { htmlToText } from '../../lib/html';
import { chunkText, speak, ttsSupported } from '../../lib/tts';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import type { Stroke } from '../../types';
import { NotebookDialog } from '../notebooks/NotebookDialog';
import { SynthPanel } from '../synth/SynthPanel';
import { InkCanvas } from './InkCanvas';
import { TextEditor } from './TextEditor';

type Tab = 'text' | 'ink' | 'synth';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'text', label: 'Texto', icon: 'text' },
  { id: 'ink', label: 'Lienzo', icon: 'pen' },
  { id: 'synth', label: 'Síntesis', icon: 'sparkles' },
];
const NEW_NOTEBOOK = '__new';

/**
 * Panel derecho. Muestra las notas de un "ámbito":
 *  - el PDF abierto (notas tomadas sobre ese documento), o
 *  - un cuaderno (notas de una materia/tema, vengan del PDF que vengan).
 */
export function NotesPanel() {
  const activeDocId = useSettings((s) => s.activeDocId);
  const activeNoteId = useSettings((s) => s.activeNoteId);
  const setActiveNote = useSettings((s) => s.setActiveNote);
  const scope = useSettings((s) => s.notebookScope);
  const setScope = useSettings((s) => s.setNotebookScope);
  const notes = useNotes((s) => s.notes);
  const notebooks = useNotes((s) => s.notebooks);
  const createNote = useNotes((s) => s.createNote);
  const deleteNote = useNotes((s) => s.deleteNote);
  const updateNote = useNotes((s) => s.updateNote);
  const hydrated = useNotes.useHydrated();
  const doc = useLibrary((s) => s.docs.find((d) => d.id === activeDocId));
  const docs = useLibrary((s) => s.docs);
  const [tab, setTab] = useState<Tab>('text');
  const [exporting, setExporting] = useState(false);
  const [nbDialog, setNbDialog] = useState(false);

  const book = notebooks.find((b) => b.id === scope) ?? null;
  // Si el PDF tiene materia y existe un cuaderno de esa materia, las notas nuevas van ahí.
  const autoBook = doc?.subjectId ? notebooks.find((b) => b.subjectId === doc.subjectId) ?? null : null;

  const scoped = useMemo(
    () =>
      notes
        .filter((n) => (book ? n.notebookId === book.id : n.docId === (activeDocId ?? null)))
        .sort((a, b) => a.createdAt - b.createdAt),
    [notes, book, activeDocId],
  );
  // La nota activa se mantiene visible aunque cambies de PDF (p. ej. al seguir un enlace a otra página).
  const note = scoped.find((n) => n.id === activeNoteId) ?? notes.find((n) => n.id === activeNoteId) ?? scoped[scoped.length - 1] ?? null;
  const options = note && !scoped.includes(note) ? [note, ...scoped] : scoped;

  // Algo pidió insertar contenido en la nota (p. ej. un marcador del PDF): mostrar el editor y asegurar una nota.
  const pending = useBridge((s) => s.pending);
  useEffect(() => {
    if (!pending) return;
    setTab('text');
    if (pending.noteId) {
      if (pending.noteId !== activeNoteId) setActiveNote(pending.noteId);
    } else if (!note && hydrated) newNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  const tabRequest = useBridge((s) => s.tabRequest);
  useEffect(() => {
    if (tabRequest) setTab(tabRequest.tab);
  }, [tabRequest]);
  const noteDocName = note?.docId ? docs.find((d) => d.id === note.docId)?.name : undefined;

  const newNote = () => {
    const target = book ?? autoBook;
    const title = book
      ? `${book.name} · ${fmt(new Date(), { day: 'numeric', month: 'short' })}`
      : doc
        ? `Notas · ${doc.name}`
        : 'Nota general';
    const id = createNote({ docId: activeDocId, notebookId: target?.id ?? null, title });
    setActiveNote(id);
    if (tab === 'synth') setTab('text');
  };

  const remove = () => {
    if (!note || !confirm(`¿Eliminar la nota «${note.title}»? Esto no se puede deshacer.`)) return;
    deleteNote(note.id);
    setActiveNote(null);
  };

  const exportPdf = async () => {
    if (!note) return;
    (document.activeElement as HTMLElement | null)?.blur(); // fuerza guardar lo último escrito
    setExporting(true);
    try {
      const strokes = (await idb.get<Stroke[]>('ink', note.id)) ?? [];
      const images = await loadInkImages(note.id);
      const fresh = useNotes.getState().notes.find((n) => n.id === note.id) ?? note;
      const nb = notebooks.find((b) => b.id === fresh.notebookId);
      await exportToPdf({
        title: fresh.title,
        html: fresh.html,
        strokes,
        inkPages: fresh.inkPages,
        images,
        subtitle: [nb ? `Cuaderno: ${nb.name}` : '', noteDocName ? `Fuente: ${noteDocName}` : ''].filter(Boolean).join('  ·  ') || undefined,
      });
    } catch (e) {
      alert(`No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="notes-panel">
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="Modo de notas">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={16} /> <span className="hide-narrow">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={newNote} title="Nueva nota">
          <Icon name="plus" />
        </button>
        {note && (
          <>
            {ttsSupported() && (
              <button
                className="icon-btn"
                onClick={() => {
                  const fresh = useNotes.getState().notes.find((n) => n.id === note.id);
                  speak(chunkText(htmlToText(fresh?.html ?? '')).map((text) => ({ text })), fresh?.title || 'Nota');
                }}
                title="Escuchar esta nota"
                aria-label="Escuchar esta nota"
              >
                <Icon name="speaker" size={16} />
              </button>
            )}
            <button className="btn ghost sm" onClick={() => void exportPdf()} disabled={exporting} title="Exportar nota a PDF (texto + escritura a mano)">
              <Icon name="download" size={15} /> PDF
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur();
                const fresh = useNotes.getState().notes.find((n) => n.id === note.id) ?? note;
                exportToWord(fresh.title, fresh.html, noteDocName ? `Fuente: ${noteDocName}` : undefined);
              }}
              title="Exportar a Word (.doc)"
            >
              <Icon name="download" size={15} /> Word
            </button>
            <button className="icon-btn danger" onClick={remove} title="Eliminar nota">
              <Icon name="trash" />
            </button>
          </>
        )}
      </div>

      <div className="notes-context">
        <label className="ctx-field">
          <Icon name={book ? 'notebook' : 'book'} size={15} />
          <select
            className="select bare"
            value={book?.id ?? ''}
            onChange={(e) => {
              if (e.target.value === NEW_NOTEBOOK) setNbDialog(true);
              else setScope(e.target.value || null);
            }}
            aria-label="Mostrar notas de"
          >
            <option value="">{doc ? `Este PDF · ${doc.name}` : 'Notas sin PDF'}</option>
            {notebooks.length > 0 && (
              <optgroup label="Cuadernos">
                {notebooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={NEW_NOTEBOOK}>＋ Nuevo cuaderno…</option>
          </select>
        </label>
        {note && options.length > 1 && (
          <label className="ctx-field">
            <Icon name="text" size={15} />
            <select className="select bare" value={note.id} onChange={(e) => setActiveNote(e.target.value)} aria-label="Nota activa">
              {options.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.kind === 'synth' ? '✦ ' : ''}
                  {n.title || 'Sin título'}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="muted small ctx-count">
          {scoped.length} nota{scoped.length === 1 ? '' : 's'}
        </span>
      </div>

      {tab !== 'synth' && note && (
        <div className="note-head">
          <input
            className="note-title"
            value={note.title}
            onChange={(e) => updateNote(note.id, { title: e.target.value })}
            placeholder="Título de la nota"
            aria-label="Título de la nota"
          />
          <select
            className="select xs"
            value={note.notebookId ?? ''}
            onChange={(e) => {
              if (e.target.value === NEW_NOTEBOOK) setNbDialog(true);
              else updateNote(note.id, { notebookId: e.target.value || null });
            }}
            title="Cuaderno de esta nota"
            aria-label="Cuaderno de esta nota"
          >
            <option value="">Sin cuaderno</option>
            {notebooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={NEW_NOTEBOOK}>＋ Nuevo cuaderno…</option>
          </select>
        </div>
      )}

      <div className="notes-body">
        {tab === 'synth' ? (
          <SynthPanel
            docId={activeDocId}
            note={note}
            notebookId={book?.id ?? autoBook?.id ?? null}
            onSaved={(id) => {
              setActiveNote(id);
              setTab('text');
            }}
          />
        ) : !hydrated ? null : !note ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Icon name={book ? 'notebook' : 'pen'} size={26} />
            </div>
            <h3>{book ? `Cuaderno «${book.name}» vacío` : doc ? 'Sin notas para este documento' : 'Notas sin PDF'}</h3>
            <p className="muted">Escribe con teclado o a mano con tu lápiz, junto al PDF.</p>
            <button className="btn primary" onClick={newNote}>
              <Icon name="plus" /> Nueva nota
            </button>
          </div>
        ) : tab === 'text' ? (
          <TextEditor key={note.id} note={note} />
        ) : (
          <InkCanvas key={note.id} note={note} />
        )}
      </div>

      {nbDialog && (
        <NotebookDialog
          onClose={() => setNbDialog(false)}
          onCreated={(id) => {
            if (note && tab !== 'synth' && !note.notebookId) updateNote(note.id, { notebookId: id });
            setScope(id);
          }}
        />
      )}
    </div>
  );
}
