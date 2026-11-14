import { useTopicStore } from '../../internship/topicStore';
import { useMemo, useState } from 'react';
import { FilePick } from '../../components/FilePick';
import { Icon } from '../../components/Icon';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { usePlanner } from '../../store/planner';
import { useSettings } from '../../store/settings';
import type { DocMeta } from '../../types';

const formatSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function FileManager({ onUpload, onClose }: { onUpload: (files: File[]) => void; onClose: () => void }) {
  const docs = useLibrary((s) => s.docs);
  const removeDoc = useLibrary((s) => s.removeDoc);
  const renameDoc = useLibrary((s) => s.renameDoc);
  const setDocSubject = useLibrary((s) => s.setDocSubject);
  const subjects = usePlanner((s) => s.subjects);
  const activeDocId = useSettings((s) => s.activeDocId);
  const setActiveDoc = useSettings((s) => s.setActiveDoc);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<string | null>(null);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return docs.filter(
      (d) =>
        (filter === 'all' || (filter === 'none' ? !d.subjectId : d.subjectId === filter)) &&
        (!needle || d.name.toLowerCase().includes(needle)),
    );
  }, [docs, q, filter]);

  const remove = async (d: DocMeta) => {
    if (!confirm(`¿Eliminar «${d.name}»?\nSe borran el archivo y sus resaltados. Sus notas se conservan como notas generales.`)) return;
    const notes = useNotes.getState();
    notes.notes.filter((n) => n.docId === d.id).forEach((n) => notes.updateNote(n.id, { docId: null }));
    await removeDoc(d.id);
    useTopicStore.getState().forgetDoc(d.id);
    if (activeDocId === d.id) setActiveDoc(null);
  };

  return (
    <aside className="library" aria-label="Biblioteca">
      <header className="library-head">
        <h3>Biblioteca</h3>
        <span className="muted small">{docs.length} PDF</span>
        <div className="spacer" />
        <FilePick onFiles={onUpload} className="btn primary sm">
          <Icon name="upload" size={16} /> Subir
        </FilePick>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar biblioteca">
          <Icon name="x" />
        </button>
      </header>
      <div className="library-filters">
        <label className="search">
          <Icon name="search" size={16} />
          <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas las materias</option>
          <option value="none">Sin materia</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <ul className="library-list">
        {list.length === 0 && <li className="muted small library-empty">{docs.length ? 'Sin resultados.' : 'Aún no hay PDFs.'}</li>}
        {list.map((d) => {
          const subj = d.subjectId ? subjectById.get(d.subjectId) : undefined;
          return (
            <li key={d.id} className={`library-item${d.id === activeDocId ? ' active' : ''}`}>
              <span className="subject-dot" style={{ background: subj?.color ?? 'var(--border-strong)' }} />
              <div className="library-main">
                {editing === d.id ? (
                  <input
                    className="input sm"
                    autoFocus
                    defaultValue={d.name}
                    onBlur={(e) => {
                      renameDoc(d.id, e.target.value.trim() || d.name);
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') e.currentTarget.value = d.name;
                      if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                    }}
                  />
                ) : (
                  <button
                    className="library-name"
                    onClick={() => {
                      setActiveDoc(d.id);
                      onClose();
                    }}
                    onDoubleClick={() => setEditing(d.id)}
                    title="Abrir · doble clic para renombrar"
                  >
                    {d.name}
                  </button>
                )}
                <div className="muted small">
                  {d.pageCount ? `${d.pageCount} págs · ` : ''}
                  {formatSize(d.size)}
                  {d.lastPage > 1 ? ` · vas en la p. ${d.lastPage}` : ''}
                </div>
              </div>
              <select
                className="select xs"
                value={d.subjectId ?? ''}
                onChange={(e) => setDocSubject(d.id, e.target.value || null)}
                aria-label="Materia"
              >
                <option value="">Materia…</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button className="icon-btn danger" onClick={() => void remove(d)} title="Eliminar">
                <Icon name="trash" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="library-foot muted small">Los archivos se guardan en este navegador (IndexedDB), no en la nube.</p>
    </aside>
  );
}
