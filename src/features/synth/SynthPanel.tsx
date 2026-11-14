import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { exportToPdf } from '../../lib/exportPdf';
import { htmlToText } from '../../lib/html';
import { extractPagesText } from '../../lib/pdf';
import { synthesizeWithAi } from '../../lib/synth/claude';
import { synthesizeLocal } from '../../lib/synth/local';
import type { SynthInput } from '../../lib/synth/types';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import { AI_LABEL } from '../../lib/ai';
import { useAiProvider, useAiReady } from '../../lib/useAi';
import { HIGHLIGHT_META, type Highlight, type Note, type Sticky } from '../../types';

const EMPTY: Highlight[] = [];
const EMPTY_ST: Sticky[] = [];
const MAX_LOCAL_PAGES = 80;

/**
 * Asistente de síntesis: convierte lo estudiado (resaltados + notas + páginas del PDF)
 * en una hoja de repaso que se guarda como nota y se exporta a PDF.
 */
export function SynthPanel({
  docId,
  note,
  notebookId,
  onSaved,
}: {
  docId: string | null;
  note: Note | null;
  notebookId: string | null;
  onSaved: (noteId: string) => void;
}) {
  const doc = useLibrary((s) => (docId ? s.docs.find((d) => d.id === docId) : undefined));
  const highlights = useLibrary((s) => (docId ? s.highlights[docId] : undefined)) ?? EMPTY;
  const stickies = useLibrary((s) => (docId ? s.stickies[docId] : undefined)) ?? EMPTY_ST;
  const goTo = useLibrary((s) => s.goTo);
  const removeHighlight = useLibrary((s) => s.removeHighlight);
  const createNote = useNotes((s) => s.createNote);
  const ready = useAiReady();
  const provider = useAiProvider();

  const [engine, setEngine] = useState<'local' | 'claude'>('local');
  const [useNoteText, setUseNoteText] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState('');

  const sorted = useMemo(() => [...highlights].sort((a, b) => a.page - b.page || a.rect.y - b.rect.y), [highlights]);
  const title = doc?.name ?? note?.title ?? 'Notas generales';

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      let sourceText = '';
      const a = parseInt(from, 10);
      const b = parseInt(to || from, 10);
      if (docId && a > 0) {
        const last = engine === 'local' ? Math.min(b, a + MAX_LOCAL_PAGES - 1) : b;
        sourceText = await extractPagesText(docId, a, last);
      }
      const input: SynthInput = {
        title: a > 0 ? `${title} (pp. ${a}–${b || a})` : title,
        fragments: sorted.filter((h) => h.text).map((h) => ({ text: h.text, page: h.page, color: h.color })),
        notesText: [
          useNoteText && note ? htmlToText(note.html) : '',
          ...stickies.filter((st) => st.text.trim()).map((st) => `${st.text.trim()} (post-it, p. ${st.page})`),
        ]
          .filter(Boolean)
          .join('\n'),
        sourceText,
      };
      const html = engine === 'local' ? synthesizeLocal(input) : await synthesizeWithAi(input);
      setResult(html);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const id = createNote({ docId, notebookId, title: `Repaso · ${title}`, kind: 'synth', html: result });
    onSaved(id);
  };

  const withText = sorted.filter((h) => h.text).length;

  return (
    <div className="synth">
      <section className="card">
        <h4>Material de entrada</h4>
        {docId ? (
          <>
            <p className="muted small">
              {sorted.length} resaltado{sorted.length === 1 ? '' : 's'} en <strong>{doc?.name}</strong>
              {sorted.length > withText ? ` · ${sorted.length - withText} sin texto detectable (¿PDF escaneado?)` : ''}
              {stickies.some((st) => st.text.trim()) ? ` · ${stickies.filter((st) => st.text.trim()).length} post-its` : ''}
            </p>
            {sorted.length > 0 && (
              <ul className="hl-list">
                {sorted.map((h) => (
                  <li key={h.id}>
                    <span className="hl-dot" style={{ background: HIGHLIGHT_META[h.color].solid }} title={HIGHLIGHT_META[h.color].label} />
                    <button className="hl-page" onClick={() => goTo(docId, h.page)} title="Ir a la página">
                      p. {h.page}
                    </button>
                    <span className={`hl-text${h.text ? '' : ' muted'}`}>{h.text || '(área sin texto)'}</span>
                    <button className="icon-btn xs" onClick={() => removeHighlight(docId, h.id)} title="Quitar resaltado">
                      <Icon name="x" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="field-row">
              <span className="muted small">Incluir texto de páginas</span>
              <input className="input xs tabular" inputMode="numeric" placeholder="desde" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} />
              <span className="muted small">a</span>
              <input className="input xs tabular" inputMode="numeric" placeholder="hasta" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} />
            </div>
          </>
        ) : (
          <p className="muted small">Abre un PDF para usar sus resaltados y páginas. Sin PDF, la síntesis usa solo tu nota.</p>
        )}
        {note && (
          <label className="check">
            <input type="checkbox" checked={useNoteText} onChange={(e) => setUseNoteText(e.target.checked)} />
            Incluir el texto de la nota «{note.title}»
          </label>
        )}

        <div className="field-row">
          <div className="seg" role="radiogroup" aria-label="Motor de síntesis">
            <button className={engine === 'local' ? 'active' : ''} onClick={() => setEngine('local')} title="Sin internet ni costo; extractivo">
              Local
            </button>
            <button className={engine === 'claude' ? 'active' : ''} onClick={() => setEngine('claude')} title="Resúmenes redactados con IA (Claude o Gemini; requiere API key)">
              Claude (IA)
            </button>
          </div>
          <div className="spacer" />
          <button className="btn primary" onClick={() => void generate()} disabled={busy}>
            <Icon name="sparkles" size={16} /> {busy ? 'Generando…' : 'Generar hoja de repaso'}
          </button>
        </div>

        {engine === 'claude' && !ready && (
          <p className="small warn-text">
            Falta tu API key de {AI_LABEL[provider]}: agrégala en Ajustes → Preferencias → IA (puedes usar Claude o Gemini).
          </p>
        )}
        {error && <p className="error small">{error}</p>}
      </section>

      {result && (
        <section className="card synth-result">
          <div className="field-row">
            <h4>Vista previa</h4>
            <div className="spacer" />
            <button className="btn ghost sm" onClick={() => void exportToPdf({ title: `Repaso · ${title}`, html: result })}>
              <Icon name="download" size={16} /> PDF
            </button>
            <button className="btn primary sm" onClick={save}>
              <Icon name="check" size={16} /> Guardar como nota
            </button>
          </div>
          <div className="prose" dangerouslySetInnerHTML={{ __html: result }} />
        </section>
      )}
    </div>
  );
}
