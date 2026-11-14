/**
 * Detector de huecos en una nota: cuenta los apartados (encabezados h2/h3) y cuáles siguen vacíos.
 * «Perlas de la GPC» y «Dudas para resolver» no cuentan (se llenan solos o pueden quedar vacíos).
 */
const SKIP = /perlas de la gpc|dudas para resolver/i;

export interface Completeness {
  total: number;
  filled: number;
  empty: string[];
  pct: number;
}

export function noteCompleteness(html: string): Completeness | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return null;
  const heads = Array.from(root.querySelectorAll('h2, h3'));
  if (!heads.length) return null;
  let total = 0;
  const empty: string[] = [];
  for (const h of heads) {
    const title = (h.textContent ?? '').trim();
    if (!title || SKIP.test(title)) continue;
    total++;
    let hasContent = false;
    for (let el = h.nextElementSibling; el && !/^H[23]$/.test(el.tagName); el = el.nextElementSibling) {
      if ((el.textContent ?? '').replace(/ /g, ' ').trim() || el.querySelector('img, table, a.pdf-ref')) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) empty.push(title);
  }
  if (!total) return null;
  const filled = total - empty.length;
  return { total, filled, empty, pct: Math.round((filled / total) * 100) };
}
