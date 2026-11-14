/**
 * «El lápiz está escribiendo»: mientras hay un trazo en curso (y un momento después),
 * la app pospone guardados y redibujos para que nada le quite tiempo a la tinta.
 * Lo pospuesto se ejecuta en la primera pausa, y siempre al ocultar o cerrar la ventana.
 */
let down = 0;
// performance.now(): reloj monótono, no depende de la hora del sistema.
let lastUp = -1e9;
export const inkDown = () => {
  down++;
};
export const inkUp = () => {
  down = Math.max(0, down - 1);
  lastUp = performance.now();
};
/** Hay un trazo en curso en este instante. */
export const inkIsDown = () => down > 0;
/** Trazo en curso, o hace menos de `grace` ms que se levantó el lápiz. */
export const inkBusy = (grace = 800) => down > 0 || performance.now() - lastUp < grace;

/** Ejecuta `fn` cuando el lápiz lleve un momento sin escribir. Devuelve cómo cancelarlo. */
export function whenInkIdle(fn: () => void, delay: number): () => void {
  let t: ReturnType<typeof setTimeout>;
  const tick = () => {
    if (inkBusy()) t = setTimeout(tick, 500);
    else fn();
  };
  t = setTimeout(tick, delay);
  return () => clearTimeout(t);
}
