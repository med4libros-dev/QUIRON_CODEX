import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { aiMissingMsg } from '../../lib/ai';
import { dictationSupported, startDictation } from '../../lib/dictation';
import { escapeHtml } from '../../lib/html';
import { recognizeNote, recognizeSheet, sheetsWithContent } from '../../lib/inkOcr';
import { restoreVersion, versionsOf, type NoteVersion } from '../../lib/noteHistory';
import { useAiReady } from '../../lib/useAi';
import { useBridge } from '../../store/bridge';
import { useNotes } from '../../store/notes';
import { useUI } from '../../store/ui';
import type { Note } from '../../types';

/** Convierte texto plano (con saltos de línea) en párrafos para el editor. */
const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('');

/* ---------- Reconocer mi letra ---------- */

/**
 * Reconocimiento de escritura: manda la imagen de tus hojas al motor de IA que tengas
 * configurado y te devuelve el texto. Queda guardado en la nota para que Ctrl+K lo encuentre,
 * y tú decides si lo pasas al editor.
 */
export function OcrDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const ready = useAiReady();
  const insert = useBridge((s) => s.insertIntoNote);
  const showToast = useUI((s) => s.showToast);
  const [sheets, setSheets] = useState<number[] | null>(null);
  const [which, setWhich] = useState<'all' | number>('all');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [text, setText] = useState(note.inkText ?? '');
  const [err, setErr] = useState('');

  useEffect(() => {
    sheetsWithContent(note.id).then(setSheets).catch(() => setSheets([]));
  }, [note.id]);

  const run = async () => {
    setBusy(true);
    setErr('');
    setProgress('');
    try {
      const out =
        which === 'all'
          ? await recognizeNote(note.id, (d, t) => setProgress(t > 1 ? `Hoja ${Math.min(d + 1, t)} de ${t}…` : 'Leyendo tu letra…'))
          : await recognizeSheet(note.id, which);
      setText(out || '(no se encontró nada escrito en esa hoja)');
      if (which === 'all') showToast('Ya puedes buscar lo que escribiste a mano con Ctrl+K.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Modal title="Reconocer mi letra" onClose={onClose} width={620}>
      {!ready ? (
        <p className="small error">{aiMissingMsg()}</p>
      ) : (
        <>
          <p className="muted small">
            Se envía la imagen de la hoja al motor de IA que elegiste para que la transcriba. Solo sale tu propia hoja, y solo cuando
            tocas el botón. El texto se guarda en la nota para que el buscador lo encuentre.
          </p>
          <div className="row gap wrap">
            <label className="small muted">
              Qué leer
              <select className="input" value={String(which)} onChange={(e) => setWhich(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Hojas a reconocer">
                <option value="all">Todas las hojas escritas</option>
                {(sheets ?? []).map((p) => (
                  <option key={p} value={p}>
                    Solo la hoja {p + 1}
                  </option>
                ))}
              </select>
            </label>
            <div className="spacer" />
            <button className="btn primary" onClick={() => void run()} disabled={busy || sheets?.length === 0}>
              {busy ? progress || 'Leyendo…' : 'Reconocer'}
            </button>
          </div>
          {sheets?.length === 0 && <p className="muted small">Esta nota no tiene nada escrito a mano todavía.</p>}
          {err && <p className="small error">{err}</p>}
          {text && (
            <>
              <label className="small muted ocr-label">
                Transcripción (puedes corregirla antes de pasarla)
                <textarea className="input ocr-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
              </label>
              <div className="row gap">
                <span className="muted small">{text.trim().split(/\s+/).length} palabras</span>
                <div className="spacer" />
                <button
                  className="btn"
                  onClick={() => {
                    useNotes.getState().updateNote(note.id, { inkText: text, inkTextAt: Date.now() });
                    showToast('Guardado para el buscador.');
                  }}
                  title="Guardar el texto para que Ctrl+K lo encuentre (sin tocar el editor)"
                >
                  <Icon name="search" size={15} /> Solo para buscar
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    insert(toHtml(text), { noteId: note.id, append: true });
                    showToast('Transcripción agregada al texto de la nota.');
                    onClose();
                  }}
                >
                  <Icon name="insert" size={15} /> Pasar al texto de la nota
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

/* ---------- Historial de versiones ---------- */

const when = (at: number) => new Date(at).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Versiones anteriores del texto de la nota: por si borraste algo sin querer. */
export function HistoryDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const [list, setList] = useState<NoteVersion[] | null>(null);
  const showToast = useUI((s) => s.showToast);
  const reload = () => versionsOf(note.id).then((v) => setList([...v].reverse()));

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const preview = (html: string) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) || '(sin texto)';
  };

  return (
    <Modal title={`Historial · ${note.title}`} onClose={onClose} width={560}>
      {list === null ? (
        <p className="muted small">Buscando versiones…</p>
      ) : !list.length ? (
        <p className="muted small">
          Todavía no hay versiones guardadas. Se guarda una cada cierto rato mientras escribes y siempre que borras un buen pedazo.
        </p>
      ) : (
        <ul className="hist-list">
          {list.map((v) => (
            <li key={v.at}>
              <span className="muted small tabular">{when(v.at)}</span>
              <span className="hist-prev ellipsis" title={preview(v.html)}>
                {preview(v.html)}
              </span>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  if (!confirm('¿Volver a esta versión? Lo que tienes ahora se guarda en el historial.')) return;
                  await restoreVersion(note.id, v.at);
                  await reload();
                  showToast('Nota restaurada. Lo anterior quedó en el historial.');
                }}
              >
                <Icon name="undo" size={14} /> Volver a esta
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/* ---------- Dictado ---------- */

/** Dictado por voz: habla, revisa el texto y lo agregas a la nota. */
export function DictationDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const insert = useBridge((s) => s.insertIntoNote);
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [on, setOn] = useState(false);
  const [err, setErr] = useState('');
  const stop = useRef<(() => void) | null>(null);
  const supported = dictationSupported();

  useEffect(() => () => stop.current?.(), []);

  const toggle = () => {
    if (on) {
      stop.current?.();
      stop.current = null;
      setOn(false);
      setPartial('');
      return;
    }
    setErr('');
    setOn(true);
    stop.current = startDictation({
      onText: (t) => t && setText((prev) => `${prev}${prev && !/\s$/.test(prev) ? ' ' : ''}${t}`),
      onPartial: setPartial,
      onError: (m) => {
        setErr(m);
        setOn(false);
      },
      onEnd: () => setOn(false),
    });
  };

  return (
    <Modal title="Dictar a la nota" onClose={onClose} width={560}>
      {!supported ? (
        <p className="small error">
          Este equipo no trae reconocimiento de voz disponible para la app. En Windows suele funcionar con la app de escritorio
          actualizada y el micrófono permitido.
        </p>
      ) : (
        <>
          <p className="muted small">
            Habla con calma y revisa el texto antes de agregarlo: el dictado no pone acentos médicos perfectos. El micrófono se apaga
            al cerrar esta ventana.
          </p>
          <div className="row gap">
            <button className={`btn ${on ? 'danger' : 'primary'}`} onClick={toggle}>
              <Icon name="mic" size={15} /> {on ? 'Detener' : 'Empezar a dictar'}
            </button>
            {on && <span className="small rec-dot">Escuchando…</span>}
          </div>
          {err && <p className="small error">{err}</p>}
          <textarea
            className="input dict-text"
            rows={9}
            value={text + (partial ? ` ${partial}` : '')}
            onChange={(e) => setText(e.target.value)}
            placeholder="Aquí va apareciendo lo que dictes…"
            aria-label="Texto dictado"
          />
          <div className="row gap">
            <button className="btn ghost sm" onClick={() => setText('')} disabled={!text}>
              Limpiar
            </button>
            <div className="spacer" />
            <button
              className="btn primary"
              disabled={!text.trim()}
              onClick={() => {
                stop.current?.();
                insert(toHtml(text), { noteId: note.id, append: true });
                onClose();
              }}
            >
              <Icon name="insert" size={15} /> Agregar a la nota
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Etiquetas ---------- */

/** Etiquetas de la nota: para filtrar después («guardia», «dudas», «ENARM»…). */
export function TagsDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const setTags = useNotes((s) => s.setTags);
  const notes = useNotes((s) => s.notes);
  const [draft, setDraft] = useState('');
  const tags = note.tags ?? [];
  const all = [...new Set(notes.flatMap((n) => n.tags ?? []))].filter((t) => !tags.includes(t)).sort();

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 24);
    if (!t || tags.includes(t) || tags.length >= 8) return;
    setTags(note.id, [...tags, t]);
    setDraft('');
  };

  return (
    <Modal title="Etiquetas de la nota" onClose={onClose} width={460}>
      <div className="tag-row">
        {tags.length ? (
          tags.map((t) => (
            <span key={t} className="tag">
              {t}
              <button onClick={() => setTags(note.id, tags.filter((x) => x !== t))} aria-label={`Quitar la etiqueta ${t}`} title={`Quitar «${t}»`}>
                <Icon name="x" size={11} />
              </button>
            </span>
          ))
        ) : (
          <span className="muted small">Sin etiquetas.</span>
        )}
      </div>
      <div className="row gap">
        <input
          className="input"
          autoFocus
          value={draft}
          maxLength={24}
          placeholder="Nueva etiqueta…"
          aria-label="Nueva etiqueta"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(draft)}
        />
        <button className="btn" onClick={() => add(draft)} disabled={!draft.trim() || tags.length >= 8}>
          Agregar
        </button>
      </div>
      {all.length > 0 && (
        <>
          <p className="muted small tag-reuse">Ya usaste antes:</p>
          <div className="tag-row">
            {all.slice(0, 20).map((t) => (
              <button key={t} className="tag ghost" onClick={() => add(t)} title={`Poner «${t}» a esta nota`}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {tags.length >= 8 && <p className="muted small">Máximo 8 etiquetas por nota.</p>}
    </Modal>
  );
}
