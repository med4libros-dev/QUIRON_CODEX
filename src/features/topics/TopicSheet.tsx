import { useMemo, useState, type CSSProperties } from 'react';
import { FilePick } from '../../components/FilePick';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { CALCULATORS, calculatorsForTopic } from '../../clinical/calculators';
import { dueCards, useCards } from '../../flashcards/store';
import { SPECIALTY, TOPIC, gpcSearchUrl } from '../../internship/curriculum';
import { openTopicNote } from '../../internship/openLesson';
import {
  GUARD_FIELDS,
  emptyInfo,
  guessKind,
  privacyWarnings,
  useTopicStore,
  type AttachmentKind,
  type CaseEntry,
} from '../../internship/topicStore';
import { fmt, fromKey, todayKey } from '../../lib/date';
import { useLibrary } from '../../store/library';
import { openPdfPage } from '../../store/navigate';
import { useSettings } from '../../store/settings';
import { speak, ttsSupported } from '../../lib/tts';
import { useUI, type TopicTab } from '../../store/ui';
import { CalculatorCard } from './CalculatorCard';
import { HyEditor, HyList } from '../../hy/HyView';
import { useHy } from '../../hy/store';
import { setSoapTopic } from '../../soap/SoapModal';
import { useNotes } from '../../store/notes';
import { noteCompleteness } from '../../lib/completeness';
import { KEY_PAGE_LABEL, type Bookmark } from '../../types';

const EMPTY_BM: Bookmark[] = [];

/** % completo de la nota del tema (si ya existe). */
function TopicCompleteness({ topicId }: { topicId: string }) {
  const t = TOPIC[topicId];
  const html = useNotes((s) => {
    const book = s.notebooks.find((b) => b.name === SPECIALTY[t.specialty].name);
    return book ? s.notes.find((n) => n.notebookId === book.id && n.title === t.title)?.html ?? null : null;
  });
  const c = useMemo(() => (html ? noteCompleteness(html) : null), [html]);
  if (!c) return null;
  return (
    <span className={`gap-chip ${c.pct >= 100 ? 'ok' : c.pct >= 50 ? 'mid' : 'low'}`} title={c.empty.length ? `Apartados vacíos en tu nota: ${c.empty.join(', ')}` : 'Nota completa'}>
      Nota {c.pct}%
    </span>
  );
}

/** Lectura de un PDF: % y página para retomar. */
function ReadInfo({ docId, pageCount, lastPage }: { docId: string; pageCount: number; lastPage: number }) {
  const read = useLibrary((s) => s.read[docId]?.length ?? 0);
  const keyPages = (useLibrary((s) => s.bookmarks[docId]) ?? EMPTY_BM).filter((b) => b.kind);
  return (
    <div className="att-read">
      {pageCount > 0 && (
        <span className="small muted tabular">
          {Math.min(100, Math.round((read / pageCount) * 100))}% leído
          {lastPage > 1 && (
            <>
              {' · '}
              <button className="linkish" onClick={() => (useUI.getState().closeTopic(), openPdfPage(docId, lastPage))}>
                retomar p. {lastPage}
              </button>
            </>
          )}
        </span>
      )}
      {keyPages.map((b) => (
        <button key={b.id} className={`key-chip k-${b.kind}`} onClick={() => (useUI.getState().closeTopic(), openPdfPage(docId, b.page))} title={b.label || `Página ${b.page}`}>
          {KEY_PAGE_LABEL[b.kind!]} p. {b.page}
        </button>
      ))}
    </div>
  );
}

const TABS: { id: TopicTab; label: string }[] = [
  { id: 'docs', label: 'Documentos' },
  { id: 'guard', label: 'Vista de Guardia' },
  { id: 'cases', label: 'Casos vistos' },
  { id: 'cards', label: 'Flashcards' },
  { id: 'hy', label: 'Perlas HY' },
];

const KIND_LABEL: Record<AttachmentKind, string> = {
  GRR: 'GRR · Referencia rápida',
  GER: 'GER · Evidencias y recomendaciones',
  otro: 'Otro documento',
};

/** Ficha de un tema del temario: GPC adjuntas, ficha de guardia, casos y flashcards. */
export function TopicSheet() {
  const sheet = useUI((s) => s.topicSheet);
  const close = useUI((s) => s.closeTopic);
  const openTopic = useUI((s) => s.openTopic);
  if (!sheet || !TOPIC[sheet.topicId]) return null;
  const t = TOPIC[sheet.topicId];
  const sp = SPECIALTY[t.specialty];
  return (
    <Modal title={t.title} onClose={close} width={760}>
      <div className="topic-sheet" style={{ '--sp': sp.color } as CSSProperties}>
        <div className="ts-sub">
          <span className="sp-tag">{sp.short}</span>
          <span className="muted small">{sp.name}</span>
          <TopicCompleteness topicId={t.id} />
          <span className="spacer" />
          <button className="btn ghost sm" onClick={() => useUI.getState().setDiagram(t.id)} title="Diagrama del tema con IA desde tu GPC (editable en el lienzo)">
            <Icon name="flow" size={14} /> Diagrama
          </button>
          <button
            className="btn ghost sm"
            onClick={() => {
              setSoapTopic(t.id);
              useUI.getState().setSoapOpen(true);
            }}
            title="Generar nota médica de este diagnóstico"
          >
            <Icon name="clipboard" size={14} /> Nota médica
          </button>
          <button
            className="btn primary sm"
            onClick={() => {
              close();
              openTopicNote(t);
            }}
          >
            <Icon name="play" size={14} /> Estudiar
          </button>
        </div>
        <div className="seg ts-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} role="tab" aria-selected={sheet.tab === x.id} className={sheet.tab === x.id ? 'active' : ''} onClick={() => openTopic(t.id, x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        {sheet.tab === 'docs' && <DocsTab topicId={t.id} />}
        {sheet.tab === 'guard' && <GuardTab topicId={t.id} />}
        {sheet.tab === 'cases' && <CasesTab topicId={t.id} />}
        {sheet.tab === 'cards' && <CardsTab topicId={t.id} />}
        {sheet.tab === 'hy' && <HyTab topicId={t.id} />}
      </div>
    </Modal>
  );
}

function DocsTab({ topicId }: { topicId: string }) {
  const t = TOPIC[topicId];
  const info = useTopicStore((s) => s.info[topicId]) ?? emptyInfo();
  const attach = useTopicStore((s) => s.attach);
  const detach = useTopicStore((s) => s.detach);
  const setKind = useTopicStore((s) => s.setAttachmentKind);
  const docs = useLibrary((s) => s.docs);
  const addFilesAll = useLibrary((s) => s.addFilesAll);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState('');
  const attachedIds = new Set(info.attachments.map((a) => a.docId));
  const free = docs.filter((d) => !attachedIds.has(d.id));
  const order: Record<AttachmentKind, number> = { GRR: 0, GER: 1, otro: 2 };
  const atts = [...info.attachments].sort((a, b) => order[a.kind] - order[b.kind] || a.addedAt - b.addedAt);

  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      for (const { id, fileName } of await addFilesAll(files)) attach(topicId, id, guessKind(fileName));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ts-pane">
      <p className="muted small">
        Adjunta varias versiones de la guía: la <b>GRR</b> para repasos rápidos y la <b>GER</b> para estudiar a fondo. «Estudiar» abre la GER en temas nuevos; los repasos abren la GRR.
      </p>
      {atts.length ? (
        <ul className="att-list">
          {atts.map((a) => {
            const d = docs.find((x) => x.id === a.docId);
            return (
              <li key={a.id} className={`att kind-${a.kind}`}>
                <span className="att-badge">{a.kind === 'otro' ? 'PDF' : a.kind}</span>
                <div className="att-body">
                  <div className="ellipsis">{d?.name ?? 'Archivo eliminado'}</div>
                  {d && <ReadInfo docId={d.id} pageCount={d.pageCount} lastPage={d.lastPage} />}
                  <select className="select xs" value={a.kind} onChange={(e) => setKind(topicId, a.id, e.target.value as AttachmentKind)} aria-label="Tipo de documento">
                    {(Object.keys(KIND_LABEL) as AttachmentKind[]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
                {d && (
                  <button
                    className="btn sm"
                    onClick={() => {
                      useUI.getState().closeTopic();
                      openTopicNote(t, { docId: d.id });
                    }}
                  >
                    Abrir
                  </button>
                )}
                <button className="icon-btn" onClick={() => detach(topicId, a.id)} title="Quitar del tema (el PDF sigue en tu biblioteca)" aria-label="Quitar del tema">
                  <Icon name="x" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="ts-empty muted">Este tema aún no tiene documentos.</div>
      )}
      {(() => {
        const alive = atts.filter((a) => docs.some((d) => d.id === a.docId));
        if (alive.length < 2) return null;
        return (
          <button className="btn sm" onClick={() => useUI.getState().setCompare({ a: alive[0].docId, b: alive[1].docId })} title="Abrir dos guías lado a lado con scroll sincronizado">
            <Icon name="columns" size={15} /> Comparar lado a lado
          </button>
        );
      })()}
      <div className="field-row">
        <FilePick onFiles={(f) => void upload(f)} className="btn primary sm" disabled={busy}>
          <Icon name="upload" size={15} /> {busy ? 'Subiendo…' : 'Subir PDF(s)'}
        </FilePick>
        {free.length > 0 && (
          <>
            <select className="select" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Vincular un PDF de la biblioteca">
              <option value="">Vincular desde la biblioteca…</option>
              {free.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              className="btn sm"
              disabled={!pick}
              onClick={() => {
                const d = docs.find((x) => x.id === pick);
                if (d) attach(topicId, d.id, guessKind(d.name));
                setPick('');
              }}
            >
              <Icon name="paperclip" size={14} /> Vincular
            </button>
          </>
        )}
      </div>
      <div className="gpc-box">
        <div>
          <b>Buscar la GPC oficial</b>
          <p className="muted small">Búsqueda limitada a imss.gob.mx, gob.mx e issste.gob.mx. Descarga la GRR y la GER y súbelas aquí.</p>
        </div>
        <a className="btn" href={gpcSearchUrl(t)} target="_blank" rel="noopener noreferrer">
          <Icon name="search" size={15} /> Buscar GPC <Icon name="external" size={13} />
        </a>
      </div>
    </div>
  );
}

function GuardTab({ topicId }: { topicId: string }) {
  const guard = useTopicStore((s) => s.info[topicId]?.guard) ?? emptyInfo().guard;
  const updateGuard = useTopicStore((s) => s.updateGuard);
  const relevant = useMemo(() => calculatorsForTopic(topicId), [topicId]);
  const [extra, setExtra] = useState('');
  const others = CALCULATORS.filter((c) => !relevant.includes(c));
  const extraCalc = CALCULATORS.find((c) => c.id === extra);
  return (
    <div className="ts-pane">
      <p className="muted small">
        Tu ficha de bolsillo. Copia los datos <b>desde la GPC vigente</b> (o usa «Guardia» en el menú de perlas del PDF). Quirón Codex no precarga dosis: así sabes que cada número viene de tu guía.
      </p>
      <div className="guard-grid">
        {GUARD_FIELDS.map((f) => (
          <label key={f.id} className="field guard-field">
            <span>{f.label}</span>
            <textarea className="input" rows={4} value={guard[f.id]} placeholder={f.hint} onChange={(e) => updateGuard(topicId, { [f.id]: e.target.value })} />
          </label>
        ))}
      </div>
      <h5 className="ts-h">Escalas y calculadoras</h5>
      {relevant.length ? relevant.map((c) => <CalculatorCard key={c.id} calc={c} defaultOpen={relevant.length === 1} />) : <p className="muted small">No hay una escala específica para este tema.</p>}
      <div className="field-row">
        <select className="select" value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Otra calculadora">
          <option value="">Otra calculadora…</option>
          {others.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {extraCalc && <CalculatorCard key={extraCalc.id} calc={extraCalc} defaultOpen />}
    </div>
  );
}

const SETTINGS: CaseEntry['setting'][] = ['Piso', 'Urgencias', 'Consulta', 'Quirófano', 'Tococirugía', 'Otro'];

export function CasesTab({ topicId }: { topicId: string }) {
  const cases = useTopicStore((s) => s.info[topicId]?.cases) ?? [];
  const addCase = useTopicStore((s) => s.addCase);
  const removeCase = useTopicStore((s) => s.removeCase);
  const [date, setDate] = useState(todayKey());
  const [setting, setSetting] = useState<CaseEntry['setting']>('Piso');
  const [patient, setPatient] = useState('');
  const [finding, setFinding] = useState('');
  const [management, setManagement] = useState('');
  const warnings = privacyWarnings(`${patient} ${finding} ${management}`);
  const ok = patient.trim() && finding.trim();

  const save = () => {
    if (!ok) return;
    addCase(topicId, { date, setting, patient: patient.trim(), finding: finding.trim(), management: management.trim() });
    setPatient('');
    setFinding('');
    setManagement('');
  };

  return (
    <div className="ts-pane">
      <p className="muted small">
        Tres líneas, <b>sin datos identificables</b>: nada de nombres, expediente, NSS, CURP ni número de cama. Usa sexo, edad y antecedente clave (p. ej. «M 67 a, DM2 de 10 años»).
      </p>
      <div className="case-form">
        <div className="field-row tight">
          <input className="input sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" />
          <select className="select" value={setting} onChange={(e) => setSetting(e.target.value as CaseEntry['setting'])} aria-label="Servicio">
            {SETTINGS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <input className="input" value={patient} onChange={(e) => setPatient(e.target.value)} placeholder="1 · Paciente: sexo, edad, antecedente clave" aria-label="Paciente" maxLength={140} />
        <input className="input" value={finding} onChange={(e) => setFinding(e.target.value)} placeholder="2 · Hallazgo principal" aria-label="Hallazgo principal" maxLength={200} />
        <input className="input" value={management} onChange={(e) => setManagement(e.target.value)} placeholder="3 · Manejo" aria-label="Manejo" maxLength={200} />
        {warnings.length > 0 && (
          <p className="privacy-warn" role="alert">
            <Icon name="shield" size={14} /> Revisa: parece haber {warnings.join(', ')}. Quítalo antes de guardar.
          </p>
        )}
        <div className="field-row tight">
          <span className="spacer" />
          <button className="btn primary sm" onClick={save} disabled={!ok}>
            <Icon name="plus" size={14} /> Guardar caso
          </button>
        </div>
      </div>
      {cases.length > 0 && (
        <ul className="case-list">
          {cases.map((c) => (
            <li key={c.id}>
              <div className="case-meta muted small">
                {fmt(fromKey(c.date), { day: 'numeric', month: 'short', year: 'numeric' })} · {c.setting}
              </div>
              <div>
                <b>{c.patient}</b>
              </div>
              <div>{c.finding}</div>
              {c.management && <div className="muted">{c.management}</div>}
              <button className="icon-btn xs case-del" onClick={() => confirm('¿Eliminar este caso?') && removeCase(topicId, c.id)} aria-label="Eliminar caso">
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CardsTab({ topicId }: { topicId: string }) {
  const all = useCards((s) => s.cards);
  const removeCard = useCards((s) => s.removeCard);
  const cards = all.filter((c) => c.topicId === topicId);
  const due = dueCards(cards);
  const t = TOPIC[topicId];
  const review = (ids: string[]) => {
    useUI.getState().closeTopic();
    useUI.getState().startReview({ cardIds: ids, title: `Repaso · ${t.title}` });
  };
  return (
    <div className="ts-pane">
      <div className="field-row tight">
        <button className="btn primary sm" onClick={() => review(due.map((c) => c.id))} disabled={!due.length}>
          <Icon name="play" size={14} /> Repasar {due.length} vencida{due.length === 1 ? '' : 's'}
        </button>
        <button className="btn sm" onClick={() => review(cards.map((c) => c.id))} disabled={!cards.length}>
          Repasar todas ({cards.length})
        </button>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => useUI.getState().setCardDraft({ topicId, front: '', back: '' })}>
          <Icon name="plus" size={14} /> Nueva
        </button>
      </div>
      {cards.length ? (
        <ul className="card-list">
          {cards.map((c) => (
            <li key={c.id}>
              <div className="cl-body">
                <div className="cl-front">{c.front}</div>
                <div className="muted small">
                  {c.due <= todayKey() ? 'Toca hoy' : `Próximo: ${fmt(fromKey(c.due), { day: 'numeric', month: 'short' })}`}
                  {c.source && (
                    <>
                      {' · '}
                      <button className="link" onClick={() => openPdfPage(c.source!.docId, c.source!.page) && useUI.getState().closeTopic()}>
                        p. {c.source.page}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button className="icon-btn xs" onClick={() => confirm('¿Eliminar esta flashcard?') && removeCard(c.id)} aria-label="Eliminar flashcard">
                <Icon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ts-empty muted">Sin flashcards. Selecciona texto en la GPC y elige «Flashcard».</div>
      )}
    </div>
  );
}

function HyTab({ topicId }: { topicId: string }) {
  const items = useHy((s) => s.items).filter((i) => i.topicId === topicId);
  return (
    <div className="ts-pane">
      <div className="field-row tight">
        <HyEditor topicId={topicId} />
        <span className="spacer" />
        {ttsSupported() && items.length > 0 && (
          <button className="btn ghost sm" onClick={() => speak(items.map((i) => ({ title: i.title, text: [i.text, i.explain].filter(Boolean).join('. ') })), TOPIC[topicId].title)}>
            <Icon name="speaker" size={14} /> Escuchar
          </button>
        )}
      </div>
      <HyList items={items} compact />
    </div>
  );
}
