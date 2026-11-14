/* Utilidades de HTML: sanitizar lo pegado/generado y convertir a bloques para exportar. */

const ALLOWED = new Set([
  'H1', 'H2', 'H3', 'H4', 'P', 'DIV', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK',
  'BLOCKQUOTE', 'BR', 'SPAN', 'CODE', 'SUB', 'SUP', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH',
]);
const DROP = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TITLE', 'HEAD', 'SVG', 'CANVAS',
  'VIDEO', 'AUDIO', 'IMG', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'TEMPLATE',
]);

function clean(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag)) return null;
  let out: Node;
  if (ALLOWED.has(tag)) {
    const copy = doc.createElement(tag.toLowerCase());
    const bg = el.style?.backgroundColor;
    if (bg && (tag === 'SPAN' || tag === 'MARK')) copy.style.backgroundColor = bg;
    out = copy;
  } else {
    out = doc.createDocumentFragment();
  }
  el.childNodes.forEach((c) => {
    const k = clean(c, doc);
    if (k) out.appendChild(k);
  });
  return out;
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const box = doc.createElement('div');
  doc.body.childNodes.forEach((c) => {
    const k = clean(c, doc);
    if (k) box.appendChild(k);
  });
  return box.innerHTML;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- HTML → bloques (para PDF y texto plano) ---------- */

export interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'quote' | 'hr' | 'img';
  text: string;
  src?: string;
  marker?: string;
  depth?: number;
}

const BLOCK_TAGS = new Set([
  'IMG', 'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'TABLE', 'SECTION', 'ARTICLE',
]);
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const textOf = (n: Node) => squash(n.textContent ?? '');
const isList = (n: Node): n is HTMLElement => n instanceof HTMLElement && (n.tagName === 'UL' || n.tagName === 'OL');

function walkChildren(parent: Node, out: Block[], depth: number) {
  let buf = '';
  const flush = () => {
    const t = squash(buf);
    if (t) out.push({ type: 'p', text: t });
    buf = '';
  };
  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      buf += child.textContent ?? '';
      return;
    }
    if (!(child instanceof HTMLElement)) return;
    const tag = child.tagName.toUpperCase();
    if (tag === 'BR') return flush();
    if (!BLOCK_TAGS.has(tag)) {
      buf += child.textContent ?? '';
      return;
    }
    flush();
    walkBlock(child, tag, out, depth);
  });
  flush();
}

function walkBlock(el: HTMLElement, tag: string, out: Block[], depth: number) {
  switch (tag) {
    case 'H1':
      out.push({ type: 'h1', text: textOf(el) });
      break;
    case 'H2':
      out.push({ type: 'h2', text: textOf(el) });
      break;
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      out.push({ type: 'h3', text: textOf(el) });
      break;
    case 'HR':
      out.push({ type: 'hr', text: '' });
      break;
    case 'IMG': {
      const src = el.getAttribute('src') ?? '';
      if (/^data:image\/(png|jpe?g);base64,/.test(src)) out.push({ type: 'img', text: '', src });
      break;
    }
    case 'BLOCKQUOTE':
      out.push({ type: 'quote', text: textOf(el) });
      break;
    case 'UL':
    case 'OL': {
      let i = 0;
      const checklist = el.classList.contains('checklist');
      el.childNodes.forEach((c) => {
        if (!(c instanceof HTMLElement)) return;
        if (c.tagName === 'LI') {
          i += 1;
          const own = Array.from(c.childNodes).filter((n) => !isList(n));
          const text = squash(own.map((n) => (n instanceof HTMLElement && n.tagName === 'BR' ? ' ' : n.textContent ?? '')).join(' '));
          const marker = checklist ? (c.classList.contains('done') ? '[x]' : '[ ]') : tag === 'OL' ? `${i}.` : '•';
          out.push({ type: 'li', text, marker, depth });
          c.childNodes.forEach((n) => {
            if (isList(n)) walkBlock(n, n.tagName, out, depth + 1);
          });
        } else if (isList(c)) {
          walkBlock(c, c.tagName, out, depth + 1);
        }
      });
      break;
    }
    case 'LI':
      out.push({ type: 'li', text: textOf(el), marker: '•', depth });
      break;
    case 'TABLE':
      el.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.children).map((td) => textOf(td)).filter(Boolean);
        if (cells.length) out.push({ type: 'p', text: cells.join('  |  ') });
      });
      break;
    default:
      walkChildren(el, out, depth);
  }
}

export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: Block[] = [];
  walkChildren(doc.body, out, 0);
  return out;
}

export function htmlToText(html: string): string {
  return htmlToBlocks(html)
    .filter((b) => b.type !== 'img')
    .map((b) => (b.type === 'li' ? `${b.marker} ${b.text}` : b.text))
    .filter(Boolean)
    .join('\n');
}
