import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Zoom con dos dedos (pellizco) y con Ctrl + rueda / pellizco del touchpad, sobre un contenedor con scroll.
 *
 * Mientras pellizcas se ve una vista previa instantánea (transform del contenedor, sin redibujar nada);
 * al soltar se aplica el zoom real una sola vez y el punto que tenías entre los dedos queda en su lugar.
 * El lápiz sigue escribiendo igual: las anotaciones se guardan en coordenadas relativas a la página.
 */
export interface PinchOpts {
  min?: number;
  max?: number;
}

export function usePinchZoom(ref: RefObject<HTMLElement | null>, zoom: number, setZoom: (z: number) => void, { min = 0.5, max = 3 }: PinchOpts = {}) {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const setRef = useRef(setZoom);
  setRef.current = setZoom;
  /** Al aplicar el zoom: punto del contenido (en px de pantalla relativos al contenedor) que debe quedar en su sitio. */
  const pending = useRef<{ sl: number; st: number; ax0: number; ay0: number; ax1: number; ay1: number; k: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const p = pending.current;
    if (!el || !p) return;
    pending.current = null;
    el.scrollLeft = (p.sl + p.ax0) * p.k - p.ax1;
    el.scrollTop = (p.st + p.ay0) * p.k - p.ay1;
  }, [zoom, ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let g: { left: number; top: number; z0: number; d0: number; ax0: number; ay0: number; ax1: number; ay1: number; s: number; sl: number; st: number } | null = null;
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;

    const clampS = (s: number) => Math.min(max / g!.z0, Math.max(min / g!.z0, s));
    const preview = () => {
      if (!g) return;
      el.style.transformOrigin = `${g.ax0}px ${g.ay0}px`;
      el.style.transform = `translate(${g.ax1 - g.ax0}px, ${g.ay1 - g.ay0}px) scale(${g.s})`;
    };
    const begin = (cx: number, cy: number, d0: number) => {
      const r = el.getBoundingClientRect();
      g = { left: r.left, top: r.top, z0: zoomRef.current, d0, ax0: cx - r.left, ay0: cy - r.top, ax1: cx - r.left, ay1: cy - r.top, s: 1, sl: el.scrollLeft, st: el.scrollTop };
      el.dataset.pinching = '1';
      el.style.willChange = 'transform';
    };
    const finish = () => {
      if (!g) return;
      const z = Math.round(g.z0 * g.s * 100) / 100;
      const k = z / g.z0;
      el.style.transform = '';
      el.style.transformOrigin = '';
      el.style.willChange = '';
      if (Math.abs(k - 1) > 0.01) {
        pending.current = { sl: g.sl, st: g.st, ax0: g.ax0, ay0: g.ay0, ax1: g.ax1, ay1: g.ay1, k };
        setRef.current(z);
      } else {
        // Solo se movieron los dedos: desplaza.
        el.scrollLeft = g.sl - (g.ax1 - g.ax0);
        el.scrollTop = g.st - (g.ay1 - g.ay0);
      }
      g = null;
      // El aviso «pellizcando» dura un instante más para que el dedo que queda no empiece a desplazar.
      setTimeout(() => delete el.dataset.pinching, 60);
    };

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const midOf = (t: TouchList) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && !g) {
        if (e.cancelable) e.preventDefault(); // que el navegador no haga su propio zoom/desplazamiento
        const [cx, cy] = midOf(e.touches);
        begin(cx, cy, dist(e.touches));
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!g || e.touches.length < 2) return;
      if (e.cancelable) e.preventDefault();
      // Se usa la posición del contenedor al empezar: la vista previa lo mueve y falsearía la medida.
      const [cx, cy] = midOf(e.touches);
      g.s = clampS(dist(e.touches) / g.d0);
      g.ax1 = cx - g.left;
      g.ay1 = cy - g.top;
      preview();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (g && e.touches.length < 2) finish();
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // Ctrl + rueda, o pellizco del touchpad (llega como Ctrl + rueda).
      e.preventDefault();
      if (!g) begin(e.clientX, e.clientY, 1);
      g!.s = clampS(g!.s * Math.exp(-e.deltaY * 0.0025));
      preview();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(finish, 180);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      clearTimeout(wheelTimer);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
    };
  }, [ref, min, max]);
}
