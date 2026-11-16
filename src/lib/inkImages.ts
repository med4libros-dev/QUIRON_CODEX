import { useBridge } from '../store/bridge';
import { useNotes } from '../store/notes';
import type { Stroke } from '../types';
import { imageAspect } from './crop';
import { idb } from './idb';
import { uid } from './id';
import { PAGE_H, PAGE_W } from './ink';

/** Imagen pegada en el lienzo (recortes de algoritmos/tablas). Coordenadas lógicas de la hoja (1000 × 1414). */
export interface InkImage {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
}

export const imgKey = (noteId: string) => `${noteId}:img`;
export const loadInkImages = async (noteId: string) => (await idb.get<InkImage[]>('ink', imgKey(noteId))) ?? [];
export const saveInkImages = (noteId: string, imgs: InkImage[]) => idb.set('ink', imgKey(noteId), imgs);

const MARGIN = 50;

/**
 * Pega una imagen en el lienzo de la nota, debajo de lo último escrito o en una hoja nueva.
 * Avisa al lienzo abierto (bumpInk) para que la muestre sin recargar.
 */
export async function addInkImage(noteId: string, src: string): Promise<InkImage> {
  const aspect = await imageAspect(src);
  const [strokes, imgs] = await Promise.all([idb.get<Stroke[]>('ink', noteId).then((s) => s ?? []), loadInkImages(noteId)]);
  let w = PAGE_W - 2 * MARGIN - 40;
  let h = w * aspect;
  const maxH = PAGE_H - 2 * MARGIN;
  if (h > maxH) {
    h = maxH;
    w = h / aspect;
  }
  // Última hoja con contenido y su punto más bajo.
  let lastPage = -1;
  let bottom = 0;
  const consider = (page: number, y: number) => {
    if (page > lastPage) {
      lastPage = page;
      bottom = y;
    } else if (page === lastPage) bottom = Math.max(bottom, y);
  };
  for (const s of strokes) for (const p of s.points) consider(s.page, p[1]);
  for (const im of imgs) consider(im.page, im.y + im.h);
  let page = Math.max(0, lastPage);
  let y = lastPage < 0 ? MARGIN : bottom + 30;
  if (y + h > PAGE_H - MARGIN) {
    page = lastPage + 1;
    y = MARGIN;
  }
  const img: InkImage = { id: uid(), page, x: (PAGE_W - w) / 2, y, w, h, src };
  await saveInkImages(noteId, [...imgs, img]);
  const note = useNotes.getState().notes.find((n) => n.id === noteId);
  if (note && note.inkPages < page + 1) useNotes.getState().updateNote(noteId, { inkPages: page + 1 });
  else useNotes.getState().updateNote(noteId, {});
  useBridge.getState().bumpInk(noteId);
  return img;
}

/**
 * Archivo de imagen → data URL, reescalado a `maxW` de ancho. Se usa para el fondo fijo de la
 * hoja: una lámina o un formato escaneado no necesita más resolución y así no infla el respaldo.
 */
export async function fileToDataUrl(file: File, maxW = 1400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const k = Math.min(1, maxW / (img.naturalWidth || maxW));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
