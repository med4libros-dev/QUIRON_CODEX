import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { useExam } from '../exam/store';
import { useCards } from '../flashcards/store';
import { useHy } from '../hy/store';
import { SPECIALTY, TOPIC, TOPICS } from '../internship/curriculum';
import { useTopicStore } from '../internship/topicStore';
import { htmlToText } from '../lib/html';
import { pagesOf } from '../lib/pageIndex';
import { useLibrary } from '../store/library';
import { openPdfPage } from '../store/navigate';
import { useNotes } from '../store/notes';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Hit {
  key: string;
  group: string;
  title: string;
  snippet: string;
  go: () => void;
}

/** Fragmento alrededor de la coincidencia (sobre el texto original, con acentos). */
function around(text: string, needle: string, span = 70): string {
  const n = norm(text);
  const i = n.indexOf(needle);
  if (i < 0) return text.slice(0, span * 2);
  const a = Math.max(0, i - span);
  const b = Math.min(text.length, i + needle.length + span);
  return `${a > 0 ? '…' : ''}${text.slice(a, b).replace(/\s+/g, ' ')}${b < text.length ? '…' : ''}`;
}

function Mark({ text, needle }: { text: string; needle: string }) {
  const n = norm(text);
  const i = needle ? n.indexOf(needle) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

const openNote = (id: string) => {
  const n = useNotes.getState().notes.find((x) => x.id === id);
  if (!n) return;
  const st = useSettings.getState();
  if (n.notebookId) st.setNotebookScope(n.notebookId);
  else if (n.docId) {
    st.setNotebookScope(null);
    useSettings.setState({ activeDocId: n.docId });
  }
  useSettings.getState().setActiveNote(id);
  useSettings.getState().setView('study');
};

/** Búsqueda global (Ctrl+K): temas, notas, PDFs (por página), perlas, fragmentos, casos, flashcards y preguntas. */
export function SearchModal() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearchOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUI.getState().searchOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  if (!open) return null;
  return createPortal(<SearchInner onClose={() => setOpen(false)} />, document.body);
}

function SearchInner({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [needle, setNeedle] = useState('');
  const [sel, setSel] = useState(0);
  const [pdfHits, setPdfHits] = useState<Hit[]>([]);
  const [indexing, setIndexing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const notes = useNotes((s) => s.notes);
  const hy = useHy((s) => s.items);
  const info = useTopicStore((s) => s.info);
  const cards = useCards((s) => s.cards);
  const questions = useExam((s) => s.questions);
  const docs = useLibrary((s) => s.docs);

  useEffect(() => {
    const t = setTimeout(() => setNeedle(norm(q.trim())), 140);
    return () => clearTimeout(t);
  }, [q]);

  const close = (go?: () => void) => {
    onClose();
    go?.();
  };

  const hits = useMemo<Hit[]>(() => {
    if (needle.length < 2) return [];
    const out: Hit[] = [];
    const push = (h: Hit, max: number) => out.filter((x) => x.group === h.group).length < max && out.push(h);
    for (const t of TOPICS) if (norm(t.title).includes(needle)) push({ key: `t${t.id}`, group: 'Temas', title: t.title, snippet: SPECIALTY[t.specialty].name, go: () => useUI.getState().openTopic(t.id, 'docs') }, 6);
    for (const n of notes) {
      const text = htmlToText(n.html);
      if (norm(`${n.title} ${text}`).includes(needle)) push({ key: `n${n.id}`, group: 'Notas', title: n.title || 'Sin título', snippet: around(text, needle), go: () => openNote(n.id) }, 8);
    }
    for (const i of hy)
      if (norm(`${i.title} ${i.text} ${i.explain}`).includes(needle))
        push({ key: `h${i.id}`, group: 'Perlas HY', title: i.title || 'Perla', snippet: around(i.text, needle), go: () => (i.topicId ? useUI.getState().openTopic(i.topicId, 'hy') : useSettings.getState().setView('hy')) }, 6);
    for (const [tid, i] of Object.entries(info))
      for (const c of i.cases)
        if (norm(`${c.patient} ${c.finding} ${c.management}`).includes(needle))
          push({ key: `c${c.id}`, group: 'Casos vistos', title: TOPIC[tid]?.title ?? 'Caso', snippet: `${c.patient} · ${c.finding}`, go: () => useUI.getState().openTopic(tid, 'cases') }, 5);
    for (const c of cards)
      if (norm(`${c.front} ${c.back}`).includes(needle))
        push({ key: `f${c.id}`, group: 'Flashcards', title: c.front, snippet: around(c.back, needle), go: () => (c.topicId ? useUI.getState().openTopic(c.topicId, 'cards') : undefined) }, 5);
    for (const x of questions)
      if (norm(`${x.vignette} ${x.question}`).includes(needle))
        push({ key: `q${x.id}`, group: 'Preguntas de simulacro', title: x.question, snippet: around(x.vignette, needle), go: () => useSettings.getState().setView('exam') }, 5);
    return out;
  }, [needle, notes, hy, info, cards, questions]);

  // Texto de los PDFs: se indexa la primera vez (se guarda para las siguientes búsquedas).
  useEffect(() => {
    if (needle.length < 3) {
      setPdfHits([]);
      return;
    }
    let alive = true;
    (async () => {
      const found: Hit[] = [];
      for (const d of docs) {
        if (!alive) return;
        let pages: string[];
        try {
          setIndexing(d.name);
          pages = await pagesOf(d.id);
        } catch {
          continue;
        }
        for (let i = 0; i < pages.length && found.filter((h) => h.title.startsWith(d.name)).length < 4; i++) {
          if (norm(pages[i]).includes(needle)) found.push({ key: `p${d.id}:${i}`, group: 'PDFs', title: `${d.name} · p. ${i + 1}`, snippet: around(pages[i], needle), go: () => openPdfPage(d.id, i + 1) });
        }
        if (found.length >= 12) break;
      }
      if (alive) {
        setIndexing(null);
        setPdfHits(found);
      }
    })();
    return () => {
      alive = false;
    };
  }, [needle, docs]);

  const all = [...hits, ...pdfHits];
  useEffect(() => setSel(0), [needle]);
  const groups = [...new Set(all.map((h) => h.group))];

  return (
    <div className="search-backdrop" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="search-box" role="dialog" aria-label="Buscar en todo">
        <div className="search-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca en notas, PDFs, perlas, casos, flashcards…"
            aria-label="Buscar en todo"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((s) => Math.min(all.length - 1, s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === 'Enter' && all[sel]) close(all[sel].go);
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-results">
          {needle.length < 2 && <p className="muted small search-hint">Escribe al menos 2 letras. Ctrl+K abre este buscador desde cualquier pantalla.</p>}
          {groups.map((g) => (
            <section key={g}>
              <h5>{g}</h5>
              {all.map((h, k) =>
                h.group === g ? (
                  <button key={h.key} className={`search-hit${k === sel ? ' sel' : ''}`} onMouseEnter={() => setSel(k)} onClick={() => close(h.go)}>
                    <b className="ellipsis">
                      <Mark text={h.title} needle={needle} />
                    </b>
                    <span className="muted small">
                      <Mark text={h.snippet} needle={needle} />
                    </span>
                  </button>
                ) : null,
              )}
            </section>
          ))}
          {indexing && <p className="muted small search-hint">Leyendo «{indexing}» para buscar en su texto… (solo la primera vez)</p>}
          {needle.length >= 2 && !all.length && !indexing && <p className="muted small search-hint">Sin resultados.</p>}
        </div>
      </div>
    </div>
  );
}
