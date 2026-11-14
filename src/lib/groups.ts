/**
 * Agrupa por página reutilizando los arreglos de la vez anterior cuando su contenido no cambió.
 * Así, al escribir en una hoja, las demás hojas (memo) no se vuelven a renderizar ni a redibujar.
 */
export function stableGroups<T extends { page: number }>(prev: Map<number, T[]>, items: readonly T[]): Map<number, T[]> {
  const next = new Map<number, T[]>();
  for (const it of items) {
    const list = next.get(it.page);
    if (list) list.push(it);
    else next.set(it.page, [it]);
  }
  for (const [page, list] of next) {
    const old = prev.get(page);
    if (old && old.length === list.length && old.every((x, i) => x === list[i])) next.set(page, old);
  }
  return next;
}
