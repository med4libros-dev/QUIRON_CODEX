import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { cropPage } from '../../lib/crop';
import { escapeHtml } from '../../lib/html';
import { addInkImage } from '../../lib/inkImages';
import { SPECIALTIES, TOPIC, TOPICS } from '../../internship/curriculum';
import { ensureTopicNote } from '../../internship/openLesson';
import { GUARD_FIELDS, topicsForDoc, useTopicStore, type GuardField } from '../../internship/topicStore';
import { pdfRefHtml, useBridge } from '../../store/bridge';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import { useUI, type Pearl } from '../../store/ui';
import { useHy } from '../../hy/store';

/** Destino «nota abierta» (sin tema del temario). */
const OPEN_NOTE = '';

/**
 * Extractor de perlas clínicas: menú flotante que aparece al seleccionar texto del PDF
 * (mouse o lápiz) o al recortar una zona con la herramienta Recorte.
 */
export function PearlMenu() {
  const pearl = useUI((s) => s.pearl);
  if (!pearl) return null;
  return <PearlMenuInner key={`${pearl.docId}:${pearl.page}:${pearl.x}:${pearl.y}`} pearl={pearl} />;
}

function PearlMenuInner({ pearl }: { pearl: Pearl }) {
  const setPearl = useUI((s) => s.setPearl);
  const ref = useRef<HTMLDivElement>(null);
  const linked = useMemo(() => topicsForDoc(pearl.docId), [pearl.docId]);
  const lastTopicId = useTopicStore((s) => s.lastTopicId);
  const [topicId, setTopicId] = useState<string>(() => linked[0] ?? lastTopicId ?? OPEN_NOTE);
  const [guardOpen, setGuardOpen] = useState(false);
  const [pos, setPos] = useState({ left: pearl.x, top: pearl.y + 8 });
  const docName = useLibrary((s) => s.docs.find((d) => d.id === pearl.docId)?.name ?? 'PDF');

  // Mantener el menú dentro de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = pearl.x - w / 2;
    let top = pearl.y + 10;
    if (top + h > window.innerHeight - 8) top = Math.max(8, pearl.y - h - 40);
    // Dentro del panel del PDF (sin tapar la barra lateral ni las notas, si cabe).
    const pane = document.querySelector('.pdf-scroll')?.getBoundingClientRect();
    const minL = pane && pane.width > w + 16 ? pane.left + 8 : 8;
    const maxL = pane && pane.width > w + 16 ? pane.right - w - 8 : window.innerWidth - w - 8;
    left = Math.min(Math.max(minL, left), maxL);
    setPos({ left, top });
  }, [pearl.x, pearl.y, guardOpen]);

  const close = () => setPearl(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    // Tras el gesto que lo abrió (evita cerrarse con el mismo clic).
    const t = setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('scroll', onScroll, true);
    }, 50);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = (msg: string) => {
    document.getSelection()?.removeAllRanges();
    setPearl(null);
    useUI.getState().showToast(msg);
  };

  const pageEl = () => document.querySelector(`.pdf-scroll .pdf-page[data-page="${pearl.page}"]`);
  const image = () => pearl.image || cropPage(pageEl(), pearl.rect);

  /** Nota destino: la del tema elegido (se crea si no existe) o la nota abierta. */
  const targetNote = (): { noteId: string; label: string } => {
    const st = useSettings.getState();
    if (topicId && TOPIC[topicId]) {
      useTopicStore.getState().setLastTopic(topicId);
      const { noteId, notebookId } = ensureTopicNote(TOPIC[topicId]);
      if (st.notebookScope !== notebookId) st.setNotebookScope(notebookId);
      useSettings.getState().setActiveNote(noteId);
      return { noteId, label: TOPIC[topicId].title };
    }
    const notes = useNotes.getState();
    const open = st.activeNoteId && notes.notes.find((n) => n.id === st.activeNoteId);
    if (open) return { noteId: open.id, label: open.title || 'nota abierta' };
    const id = notes.createNote({ docId: pearl.docId, notebookId: null, title: `Perlas · ${docName}` });
    st.setActiveNote(id);
    return { noteId: id, label: 'una nota nueva' };
  };

  const ref_ = () => `<p class="pearl-src">${pdfRefHtml(pearl.docId, docName, pearl.page)}</p>`;

  const toNote = () => {
    const { noteId, label } = targetNote();
    const body = pearl.image
      ? `<p><img class="pearl-img" src="${pearl.image}" alt="${escapeHtml(pearl.text.slice(0, 120) || 'Recorte de la GPC')}"></p>`
      : `<blockquote class="pearl">${escapeHtml(pearl.text)}</blockquote>`;
    useBridge.getState().insertIntoNote(body + ref_(), { noteId, append: true });
    done(`Perla enviada a «${label}» con referencia a la p. ${pearl.page}`);
  };

  const toCard = () => {
    useUI.getState().setCardDraft({
      topicId: topicId || null,
      front: '',
      back: pearl.image ? pearl.text : pearl.text,
      image: pearl.image,
      source: { docId: pearl.docId, docName, page: pearl.page },
    });
    document.getSelection()?.removeAllRanges();
    setPearl(null);
  };

  const toCanvas = async () => {
    const src = image();
    if (!src) return done('No se pudo capturar la zona: espera a que cargue la página.');
    const { noteId, label } = targetNote();
    await addInkImage(noteId, src);
    const st = useSettings.getState();
    if (st.paneMode === 'pdf') st.setPaneMode('both');
    useBridge.getState().requestTab('ink');
    done(`Recorte pegado en el lienzo de «${label}»: ya puedes rayar encima`);
  };

  const toHy = () => {
    useHy.getState().add({
      kind: 'perla',
      title: '',
      text: pearl.text.slice(0, 600),
      explain: '',
      topicId: topicId || null,
      source: { docId: pearl.docId, docName, page: pearl.page },
    });
    if (topicId) useTopicStore.getState().setLastTopic(topicId);
    done(`Guardada en Perlas HY${topicId ? ` de «${TOPIC[topicId].title}»` : ''}`);
  };

  const toGuard = (field: GuardField) => {
    if (!topicId) return;
    useTopicStore.getState().appendGuard(topicId, field, `${pearl.text} (${docName}, p. ${pearl.page})`);
    done(`Añadido a la Vista de Guardia de «${TOPIC[topicId].title}»`);
  };

  return (
    <div ref={ref} className="pearl-menu" style={{ left: pos.left, top: pos.top }} role="dialog" aria-label="Perla clínica">
      <div className="pearl-head">
        <span className="pearl-kind">{pearl.image ? 'Recorte' : 'Perla'} · p. {pearl.page}</span>
        <select className="select xs" value={topicId} onChange={(e) => setTopicId(e.target.value)} aria-label="Tema destino" title="Tema destino">
          <option value={OPEN_NOTE}>Nota abierta</option>
          {linked.length > 0 && (
            <optgroup label="Vinculados a este PDF">
              {linked.map((id) => (
                <option key={id} value={id}>
                  {TOPIC[id]?.title}
                </option>
              ))}
            </optgroup>
          )}
          {SPECIALTIES.map((sp) => (
            <optgroup key={sp.id} label={sp.name}>
              {TOPICS.filter((t) => t.specialty === sp.id).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="pearl-actions">
        <button className="pearl-btn" onClick={toNote} disabled={!pearl.text && !pearl.image} title="Enviar a los apuntes del tema con referencia a la página">
          <Icon name="text" size={16} /> Apunte
        </button>
        <button className="pearl-btn" onClick={toCard} title="Convertir en flashcard (el texto va al reverso)">
          <Icon name="cards" size={16} /> Flashcard
        </button>
        <button
          className="pearl-btn"
          onClick={() => {
            useUI.getState().setCloze({ docId: pearl.docId, items: [{ text: pearl.text, page: pearl.page }], topicId: topicId && topicId !== OPEN_NOTE ? topicId : null });
            document.getSelection()?.removeAllRanges();
            setPearl(null);
          }}
          disabled={!pearl.text || pearl.text.trim().split(/\s+/).length < 3}
          title="Flashcard de huecos: escondes las palabras clave y tratas de recordarlas"
        >
          <Icon name="square" size={16} /> Huecos
        </button>
        <button className="pearl-btn" onClick={() => void toCanvas()} title="Pegar como imagen en el lienzo para rayar encima">
          <Icon name="crop" size={16} /> Lienzo
        </button>
        <button className="pearl-btn" onClick={toHy} disabled={!pearl.text} title="Guardar como perla de alto rendimiento (dato de 1 línea)">
          <Icon name="star" size={16} /> Perla HY
        </button>
        <button
          className={`pearl-btn${guardOpen ? ' active' : ''}`}
          onClick={() => setGuardOpen((v) => !v)}
          disabled={!topicId || !pearl.text}
          title={topicId ? 'Añadir a la Vista de Guardia del tema' : 'Elige un tema para añadir a su Vista de Guardia'}
        >
          <Icon name="shield" size={16} /> Guardia
        </button>
      </div>
      {guardOpen && topicId && (
        <div className="pearl-guard">
          {GUARD_FIELDS.map((f) => (
            <button key={f.id} className="btn ghost sm" onClick={() => toGuard(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      {pearl.text && <p className="pearl-preview">{pearl.text.length > 160 ? `${pearl.text.slice(0, 160)}…` : pearl.text}</p>}
    </div>
  );
}

export function Toast() {
  const toast = useUI((s) => s.toast);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    setShown(toast.text);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  if (!shown) return null;
  return (
    <div className="toast" role="status">
      <Icon name="check" size={15} /> {shown}
    </div>
  );
}
