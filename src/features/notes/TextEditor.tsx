import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../../components/Icon';
import { escapeHtml, sanitizeHtml } from '../../lib/html';
import { pdfRefHtml, useBridge } from '../../store/bridge';
import { useLibrary } from '../../store/library';
import { useNotes } from '../../store/notes';
import { useSettings } from '../../store/settings';
import type { Bookmark, Highlight, Note } from '../../types';

const EMPTY_H: Highlight[] = [];
const EMPTY_B: Bookmark[] = [];

const STYLES: [string, string][] = [
  ['p', 'Normal'],
  ['h1', 'Título 1'],
  ['h2', 'Título 2'],
  ['h3', 'Título 3'],
  ['blockquote', 'Cita / perla'],
];
const FONTS: [string, string][] = [
  ['', 'Fuente…'],
  ["'Segoe UI', system-ui, sans-serif", 'Sans'],
  ["Georgia, 'Palatino Linotype', serif", 'Serif'],
  ["Consolas, 'Courier New', monospace", 'Mono'],
  ["'Segoe Print', 'Bradley Hand', cursive", 'Manuscrita'],
];
/** execCommand('fontSize') usa 1–7; se muestran como tamaños de Word aproximados. */
const SIZES: [string, string][] = [
  ['', 'Tam.'],
  ['1', '8'],
  ['2', '10'],
  ['3', '12'],
  ['4', '14'],
  ['5', '18'],
  ['6', '24'],
  ['7', '32'],
];

interface FmtState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sup: boolean;
  sub: boolean;
  ul: boolean;
  ol: boolean;
  align: 'left' | 'center' | 'right' | 'justify';
  block: string;
}
const EMPTY_FMT: FmtState = { bold: false, italic: false, underline: false, strike: false, sup: false, sub: false, ul: false, ol: false, align: 'left', block: 'p' };

const countWords = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const q = (cmd: string) => {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
};

/**
 * Editor de notas tipo Word: estilos de párrafo, fuente y tamaño, color de texto y de resaltado,
 * alineación, sangrías, listas (viñetas, numeradas, de verificación), tablas, superíndice/subíndice,
 * enlaces a páginas del PDF y guardado automático.
 */
export function TextEditor({ note }: { note: Note }) {
  const ref = useRef<HTMLDivElement>(null);
  const update = useNotes((s) => s.updateNote);
  const docs = useLibrary((s) => s.docs);
  const highlights = useLibrary((s) => (note.docId ? s.highlights[note.docId] : undefined)) ?? EMPTY_H;
  const bookmarks = useLibrary((s) => (note.docId ? s.bookmarks[note.docId] : undefined)) ?? EMPTY_B;
  const pending = useBridge((s) => s.pending);
  const html = useRef(note.html);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedRange = useRef<Range | null>(null);
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [saved, setSaved] = useState(true);
  const [fmt, setFmt] = useState<FmtState>(EMPTY_FMT);
  const [textColor, setTextColor] = useState('#c0392b');
  const [markColor, setMarkColor] = useState('#fde68a');
  const [tablePicker, setTablePicker] = useState(false);
  const [hover, setHover] = useState<[number, number]>([0, 0]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    update(note.id, { html: html.current });
    setSaved(true);
  }, [note.id, update]);

  const measure = () => {
    const t = ref.current?.textContent ?? '';
    setStats({ words: countWords(t), chars: t.replace(/\s/g, '').length });
  };

  useEffect(() => {
    const el = ref.current;
    // html.current (y no note.html) para no perder lo insertado si React vuelve a montar el editor.
    if (el) el.innerHTML = html.current;
    measure();
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* navegador sin soporte */
    }
    return () => flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recuerda la selección dentro del editor (para insertar desde la cinta o desde el PDF)
  // y refleja el formato activo en los botones.
  useEffect(() => {
    const onSel = () => {
      const el = ref.current;
      const sel = document.getSelection();
      if (!el || !sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
      let block = 'p';
      try {
        block = String(document.queryCommandValue('formatBlock') || 'p').toLowerCase() || 'p';
      } catch {
        /* ignore */
      }
      setFmt({
        bold: q('bold'),
        italic: q('italic'),
        underline: q('underline'),
        strike: q('strikeThrough'),
        sup: q('superscript'),
        sub: q('subscript'),
        ul: q('insertUnorderedList'),
        ol: q('insertOrderedList'),
        align: q('justifyCenter') ? 'center' : q('justifyRight') ? 'right' : q('justifyFull') ? 'justify' : 'left',
        block: ['h1', 'h2', 'h3', 'blockquote'].includes(block) ? block : 'p',
      });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    html.current = el.innerHTML;
    dirty.current = true;
    setSaved(false);
    measure();
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  };

  /** Devuelve el foco y la selección al editor antes de aplicar un comando. */
  const restore = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = document.getSelection();
    if (!sel) return;
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else if (!sel.rangeCount || !el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const exec = (cmd: string, value?: string, css = false) => {
    restore();
    document.execCommand('styleWithCSS', false, css ? 'true' : 'false');
    document.execCommand(cmd, false, value);
    onInput();
  };
  const insertHtml = (h: string) => exec('insertHTML', h);

  // Inserciones pedidas desde el PDF (marcadores, etc.).
  useEffect(() => {
    if (!pending) return;
    const append = pending.append;
    const h = useBridge.getState().take(note.id);
    if (!h) return;
    const el = ref.current;
    if (append && el) {
      // Perlas: siempre al final, sin depender del foco (el panel puede estar oculto).
      el.insertAdjacentHTML('beforeend', h);
      onInput();
      flush();
      el.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
    } else insertHtml(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const insertHighlights = () => {
    const withText = [...highlights].filter((h) => h.text).sort((a, b) => a.page - b.page || a.rect.y - b.rect.y);
    if (!withText.length) return alert('No hay resaltados con texto en este PDF todavía.');
    insertHtml(`<h3>Resaltados</h3><ul>${withText.map((h) => `<li>${escapeHtml(h.text)} <em>(p. ${h.page})</em></li>`).join('')}</ul><p><br></p>`);
  };
  const insertBookmarks = () => {
    const name = docs.find((d) => d.id === note.docId)?.name ?? 'PDF';
    if (!note.docId || !bookmarks.length) return alert('Este PDF aún no tiene marcadores. Usa el botón de marcador en la barra del PDF.');
    insertHtml(`<ul>${bookmarks.map((b) => `<li>${pdfRefHtml(note.docId!, name, b.page, b.label)}</li>`).join('')}</ul><p><br></p>`);
  };
  const insertTable = (rows: number, cols: number) => {
    const head = `<tr>${Array.from({ length: cols }, () => '<th><br></th>').join('')}</tr>`;
    const body = Array.from({ length: rows - 1 }, () => `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`).join('');
    insertHtml(`<table data-new="1"><tbody>${head}${body}</tbody></table><p><br></p>`);
    setTablePicker(false);
    // Como en Word: el cursor queda en la primera celda.
    const table = ref.current?.querySelector('table[data-new]');
    const cell = table?.querySelector('th, td');
    table?.removeAttribute('data-new');
    if (cell) {
      const r = document.createRange();
      r.setStart(cell, 0);
      r.collapse(true);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      savedRange.current = r.cloneRange();
    }
    onInput();
  };
  const insertChecklist = () => {
    const text = savedRange.current?.toString() ?? '';
    insertHtml(`<ul class="checklist"><li>${text ? escapeHtml(text) : '<br>'}</li></ul>`);
  };

  /** Clic en un enlace a PDF → abre esa página; clic en la casilla de una lista de verificación → marca. */
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const refEl = target.closest('a.pdf-ref') as HTMLElement | null;
    if (refEl) {
      e.preventDefault();
      const docId = refEl.dataset.doc;
      const page = Number(refEl.dataset.page);
      const lib = useLibrary.getState();
      if (!docId || !lib.docs.some((d) => d.id === docId)) return alert('Ese PDF ya no está en tu biblioteca.');
      lib.setLastPage(docId, page);
      if (useSettings.getState().paneMode === 'notes') useSettings.getState().setPaneMode('both');
      if (useSettings.getState().activeDocId !== docId) useSettings.setState({ activeDocId: docId });
      lib.goTo(docId, page);
      return;
    }
    const li = target.closest('ul.checklist > li') as HTMLElement | null;
    if (li && e.clientX - li.getBoundingClientRect().left < 24) {
      li.classList.toggle('done');
      onInput();
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const inList = q('insertUnorderedList') || q('insertOrderedList');
      if (inList) exec(e.shiftKey ? 'outdent' : 'indent');
      else if (!e.shiftKey) exec('insertText', ' ');
    }
  };

  const B = ({ icon, label, title, on, run }: { icon?: IconName; label?: ReactNode; title: string; on?: boolean; run: () => void }) => (
    <button
      type="button"
      className={`fmt-btn${on ? ' on' : ''}${label && !icon ? ' text' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={on}
      onMouseDown={(e) => {
        e.preventDefault();
        run();
      }}
    >
      {icon ? <Icon name={icon} size={16} /> : label}
    </button>
  );

  return (
    <div className="editor-wrap">
      <div className="ribbon" role="toolbar" aria-label="Formato de texto">
        <div className="rb-group">
          <B icon="undo" title="Deshacer (Ctrl+Z)" run={() => exec('undo')} />
          <B icon="redo" title="Rehacer (Ctrl+Y)" run={() => exec('redo')} />
        </div>
        <div className="rb-group">
          <select className="fmt-select style" value={fmt.block} onChange={(e) => exec('formatBlock', e.target.value)} aria-label="Estilo de párrafo">
            {STYLES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="fmt-select font" value="" onChange={(e) => e.target.value && exec('fontName', e.target.value, true)} aria-label="Fuente">
            {FONTS.map(([v, l]) => (
              <option key={l} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className="fmt-select size" value="" onChange={(e) => e.target.value && exec('fontSize', e.target.value, true)} aria-label="Tamaño de letra">
            {SIZES.map(([v, l]) => (
              <option key={l} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="rb-group">
          <B label={<b>N</b>} title="Negrita (Ctrl+B)" on={fmt.bold} run={() => exec('bold')} />
          <B label={<i style={{ fontFamily: 'Georgia, serif' }}>K</i>} title="Cursiva (Ctrl+I)" on={fmt.italic} run={() => exec('italic')} />
          <B label={<u>S</u>} title="Subrayado (Ctrl+U)" on={fmt.underline} run={() => exec('underline')} />
          <B label={<s>abc</s>} title="Tachado" on={fmt.strike} run={() => exec('strikeThrough')} />
          <B label={<span>x<sup>2</sup></span>} title="Superíndice" on={fmt.sup} run={() => exec('superscript')} />
          <B label={<span>x<sub>2</sub></span>} title="Subíndice" on={fmt.sub} run={() => exec('subscript')} />
          <label className="color-btn" title="Color de texto">
            A<i style={{ background: textColor }} />
            <input
              type="color"
              value={textColor}
              onMouseDown={() => restore()}
              onChange={(e) => {
                setTextColor(e.target.value);
                exec('foreColor', e.target.value, true);
              }}
              aria-label="Color de texto"
            />
          </label>
          <B label={<span className="hl-chip">ab</span>} title="Resaltar (amarillo)" run={() => exec('hiliteColor', 'rgba(250, 204, 21, 0.5)', true)} />
          <label className="color-btn" title="Color de resaltado">
            <Icon name="highlighter" size={15} />
            <i style={{ background: markColor }} />
            <input
              type="color"
              value={markColor}
              onMouseDown={() => restore()}
              onChange={(e) => {
                setMarkColor(e.target.value);
                exec('hiliteColor', e.target.value, true);
              }}
              aria-label="Color de resaltado"
            />
          </label>
        </div>
        <div className="rb-group">
          <B icon="alignLeft" title="Alinear a la izquierda" on={fmt.align === 'left'} run={() => exec('justifyLeft')} />
          <B icon="alignCenter" title="Centrar" on={fmt.align === 'center'} run={() => exec('justifyCenter')} />
          <B icon="alignRight" title="Alinear a la derecha" on={fmt.align === 'right'} run={() => exec('justifyRight')} />
          <B icon="alignJustify" title="Justificar" on={fmt.align === 'justify'} run={() => exec('justifyFull')} />
        </div>
        <div className="rb-group">
          <B icon="listBullet" title="Viñetas" on={fmt.ul} run={() => exec('insertUnorderedList')} />
          <B icon="listNumber" title="Numeración" on={fmt.ol} run={() => exec('insertOrderedList')} />
          <B icon="checklist" title="Lista de verificación" run={insertChecklist} />
          <B icon="outdent" title="Disminuir sangría (Shift+Tab)" run={() => exec('outdent')} />
          <B icon="indent" title="Aumentar sangría (Tab)" run={() => exec('indent')} />
        </div>
        <div className="rb-group">
          <div className="group">
            <B icon="table" title="Insertar tabla" run={() => setTablePicker((v) => !v)} />
            {tablePicker && (
              <div className="table-picker" onMouseLeave={() => setHover([0, 0])}>
                <div className="table-grid">
                  {Array.from({ length: 48 }, (_, i) => {
                    const r = Math.floor(i / 8) + 1;
                    const c = (i % 8) + 1;
                    return (
                      <button
                        key={i}
                        className={r <= hover[0] && c <= hover[1] ? 'on' : ''}
                        onMouseEnter={() => setHover([r, c])}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertTable(Math.max(2, r), c);
                        }}
                        aria-label={`${r} × ${c}`}
                      />
                    );
                  })}
                </div>
                <div className="small muted" style={{ marginTop: 6 }}>
                  {hover[0] ? `${Math.max(2, hover[0])} filas × ${hover[1]} columnas` : 'Elige el tamaño'}
                </div>
              </div>
            )}
          </div>
          <B icon="minus" title="Línea horizontal" run={() => exec('insertHorizontalRule')} />
          <B icon="calendarDay" title="Insertar fecha" run={() => insertHtml(escapeHtml(new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })) + '&nbsp;')} />
          <B label="Tx" title="Borrar formato" run={() => exec('removeFormat')} />
        </div>
        {note.docId && (
          <div className="rb-group">
            <B icon="highlighter" label="" title="Insertar los resaltados del PDF" run={insertHighlights} />
            <B icon="bookmark" title="Insertar los marcadores del PDF (enlaces a página)" run={insertBookmarks} />
          </div>
        )}
      </div>
      <div className="editor-desk" onMouseDown={(e) => e.target === e.currentTarget && restore()}>
        <div
          ref={ref}
          className="editor prose"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          lang="es"
          data-placeholder="Escribe tus notas…  Tab: sangría · Ctrl+B negrita · Ctrl+I cursiva"
          onInput={onInput}
          onBlur={flush}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const h = e.clipboardData.getData('text/html');
            const t = e.clipboardData.getData('text/plain');
            e.preventDefault();
            if (h) document.execCommand('insertHTML', false, sanitizeHtml(h));
            else document.execCommand('insertText', false, t);
            onInput();
          }}
        />
      </div>
      <div className="editor-status muted small">
        <span>{stats.words} palabras</span>
        <span>{stats.chars} caracteres</span>
        <span>{saved ? 'Guardado' : 'Guardando…'}</span>
      </div>
    </div>
  );
}
