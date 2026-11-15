import { downloadBlob } from './exportPdf';
import { escapeHtml, htmlToText } from './html';
import { TOPIC } from '../internship/curriculum';
import { useCards } from '../flashcards/store';
import { useHy } from '../hy/store';
import { useLibrary } from '../store/library';
import { useNotes } from '../store/notes';

/**
 * Paquete de repaso para el celular: un solo archivo .html con tus notas, perlas, resaltados
 * y flashcards. Se abre en cualquier teléfono (sin instalar nada, sin internet), trae buscador
 * y es de solo lectura: lo que estudies ahí no se sincroniza de vuelta.
 *
 * No incluye los PDFs (pesan demasiado para el teléfono): sí los resaltados con su página.
 */
export interface PackOptions {
  notes: boolean;
  pearls: boolean;
  cards: boolean;
  highlights: boolean;
  /** Incluir las imágenes pegadas en las notas (recortes). Pesa bastante más. */
  images: boolean;
}

const stripImages = (html: string) => html.replace(/<img\b[^>]*>/gi, '<p class="sin-img">[imagen omitida]</p>');

/** Quita lo que no debe ejecutarse en el archivo del teléfono. */
const safe = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');

export function buildPack(opts: PackOptions): string {
  const notes = useNotes.getState();
  const books = new Map(notes.notebooks.map((b) => [b.id, b.name]));
  const docs = new Map(useLibrary.getState().docs.map((d) => [d.id, d.name]));
  const parts: string[] = [];

  if (opts.notes) {
    const list = notes.notes
      .filter((n) => htmlToText(n.html).trim() || n.inkText?.trim())
      .sort((a, b) => b.updatedAt - a.updatedAt);
    parts.push(section('Notas', list.map((n) => {
      const where = [n.notebookId ? books.get(n.notebookId) : '', n.docId ? docs.get(n.docId) : ''].filter(Boolean).join(' · ');
      const body = safe(opts.images ? n.html : stripImages(n.html));
      const ink = n.inkText ? `<div class="ink"><b>De tu letra:</b><pre>${escapeHtml(n.inkText)}</pre></div>` : '';
      return item(n.title || 'Nota sin título', where, `${body}${ink}`);
    })));
  }

  if (opts.pearls) {
    const items = useHy.getState().items.filter((i) => i.text.trim());
    parts.push(section('Perlas', items.map((i) =>
      item(i.title || 'Perla', i.topicId ? TOPIC[i.topicId]?.title ?? '' : '', `<p>${escapeHtml(i.text)}</p>${i.explain ? `<p class="muted">${escapeHtml(i.explain)}</p>` : ''}`),
    )));
  }

  if (opts.cards) {
    const cards = useCards.getState().cards;
    parts.push(section('Flashcards', cards.map((c) =>
      item(c.front, c.topicId ? TOPIC[c.topicId]?.title ?? '' : '', `<details><summary>Ver respuesta</summary><div>${escapeHtml(c.back)}${c.image && opts.images ? `<img src="${c.image}" alt="">` : ''}</div></details>`),
    )));
  }

  if (opts.highlights) {
    const { highlights } = useLibrary.getState();
    const blocks: string[] = [];
    for (const [docId, list] of Object.entries(highlights)) {
      const withText = list.filter((h) => h.text.trim()).sort((a, b) => a.page - b.page);
      if (!withText.length) continue;
      blocks.push(
        item(docs.get(docId) ?? 'Guía', `${withText.length} resaltados`, `<ul>${withText.map((h) => `<li>${escapeHtml(h.text.replace(/\s+/g, ' ').trim())} <span class="muted">p. ${h.page}</span></li>`).join('')}</ul>`),
      );
    }
    parts.push(section('Resaltados', blocks));
  }

  const made = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quirón Codex · repaso</title>
<style>
:root { color-scheme: light dark; --bg:#fbfaf7; --fg:#1b1b19; --mut:#6b6b64; --card:#fff; --line:#e6e4dd; --acc:#0f766e; }
@media (prefers-color-scheme: dark) { :root { --bg:#14151a; --fg:#ececea; --mut:#9a9a93; --card:#1c1e25; --line:#2b2e37; --acc:#5eead4; } }
* { box-sizing:border-box; }
body { margin:0; padding:16px 14px 64px; background:var(--bg); color:var(--fg); font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; -webkit-text-size-adjust:100%; }
h1 { font-size:1.3rem; margin:0 0 2px; } h2 { font-size:1.05rem; margin:26px 0 10px; color:var(--acc); }
.muted { color:var(--mut); } .small { font-size:.85rem; }
#q { width:100%; padding:11px 13px; font-size:1rem; border:1px solid var(--line); border-radius:12px; background:var(--card); color:var(--fg); margin:12px 0 4px; }
.it { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin:10px 0; }
.it h3 { font-size:.98rem; margin:0 0 4px; } .it .where { font-size:.78rem; color:var(--mut); margin-bottom:6px; }
.it img { max-width:100%; height:auto; border-radius:8px; } .it pre { white-space:pre-wrap; font:inherit; margin:4px 0 0; }
.it table { width:100%; border-collapse:collapse; } .it td, .it th { border:1px solid var(--line); padding:4px 6px; }
.ink { border-top:1px dashed var(--line); margin-top:8px; padding-top:6px; font-size:.92rem; }
details summary { cursor:pointer; color:var(--acc); } .sin-img { color:var(--mut); font-size:.85rem; }
.pdf-ref, .pearl-src { color:var(--mut); font-size:.82rem; }
.none { color:var(--mut); font-size:.9rem; }
footer { margin-top:30px; color:var(--mut); font-size:.78rem; }
</style></head>
<body>
<h1>Quirón Codex · repaso</h1>
<p class="muted small">Copia de solo lectura · ${made}</p>
<input id="q" type="search" placeholder="Filtrar…" aria-label="Filtrar">
${parts.join('\n')}
<footer>Lo que marques aquí no regresa a la app: esto es solo para leer en el teléfono.</footer>
<script>
var q=document.getElementById('q');
q.addEventListener('input',function(){
  var t=q.value.trim().toLowerCase();
  document.querySelectorAll('.it').forEach(function(el){
    el.style.display = !t || el.textContent.toLowerCase().indexOf(t)>=0 ? '' : 'none';
  });
  document.querySelectorAll('section').forEach(function(s){
    var vis=Array.prototype.some.call(s.querySelectorAll('.it'),function(e){return e.style.display!=='none';});
    s.style.display = !t || vis ? '' : 'none';
  });
});
</script>
</body></html>`;
}

const section = (title: string, items: string[]) =>
  `<section><h2>${title}</h2>${items.length ? items.join('') : '<p class="none">Nada todavía.</p>'}</section>`;

const item = (title: string, where: string, body: string) =>
  `<article class="it"><h3>${escapeHtml(title)}</h3>${where ? `<div class="where">${escapeHtml(where)}</div>` : ''}${body}</article>`;

export function exportPack(opts: PackOptions) {
  const html = buildPack(opts);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'quiron-codex-repaso.html');
  return html.length;
}
