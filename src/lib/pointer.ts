/** Captura el puntero si es posible (algunos navegadores/eventos lo rechazan; no debe romper el trazo). */
export function capturePointer(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* sin captura: el trazo sigue funcionando dentro del elemento */
  }
}
