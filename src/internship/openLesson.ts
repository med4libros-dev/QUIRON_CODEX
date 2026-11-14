import { escapeHtml } from '../lib/html';
import { useLibrary } from '../store/library';
import { useNotes } from '../store/notes';
import { useSettings } from '../store/settings';
import { SPECIALTY, TOPIC } from './curriculum';
import { useTopicStore } from './topicStore';
import type { Topic } from './types';

/**
 * Secciones de la plantilla por especialidad. Solo títulos (sin contenido clínico precargado):
 * tú los llenas desde tu GPC. Las que no aplican se pueden borrar.
 */
export const TEMPLATE_SECTIONS: Record<string, string[]> = {
  base: ['Definición y epidemiología', 'Fisiopatología', 'Cuadro clínico', 'Diagnóstico', 'Tratamiento', 'Complicaciones y pronóstico'],
  cg: ['Definición y epidemiología', 'Anatomía quirúrgica relevante', 'Cuadro clínico', 'Diagnóstico (laboratorio e imagen)', 'Escalas y clasificación', 'Indicación quirúrgica y técnica', 'Manejo preoperatorio', 'Manejo postoperatorio', 'Complicaciones'],
  ped: ['Definición y epidemiología', 'Grupo de edad y factores de riesgo', 'Cuadro clínico por edad', 'Diagnóstico', 'Tratamiento (dosis por kg)', 'Hidratación y nutrición', 'Signos de alarma para los padres', 'Criterios de referencia', 'Prevención y vacunación'],
  go: ['Definición y epidemiología', 'Factores de riesgo', 'Cuadro clínico', 'Diagnóstico', 'Manejo según semanas de gestación', 'Vía de resolución del embarazo', 'Tratamiento', 'Complicaciones maternas y fetales', 'Seguimiento y puerperio'],
};

/** Plantilla de apuntes para una lección (estructura clásica de estudio clínico, adaptada a la especialidad). */
function lessonTemplate(t: Topic): string {
  const sections = TEMPLATE_SECTIONS[t.specialty] ?? TEMPLATE_SECTIONS.base;
  return (
    `<p><em>${escapeHtml(SPECIALTY[t.specialty].name)} · Lección del internado</em></p>` +
    sections.map((s) => `<h3>${s}</h3><p><br></p>`).join('') +
    `<h3>Perlas ENARM</h3><ul><li><br></li></ul>` +
    `<h3>Dudas para resolver</h3><ul class="checklist"><li><br></li></ul>` +
    `<h3>Perlas de la GPC</h3>`
  );
}

/**
 * Garantiza el cuaderno de la especialidad y la nota del tema (con plantilla la primera vez).
 * No cambia de vista: sirve también para enviar perlas desde el PDF.
 */
export function ensureTopicNote(topic: Topic): { noteId: string; notebookId: string } {
  const sp = SPECIALTY[topic.specialty];
  const notes = useNotes.getState();
  let book = notes.notebooks.find((b) => b.name === sp.name);
  if (!book) {
    const id = notes.createNotebook({ name: sp.name, subjectId: null, color: sp.color });
    book = useNotes.getState().notebooks.find((b) => b.id === id)!;
  }
  const existing = useNotes.getState().notes.find((n) => n.notebookId === book!.id && n.title === topic.title);
  const noteId = existing?.id ?? notes.createNote({ docId: null, notebookId: book.id, title: topic.title, html: lessonTemplate(topic) });
  return { noteId, notebookId: book.id };
}

/** Documento adjunto preferido del tema: GER para estudiar a fondo, GRR para repasar. */
export function preferredDoc(topicId: string, prefer: 'GER' | 'GRR' = 'GER'): string | null {
  const atts = useTopicStore.getState().info[topicId]?.attachments ?? [];
  const docs = useLibrary.getState().docs;
  const alive = atts.filter((a) => docs.some((d) => d.id === a.docId));
  const other = prefer === 'GER' ? 'GRR' : 'GER';
  return (alive.find((a) => a.kind === prefer) ?? alive.find((a) => a.kind === other) ?? alive[0])?.docId ?? null;
}

/**
 * Abre la lección en Estudio: cuaderno de la especialidad + nota del tema y,
 * si el tema tiene GPC adjunta, el PDF a la izquierda (GER para temas nuevos, GRR para repasos).
 */
export function openTopicNote(topic: Topic, opts: { prefer?: 'GER' | 'GRR'; docId?: string } = {}) {
  const { noteId, notebookId } = ensureTopicNote(topic);
  useTopicStore.getState().setLastTopic(topic.id);
  const st = useSettings.getState();
  const docId = opts.docId ?? preferredDoc(topic.id, opts.prefer);
  if (docId && docId !== st.activeDocId) st.setActiveDoc(docId); // reinicia la nota activa: se fija después
  st.setNotebookScope(notebookId);
  useSettings.getState().setActiveNote(noteId);
  const s2 = useSettings.getState();
  if (docId) {
    if (s2.paneMode !== 'both') s2.setPaneMode('both');
  } else if (s2.paneMode === 'pdf') s2.setPaneMode('both');
  s2.setView('study');
}

export const openTopicById = (id: string, opts?: { prefer?: 'GER' | 'GRR'; docId?: string }) => {
  const t = TOPIC[id];
  if (t) openTopicNote(t, opts);
};
