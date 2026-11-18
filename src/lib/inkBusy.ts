/**
 * «El lápiz está escribiendo»: mientras hay un trazo en curso (y un momento después),
 * la app pospone guardados y redibujos para que nada le quite tiempo a la tinta.
 * Lo pospuesto se ejecuta en la primera pausa, y siempre al ocultar o cerrar la ventana.
 */
let down = 0;

/**
 * Marca en el <html> si el lápiz está escribiendo, para que el CSS pueda apagar lo caro
 * (el desenfoque del pack de vidrio) sin que ningún componente tenga que enterarse.
 */
function marcar(activo: boolean) {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  if (activo) el.dataset.inkBusy = '1';
  else delete el.dataset.inkBusy;
}
// performance.now(): reloj monótono, no depende de la hora del sistema.
let lastUp = -1e9;
export const inkDown = () => {
  down++;
  marcar(true);
};
export const inkUp = () => {
  down = Math.max(0, down - 1);
  lastUp = performance.now();
  // El desenfoque vuelve en la primera pausa real, no en cuanto se levanta el lápiz:
  // entre trazo y trazo hay milisegundos, y parpadear sería peor que no tenerlo.
  if (down === 0) setTimeout(() => void (!inkBusy() && marcar(false)), 900);
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
