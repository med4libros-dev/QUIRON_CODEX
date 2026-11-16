import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useCards } from '../../flashcards/store';
import { recognizeCrop } from '../../lib/inkOcr';
import { useUI } from '../../store/ui';
import type { Stroke } from '../../types';

interface Props {
  /** Los trazos encerrados con el lazo, ya filtrados. */
  strokes: Stroke[];
  /** Caja de la selección en coordenadas de hoja (ancho lógico 1000). */
  box: { x: number; y: number; w: number; h: number };
  /** Alto lógico de la hoja, para no recortar de más. */
  pageH: number;
  /** Ancho lógico; en el margen del PDF la zona útil pasa de 1000. */
  pageW?: number;
  /** Tema al que pertenece la nota, para que la flashcard quede ligada. */
  topicId?: string | null;
  /** Vuelca el texto al final de la nota de texto. */
  onToNote: (text: string) => void;
  onClose: () => void;
}

type Mode = 'text' | 'formula';

/**
 * Lo que encerraste con el lazo, leído. Transcribe solo ese recorte (no la hoja entera) y te deja
 * corregirlo antes de llevártelo: al editor, al portapapeles o a una flashcard.
 *
 * Sale de este equipo únicamente la imagen del recorte, y solo cuando lo pides.
 */
export function InkCropModal({ strokes, box, pageH, pageW, topicId, onToNote, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [front, setFront] = useState('');
  const [asCard, setAsCard] = useState(false);
  const addCard = useCards((s) => s.addCard);
  const showToast = useUI((s) => s.showToast);
  const ta = useRef<HTMLTextAreaElement>(null);

  const read = async (m: Mode) => {
    setBusy(true);
    setError('');
    try {
      const t = await recognizeCrop(strokes, box, m, pageH, pageW);
      setText(t);
      if (!t) setError('No se leyó nada en la selección.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la selección.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void read('text');
    // Solo al abrir: los cambios de modo los dispara el usuario.
  }, []);

  useEffect(() => {
    if (!busy && text) ta.current?.focus();
  }, [busy, text]);

  const switchMode = (m: Mode) => {
    setMode(m);
    void read(m);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    showToast('Copiado');
    onClose();
  };

  const toNote = () => {
    onToNote(text);
    showToast('Al final de la nota');
    onClose();
  };

  const makeCard = () => {
    addCard({ front: front.trim() || 'Explica esto', back: text.trim(), topicId: topicId ?? null });
    showToast('Flashcard creada');
    onClose();
  };

  const footer = busy ? null : asCard ? (
    <>
      <button className="btn ghost" onClick={() => setAsCard(false)}>
        Atrás
      </button>
      <button className="btn primary" onClick={makeCard} disabled={!text.trim()}>
        Crear flashcard
      </button>
    </>
  ) : (
    <>
      <button className="btn ghost" onClick={copy} disabled={!text.trim()}>
        <Icon name="copy" size={15} /> Copiar
      </button>
      <button className="btn ghost" onClick={() => setAsCard(true)} disabled={!text.trim()}>
        <Icon name="cards" size={15} /> Flashcard
      </button>
      <button className="btn primary" onClick={toNote} disabled={!text.trim()}>
        <Icon name="text" size={15} /> Al editor
      </button>
    </>
  );

  return (
    <Modal title="Leer la selección" onClose={onClose} width={620} footer={footer}>
      <div className="seg sm" role="tablist" aria-label="Qué leer">
        <button role="tab" aria-selected={mode === 'text'} onClick={() => switchMode('text')} disabled={busy}>
          Texto
        </button>
        <button role="tab" aria-selected={mode === 'formula'} onClick={() => switchMode('formula')} disabled={busy}>
          Fórmula
        </button>
      </div>

      {busy ? (
        <p className="muted crop-wait">Leyendo tu letra…</p>
      ) : (
        <>
          {error && <p className="small warn-text">{error}</p>}
          <textarea
            ref={ta}
            className="input crop-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={mode === 'formula' ? 2 : 8}
            aria-label="Transcripción"
            placeholder="Aquí aparece lo que leyó. Corrígelo si hace falta."
          />
          <p className="small muted">Revisa antes de llevártelo: la lectura de letra manuscrita se equivoca.</p>

          {asCard && (
            <label className="field">
              <span>Pregunta de la flashcard</span>
              <input className="input" value={front} onChange={(e) => setFront(e.target.value)} placeholder="¿Qué quieres recordar de esto?" />
            </label>
          )}
        </>
      )}
    </Modal>
  );
}
