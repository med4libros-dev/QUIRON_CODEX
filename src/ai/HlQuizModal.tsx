import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Runner } from '../exam/ExamView';
import { useExam } from '../exam/store';
import { useLibrary } from '../store/library';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { questionsFromHighlights } from './features';

/** Preguntas rápidas con IA desde tus subrayados de un PDF; entran al banco «por revisar». */
export function HlQuizModal() {
  const docId = useUI((s) => s.hlQuiz);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const doc = useLibrary((s) => s.docs.find((d) => d.id === docId) ?? null);
  const hl = useLibrary((s) => (docId ? (s.highlights[docId] ?? []).filter((h) => h.text.trim().length > 12).length : 0));
  const [n, setN] = useState(4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ids, setIds] = useState<string[] | null>(null);
  const [key, setKey] = useState('');
  useEffect(() => {
    setIds(null);
    setMsg(null);
  }, [docId]);
  if (!docId || !doc) return null;
  const close = () => useUI.getState().setHlQuiz(null);
  if (ids) return <Runner ids={ids} title={`Preguntas · ${doc.name}`} minutes={Math.max(3, ids.length)} mode="study" onClose={close} />;

  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const qs = await questionsFromHighlights(docId, { apiKey, model }, n);
      setIds(useExam.getState().addQuestions(qs));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Preguntas desde tus subrayados" onClose={close} width={520}>
      <div className="form">
        <p className="muted small">
          Claude usa solo lo que resaltaste o subrayaste en <b>{doc.name}</b> ({hl} fragmento{hl === 1 ? '' : 's'} con texto) y te hace preguntas en modo estudio. Se guardan en tu banco de Simulacros «por revisar».
        </p>
        {!apiKey && (
          <div className="field-row tight">
            <input className="input grow" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Tu API key de Anthropic (sk-ant-…)" aria-label="API key" />
            <button className="btn sm" disabled={!key.trim()} onClick={() => useSettings.getState().setApiKey(key.trim())}>
              Guardar clave
            </button>
          </div>
        )}
        <div className="field-row tight">
          <select className="select" value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Cantidad de preguntas">
            {[3, 4, 5].map((x) => (
              <option key={x} value={x}>
                {x} preguntas
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={busy || !apiKey || !hl} onClick={() => void go()}>
            <Icon name="question" size={15} /> {busy ? 'Preparando…' : 'Preguntarme'}
          </button>
        </div>
        {!hl && <p className="small warn-text">Este PDF no tiene subrayados con texto todavía.</p>}
        {msg && <p className="small error">{msg}</p>}
      </div>
    </Modal>
  );
}
