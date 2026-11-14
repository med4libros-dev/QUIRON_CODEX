import type { NRect } from '../types';

/**
 * Recorta una zona de una página del PDF ya renderizada (PDF + tinta encima) como imagen.
 * Usa los canvas que ya están en pantalla: no vuelve a renderizar el PDF.
 * Devuelve '' si la página no está renderizada.
 */
export function cropPage(pageEl: Element | null, r: NRect, maxW = 1400): string {
  if (!pageEl) return '';
  const canvases = Array.from(pageEl.querySelectorAll('canvas')).filter((c) => c.width > 0 && c.height > 0);
  const base = canvases[0];
  if (!base) return '';
  const sx = Math.max(0, Math.floor(r.x * base.width));
  const sy = Math.max(0, Math.floor(r.y * base.height));
  const sw = Math.min(base.width - sx, Math.ceil(r.w * base.width));
  const sh = Math.min(base.height - sy, Math.ceil(r.h * base.height));
  if (sw < 4 || sh < 4) return '';
  const k = Math.min(1, maxW / sw);
  const out = document.createElement('canvas');
  out.width = Math.round(sw * k);
  out.height = Math.round(sh * k);
  const ctx = out.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  for (const c of canvases) {
    // Las capas de tinta pueden tener otra resolución: se escala proporcionalmente.
    const fx = c.width / base.width;
    const fy = c.height / base.height;
    ctx.drawImage(c, sx * fx, sy * fy, sw * fx, sh * fy, 0, 0, out.width, out.height);
  }
  return out.toDataURL('image/jpeg', 0.88);
}

/** Proporción alto/ancho de una imagen (data URL). */
export function imageAspect(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.6);
    img.onerror = () => resolve(0.6);
    img.src = src;
  });
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
