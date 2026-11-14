import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TOPIC } from '../internship/curriculum';
import { topicsForDoc } from '../internship/topicStore';
import { useLibrary } from '../store/library';
import { useUI } from '../store/ui';
import { TopicSelect } from './FlashcardUI';
import { useCards } from './store';

/**
 * Flashcards de huecos (cloze): de cada subrayado escondes las palabras clave.
 * La app sugiere un hueco (cifras, porcentajes o el término más largo); tú tocas las palabras para cambiarlo.
 */
const STOP = new Set('para como entre sobre desde hasta cuando donde porque pero sino aunque también tiene tienen debe deben puede pueden mayor menor este esta estos estas ese esa esos esas cual cuales según durante mediante otros otras todos todas'.split(' '));

export const tokenize = (text: string) => text.replace(/\s+/g, ' ').trim().split(' ');
const bare = (w: string) => w.replace(/^[«"“(¿¡\[]+|[»"”).,;:?!\]]+$/g, '');

/** Índices sugeridos para esconder. */
export function suggestCloze(words: string[]): number[] {
  // 1) Una cifra clínica (con unidad o %), con su unidad si va en la palabra siguiente.
  const UNIT = /^(%|mg|mcg|µg|g|kg|ml|l|mmhg|mmol|meq|mg\/dl|g\/dl|h|hrs?|horas|min|días|semanas|meses|años|lpm|rpm|ui|veces)\b/i;
  for (let i = 0; i < words.length; i++) {
    const w = bare(words[i]);
    if (!/\d/.test(w) || /^\(?p\.?$/i.test(bare(words[i - 1] ?? ''))) continue;
    if (/\d\s*(%|mg|kg|ml|mmhg|°)/i.test(w) || /[<>≥≤]/.test(w)) return [i];
    if (words[i + 1] && UNIT.test(bare(words[i + 1]))) return [i, i + 1];
  }
  // 2) Si no, el término más largo (sin muletillas ni marcadores de página).
  let best = -1;
  for (let i = 0; i < words.length; i++) {
    const b = bare(words[i]);
    if (b.length < 6 || STOP.has(b.toLowerCase()) || /\d/.test(b)) continue;
    if (best < 0 || b.length > bare(words[best]).length) best = i;
  }
  return best >= 0 ? [best] : [];
}

/** Frente con huecos (palabras seguidas = un solo hueco) y respuestas en orden. */
export function buildCloze(words: string[], hidden: Set<number>): { front: string; answers: string[] } {
  const out: string[] = [];
  const answers: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    const first = run[0];
    const last = run[run.length - 1];
    const lead = first.match(/^[«"“(¿¡\[]+/)?.[0] ?? '';
    const trail = last.match(/[»"”).,;:?!\]]+$/)?.[0] ?? '';
    answers.push(bare(run.join(' ')));
    out.push(`${lead}_____${trail}`);
    run = [];
  };
  words.forEach((w, i) => {
    if (hidden.has(i)) run.push(w);
    else {
      flush();
      out.push(w);
    }
  });
  flush();
  return { front: out.join(' '), answers };
}

interface Item {
  key: string;
  text: string;
  page: number;
  words: string[];
  hidden: Set<number>;
  on: boolean;
}

export function ClozeModal() {
  const cloze = useUI((s) => s.cloze);
  const docName = useLibrary((s) => s.docs.find((d) => d.id === cloze?.docId)?.name ?? 'PDF');
  const [items, setItems] = useState<Item[]>([]);
  const [topicId, setTopicId] = useState<string | null>(null);

  useEffect(() => {
    if (!cloze) return;
    const src =
      cloze.items ??
      (useLibrary.getState().highlights[cloze.docId] ?? [])
        .filter((h) => h.text.trim().split(/\s+/).length >= 3)
        .sort((a, b) => a.page - b.page || a.createdAt - b.createdAt)
        .map((h) => ({ text: h.text, page: h.page }));
    const seen = new Set<string>();
    const list: Item[] = [];
    src.forEach((it, i) => {
      const text = it.text.replace(/\s+/g, ' ').trim().slice(0, 500);
      if (!text || seen.has(text)) return;
      seen.add(text);
      const words = tokenize(text);
      const hidden = new Set(suggestCloze(words));
      list.push({ key: `${i}`, text, page: it.page, words, hidden, on: hidden.size > 0 });
    });
    setItems(list);
    setTopicId(cloze.topicId ?? topicsForDoc(cloze.docId)[0] ?? null);
  }, [cloze]);

  const ready = useMemo(() => items.filter((i) => i.on && i.hidden.size > 0), [items]);
  if (!cloze) return null;
  const close = () => useUI.getState().setCloze(null);
  const toggleWord = (k: string, idx: number) =>
    setItems((list) =>
      list.map((it) => {
        if (it.key !== k) return it;
        const hidden = new Set(it.hidden);
        if (hidden.has(idx)) hidden.delete(idx);
        else hidden.add(idx);
        return { ...it, hidden, on: hidden.size > 0 ? true : it.on };
      }),
    );
  const create = () => {
    const add = useCards.getState().addCard;
    for (const it of ready) {
      const { front, answers } = buildCloze(it.words, it.hidden);
      add({ front, back: `${answers.join(' · ')}\n\n${it.text}`, topicId, source: { docId: cloze.docId, docName, page: it.page } });
    }
    useUI.getState().showToast(`${ready.length} flashcard${ready.length === 1 ? '' : 's'} de huecos${topicId ? ` en «${TOPIC[topicId]?.title}»` : ''}: aparecen hoy en tu repaso`);
    close();
  };

  return (
    <Modal
      title="Flashcards de huecos"
      onClose={close}
      width={720}
      footer={
        <>
          <TopicSelect value={topicId} onChange={setTopicId} className="select grow" />
          <button className="btn ghost" onClick={close}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!ready.length} onClick={create}>
            Crear {ready.length || ''} flashcard{ready.length === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="cloze">
        <p className="muted small">
          Toca las palabras que quieres esconder. Ya sugerí un hueco (cifras o el término clave); cámbialo si no es lo importante. Al repasar verás «_____» y tendrás que recordarlo.
        </p>
        {!items.length && <p className="small warn-text">Este PDF no tiene subrayados con texto (de 3 palabras o más) todavía.</p>}
        <ul className="cloze-list">
          {items.map((it) => (
            <li key={it.key} className={it.on ? '' : 'off'}>
              <label className="cloze-check" title="Incluir">
                <input type="checkbox" checked={it.on} onChange={(e) => setItems((l) => l.map((x) => (x.key === it.key ? { ...x, on: e.target.checked } : x)))} aria-label={`Incluir el fragmento de la p. ${it.page}`} />
                <span className="muted small">p. {it.page}</span>
              </label>
              <p className="cloze-words">
                {it.words.map((w, i) =>
                  /[\p{L}\p{N}]/u.test(w) ? (
                    <button key={i} className={`cw${it.hidden.has(i) ? ' hidden' : ''}`} onClick={() => toggleWord(it.key, i)} aria-pressed={it.hidden.has(i)}>
                      {w}
                    </button>
                  ) : (
                    <span key={i} className="cw cw-punct">
                      {w}
                    </span>
                  ),
                )}
              </p>
              {it.hidden.size > 0 && (
                <p className="cloze-preview small muted">
                  <Icon name="cards" size={12} /> {buildCloze(it.words, it.hidden).front}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
