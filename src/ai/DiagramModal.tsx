import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TOPIC } from '../internship/curriculum';
import { openTopicNote, ensureTopicNote } from '../internship/openLesson';
import { addInkImage } from '../lib/inkImages';
import { useBridge } from '../store/bridge';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';
import { generateDiagram, renderDiagram, type Diagram, type DiagramKind } from './features';

const KIND_LABEL: Record<DiagramKind, string> = { start: 'Inicio', step: 'Paso', decision: 'Decisión', end: 'Fin' };

/** Diagrama / algoritmo del tema desde la GPC: lo revisas, corriges los textos y lo pegas en el lienzo para rayar encima. */
export function DiagramModal() {
  const topicId = useUI((s) => s.diagram);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const [d, setD] = useState<Diagram | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    setD(null);
    setMsg(null);
  }, [topicId]);
  const png = useMemo(() => (d ? renderDiagram(d) : null), [d]);
  if (!topicId || !TOPIC[topicId]) return null;
  const t = TOPIC[topicId];
  const close = () => useUI.getState().setDiagram(null);

  const go = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setD(await generateDiagram(topicId, { apiKey, model }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const insert = async () => {
    if (!png) return;
    const { noteId } = ensureTopicNote(t);
    await addInkImage(noteId, png);
    close();
    openTopicNote(t);
    const st = useSettings.getState();
    if (st.paneMode === 'pdf') st.setPaneMode('both');
    useBridge.getState().requestTab('ink');
    useUI.getState().showToast(`Diagrama pegado en el lienzo de «${t.title}»`);
  };

  return (
    <Modal
      title={`Diagrama · ${t.title}`}
      onClose={close}
      width={860}
      footer={
        d ? (
          <>
            <button className="btn ghost" onClick={() => void go()} disabled={busy}>
              <Icon name="reset" size={15} /> Otra versión
            </button>
            <span className="spacer" />
            <button className="btn primary" onClick={() => void insert()}>
              <Icon name="insert" size={15} /> Pegar en el lienzo de la nota
            </button>
          </>
        ) : undefined
      }
    >
      <div className="diagram">
        {!d && (
          <>
            <p className="muted small">
              Claude lee la GPC adjunta al tema (la GER, o tus apuntes si no hay) y arma el algoritmo de diagnóstico y manejo. Revisa cada caja contra la guía antes de estudiarlo; puedes corregir los textos aquí y rayar encima en el lienzo.
            </p>
            {!apiKey && <p className="small warn-text">Necesitas tu API key de Anthropic (Ajustes → Preferencias → IA).</p>}
            <button className="btn primary" onClick={() => void go()} disabled={busy || !apiKey}>
              <Icon name="flow" size={15} /> {busy ? 'Armando el algoritmo…' : 'Generar diagrama'}
            </button>
          </>
        )}
        {msg && <p className="small error">{msg}</p>}
        {d && png && (
          <div className="diagram-body">
            <img className="diagram-img" src={png} alt={`Algoritmo de ${t.title}`} />
            <div className="diagram-edit">
              <input className="input" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} aria-label="Título del diagrama" />
              <ol>
                {d.nodes.map((n, i) => (
                  <li key={n.id}>
                    <select className="select xs" value={n.kind} onChange={(e) => setD({ ...d, nodes: d.nodes.map((x, j) => (j === i ? { ...x, kind: e.target.value as DiagramKind } : x)) })} aria-label="Tipo de caja">
                      {(Object.keys(KIND_LABEL) as DiagramKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    <input className="input sm" value={n.label} onChange={(e) => setD({ ...d, nodes: d.nodes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label={`Texto de la caja ${i + 1}`} />
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
