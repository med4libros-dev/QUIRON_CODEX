/**
 * Buscar dentro del PDF abierto (Ctrl+F). La capa de texto de pdf.js ya tiene las palabras
 * colocadas sobre la página: aquí se recorren, se localizan las coincidencias y se devuelven
 * sus rectángulos en porcentaje, para pintarlos encima sin tocar el texto seleccionable.
 */

/** Rectángulo en porcentaje (0–100) relativo a la página. */
export interface FindRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Quita acentos y mayúsculas conservando una letra por letra (así los índices no se desfasan). */
const fold = (ch: string) => {
  const f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return f.length === 1 ? f : f[0] ?? ' ';
};

export const foldText = (s: string) => [...s].map(fold).join('');

export function findRects(layer: HTMLElement, needle: string, max = 200): FindRect[] {
  const q = foldText(needle.trim());
  if (q.length < 2) return [];
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const offs: number[] = [];
  let hay = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    for (let i = 0; i < t.data.length; i++) {
      hay += fold(t.data[i]);
      nodes.push(t);
      offs.push(i);
    }
  }
  const box = layer.getBoundingClientRect();
  if (!box.width || !box.height) return [];
  const out: FindRect[] = [];
  let from = 0;
  for (let k = 0; k < max; k++) {
    const i = hay.indexOf(q, from);
    if (i < 0) break;
    from = i + q.length;
    const last = i + q.length - 1;
    try {
      const r = document.createRange();
      r.setStart(nodes[i], offs[i]);
      r.setEnd(nodes[last], offs[last] + 1);
      for (const rect of Array.from(r.getClientRects())) {
        if (rect.width < 0.5 || rect.height < 0.5) continue;
        out.push({
          x: ((rect.left - box.left) / box.width) * 100,
          y: ((rect.top - box.top) / box.height) * 100,
          w: (rect.width / box.width) * 100,
          h: (rect.height / box.height) * 100,
        });
      }
    } catch {
      /* el texto cambió mientras se buscaba */
    }
  }
  return out;
}
