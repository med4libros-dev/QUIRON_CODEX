import { createStore } from '../lib/createStore';
import { uid } from '../lib/id';

/** Tipo de documento GPC: Guía de Referencia Rápida, Evidencias y Recomendaciones, u otro (artículo, NOM…). */
export type AttachmentKind = 'GRR' | 'GER' | 'otro';

export interface TopicAttachment {
  id: string;
  docId: string;
  kind: AttachmentKind;
  addedAt: number;
}

/** Caso visto en el hospital: 3 líneas, sin datos identificables. */
export interface CaseEntry {
  id: string;
  date: string;
  setting: 'Piso' | 'Consulta' | 'Urgencias' | 'Quirófano' | 'Tococirugía' | 'Otro';
  patient: string;
  finding: string;
  management: string;
  createdAt: number;
}

/** Ficha «pocket» para la guardia. Texto libre: una viñeta por línea. */
export interface GuardCard {
  criteria: string;
  firstLine: string;
  secondLine: string;
  referral: string;
}
export type GuardField = keyof GuardCard;
export const GUARD_FIELDS: { id: GuardField; label: string; hint: string }[] = [
  { id: 'criteria', label: 'Criterios diagnósticos clave', hint: 'Un criterio por línea' },
  { id: 'firstLine', label: 'Tratamiento de 1ª línea (con dosis)', hint: 'Fármaco · dosis · vía · frecuencia' },
  { id: 'secondLine', label: 'Tratamiento de 2ª línea / alternativas', hint: 'Si falla o hay contraindicación' },
  { id: 'referral', label: 'Criterios de referencia a 2º/3er nivel', hint: 'Cuándo enviar y a dónde' },
];

export interface TopicInfo {
  attachments: TopicAttachment[];
  cases: CaseEntry[];
  guard: GuardCard;
}

const EMPTY_GUARD: GuardCard = { criteria: '', firstLine: '', secondLine: '', referral: '' };
export const emptyInfo = (): TopicInfo => ({ attachments: [], cases: [], guard: { ...EMPTY_GUARD } });

export interface TopicStoreState {
  info: Record<string, TopicInfo>;
  /** Último tema elegido al extraer perlas (para sugerirlo). */
  lastTopicId: string | null;
  attach: (topicId: string, docId: string, kind: AttachmentKind) => void;
  setAttachmentKind: (topicId: string, attId: string, kind: AttachmentKind) => void;
  detach: (topicId: string, attId: string) => void;
  /** Quita un PDF de todos los temas (al borrarlo de la biblioteca). */
  forgetDoc: (docId: string) => void;
  addCase: (topicId: string, c: Omit<CaseEntry, 'id' | 'createdAt'>) => void;
  removeCase: (topicId: string, caseId: string) => void;
  updateGuard: (topicId: string, patch: Partial<GuardCard>) => void;
  appendGuard: (topicId: string, field: GuardField, text: string) => void;
  setLastTopic: (id: string) => void;
}

const patchInfo = (s: TopicStoreState, topicId: string, fn: (i: TopicInfo) => Partial<TopicInfo>) => {
  const cur = s.info[topicId] ?? emptyInfo();
  return { info: { ...s.info, [topicId]: { ...cur, ...fn(cur) } } };
};

/** Clasifica un PDF por su nombre: los del IMSS se llaman p. ej. 043GER.pdf / 043GRR.pdf. */
export function guessKind(fileName: string): AttachmentKind {
  if (/GRR|referencia\s*r[aá]pida|\bRR\b/i.test(fileName)) return 'GRR';
  if (/GER|evidencias|\bER\b/i.test(fileName)) return 'GER';
  return 'otro';
}

export const useTopicStore = createStore<TopicStoreState>(
  (set) => ({
    info: {},
    lastTopicId: null,
    attach: (topicId, docId, kind) =>
      set((s) =>
        patchInfo(s, topicId, (i) =>
          i.attachments.some((a) => a.docId === docId) ? {} : { attachments: [...i.attachments, { id: uid(), docId, kind, addedAt: Date.now() }] },
        ),
      ),
    setAttachmentKind: (topicId, attId, kind) =>
      set((s) => patchInfo(s, topicId, (i) => ({ attachments: i.attachments.map((a) => (a.id === attId ? { ...a, kind } : a)) }))),
    detach: (topicId, attId) => set((s) => patchInfo(s, topicId, (i) => ({ attachments: i.attachments.filter((a) => a.id !== attId) }))),
    forgetDoc: (docId) =>
      set((s) => {
        const info: Record<string, TopicInfo> = {};
        for (const [k, v] of Object.entries(s.info)) info[k] = { ...v, attachments: v.attachments.filter((a) => a.docId !== docId) };
        return { info };
      }),
    addCase: (topicId, c) =>
      set((s) => patchInfo(s, topicId, (i) => ({ cases: [{ ...c, id: uid(), createdAt: Date.now() }, ...i.cases] }))),
    removeCase: (topicId, caseId) => set((s) => patchInfo(s, topicId, (i) => ({ cases: i.cases.filter((c) => c.id !== caseId) }))),
    updateGuard: (topicId, patch) => set((s) => patchInfo(s, topicId, (i) => ({ guard: { ...i.guard, ...patch } }))),
    appendGuard: (topicId, field, text) =>
      set((s) =>
        patchInfo(s, topicId, (i) => ({ guard: { ...i.guard, [field]: [i.guard[field].trim(), text.trim()].filter(Boolean).join('\n') } })),
      ),
    setLastTopic: (lastTopicId) => set({ lastTopicId }),
  }),
  { key: 'topics', storage: 'idb', pick: ({ info, lastTopicId }) => ({ info, lastTopicId }) },
);

/** Temas a los que está vinculado un PDF. */
export function topicsForDoc(docId: string): string[] {
  const out: string[] = [];
  for (const [topicId, i] of Object.entries(useTopicStore.getState().info)) if (i.attachments.some((a) => a.docId === docId)) out.push(topicId);
  return out;
}

/** Heurística de privacidad: avisa si el texto parece contener datos identificables. */
export function privacyWarnings(text: string): string[] {
  const w: string[] = [];
  if (/\b\d{10,11}\b/.test(text)) w.push('un número largo (¿NSS o expediente?)');
  if (/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/i.test(text)) w.push('algo con formato de CURP');
  if (/(^|[\s,;(])([Ss]r|[Ss]ra|[Ss]rta|[Dd]on|[Dd]oña|[Pp]aciente)\.?\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?/.test(text)) w.push('un posible nombre propio');
  if (/\bcama\s*\d+/i.test(text)) w.push('un número de cama');
  return w;
}
