import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TopicSelect } from '../flashcards/FlashcardUI';
import { TOPIC } from '../internship/curriculum';
import { GUARD_FIELDS, privacyWarnings, useTopicStore } from '../internship/topicStore';
import { createStore } from '../lib/createStore';
import { downloadBlob } from '../lib/exportPdf';
import { useUI } from '../store/ui';
import { DEFAULT_TEMPLATES, FIELDS, NOTE_TYPES, bullets, fillTemplate, useSoapTemplates, type NoteType } from './templates';

/**
 * Borrador de la nota en curso. NO se guarda en disco: los datos del paciente
 * viven solo mientras la app está abierta (se borran al recargar o con «Limpiar»).
 */
const useSoapDraft = createStore<{ topicId: string | null; type: NoteType; values: Record<string, string> }>(() => ({
  topicId: null,
  type: 'evolucion',
  values: {},
}));

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Abre la nota con un tema ya elegido (desde la ficha del tema). */
export const setSoapTopic = (topicId: string) => useSoapDraft.setState({ topicId });

/** Precarga la nota desde la lista del turno (datos solo en memoria). */
export const prefillSoap = (p: { topicId: string | null; values: Record<string, string> }) =>
  useSoapDraft.setState((s) => ({ topicId: p.topicId ?? s.topicId, values: Object.fromEntries(Object.entries(p.values).filter(([, v]) => v)) }));

const nowParts = () => {
  const d = new Date();
  return {
    fecha: d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

/** Generador de notas médicas (SOAP, ingreso, postquirúrgica, egreso) a partir de la ficha del tema. */
export function SoapModal() {
  const open = useUI((s) => s.soapOpen);
  const setOpen = useUI((s) => s.setSoapOpen);
  const draft = useSoapDraft((s) => s);
  const guard = useTopicStore((s) => (draft.topicId ? s.info[draft.topicId]?.guard : undefined));
  const custom = useSoapTemplates((s) => s.custom);
  const setTemplate = useSoapTemplates((s) => s.setTemplate);
  const [editing, setEditing] = useState(false);
  const [tplDraft, setTplDraft] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<typeof draft>) => useSoapDraft.setState(patch);
  const setVal = (k: string, v: string) => useSoapDraft.setState((s) => ({ values: { ...s.values, [k]: v } }));
  const template = custom[draft.type] ?? DEFAULT_TEMPLATES[draft.type];

  const text = useMemo(() => {
    const t = draft.topicId ? TOPIC[draft.topicId] : null;
    const g = guard;
    const planGpc = g ? [bullets(g.firstLine), g.secondLine.trim() ? `  Alternativas:\n${bullets(g.secondLine)}` : ''].filter(Boolean).join('\n') : '';
    return fillTemplate(template, {
      ...nowParts(),
      dx: t?.title ?? '',
      criterios: g ? bullets(g.criteria) : '',
      plan_gpc: planGpc,
      referencia: g ? bullets(g.referral) : '',
      ...draft.values,
    });
  }, [template, draft.topicId, draft.values, guard]);

  if (!open) return null;
  const guardEmpty = !!draft.topicId && (!guard || GUARD_FIELDS.every((f) => !guard[f.id].trim()));
  const warnings = privacyWarnings(Object.values(draft.values).join(' '));
  const blanks = (text.match(/___(?!_)/g) ?? []).length;
  const fields = FIELDS.filter((f) => f.id !== 'cirugia' || draft.type === 'postqx');

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal title="Nota médica" onClose={() => setOpen(false)} width={1040}>
      <div className="soap">
        <div className="soap-form">
          <div className="field-row tight">
            <select className="select" value={draft.type} onChange={(e) => set({ type: e.target.value as NoteType })} aria-label="Tipo de nota">
              {NOTE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <TopicSelect value={draft.topicId} onChange={(v) => set({ topicId: v })} allowNone className="select grow" />
          </div>
          {guardEmpty && (
            <p className="soap-hint">
              La ficha de guardia de este tema está vacía: criterios, manejo y datos de alarma saldrán como «___».{' '}
              <button className="link" onClick={() => useUI.getState().openTopic(draft.topicId!, 'guard')}>
                Llenarla desde la GPC
              </button>
            </p>
          )}
          <div className="soap-grid">
            {fields
              .filter((f) => f.group !== 'clin')
              .map((f) => (
                <label key={f.id} className="field">
                  <span>{f.label}</span>
                  {f.id === 'sexo' ? (
                    <select className="select" value={draft.values.sexo ?? ''} onChange={(e) => setVal('sexo', e.target.value)}>
                      <option value="">—</option>
                      <option value="masculino">Masculino</option>
                      <option value="femenino">Femenino</option>
                    </select>
                  ) : (
                    <input className="input" value={draft.values[f.id] ?? ''} onChange={(e) => setVal(f.id, e.target.value)} inputMode={f.group === 'sv' || f.id === 'edad' || f.id === 'dia' ? 'decimal' : undefined} />
                  )}
                </label>
              ))}
          </div>
          {fields
            .filter((f) => f.group === 'clin')
            .map((f) => (
              <label key={f.id} className="field">
                <span>{f.label}</span>
                <textarea className="input" rows={f.id === 'pronostico' ? 1 : 2} value={draft.values[f.id] ?? ''} onChange={(e) => setVal(f.id, e.target.value)} />
              </label>
            ))}
          {warnings.length > 0 && (
            <p className="privacy-warn" role="alert">
              <Icon name="shield" size={14} /> Parece haber {warnings.join(', ')}. Mantén la nota sin datos identificables aquí; esos van directo al expediente.
            </p>
          )}
        </div>
        <div className="soap-out">
          <div className="field-row tight">
            <b className="small">{editing ? 'Plantilla' : 'Vista previa'}</b>
            {!editing && blanks > 0 && <span className="chip">{blanks} por llenar</span>}
            <span className="spacer" />
            {editing ? (
              <>
                <button
                  className="btn ghost sm"
                  onClick={() => {
                    setTemplate(draft.type, null);
                    setEditing(false);
                  }}
                  title="Volver a la plantilla de fábrica"
                >
                  Restaurar
                </button>
                <button
                  className="btn primary sm"
                  onClick={() => {
                    setTemplate(draft.type, tplDraft);
                    setEditing(false);
                  }}
                >
                  Guardar plantilla
                </button>
              </>
            ) : (
              <button
                className="btn ghost sm"
                onClick={() => {
                  setTplDraft(template);
                  setEditing(true);
                }}
              >
                <Icon name="pen" size={14} /> Editar plantilla
              </button>
            )}
          </div>
          {editing ? (
            <>
              <textarea className="input soap-text" value={tplDraft} onChange={(e) => setTplDraft(e.target.value)} spellCheck={false} aria-label="Plantilla" />
              <p className="muted small">
                Marcadores: {'{{fecha}} {{hora}} {{dx}} {{criterios}} {{plan_gpc}} {{referencia}}'} y {FIELDS.map((f) => `{{${f.id}}}`).join(' ')}
              </p>
            </>
          ) : (
            <pre className="soap-text" aria-label="Nota generada">
              {text}
            </pre>
          )}
          {!editing && (
            <div className="field-row tight">
              <button className="btn primary" onClick={() => void copy()}>
                <Icon name={copied ? 'check' : 'clipboard'} size={15} /> {copied ? 'Copiada' : 'Copiar nota'}
              </button>
              <button className="btn" onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `nota-${draft.type}.txt`)}>
                <Icon name="download" size={15} /> .txt
              </button>
              <span className="spacer" />
              <button className="btn ghost" onClick={() => set({ values: {} })} title="Borra los datos del paciente de esta nota">
                <Icon name="trash" size={15} /> Limpiar
              </button>
            </div>
          )}
          <p className="muted small">
            Los datos del paciente no se guardan: se borran al recargar o con «Limpiar». Los apartados de GPC salen de tu ficha de guardia; revisa todo antes de firmar.
          </p>
        </div>
      </div>
    </Modal>
  );
}
