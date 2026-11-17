import { APP_VERSION } from '../version';
import { isDesktop } from './platform';

const REPO = 'med4libros-dev/QUIRON_CODEX';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const SEEN = 'qc:updateSeen';
const CHECKED = 'qc:updateChecked';
const DAY = 86400000;

export interface Release {
  version: string;
  notes: string;
  url: string;
  setup: string | null;
}

/** «0.17.0» < «0.18.0». Compara número por número, no como texto. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

interface GhRelease {
  tag_name?: string;
  body?: string;
  html_url?: string;
  assets?: { name?: string; browser_download_url?: string }[];
}

/**
 * ¿Hay una versión más nueva publicada? Devuelve null si no la hay, si no hay internet
 * o si GitHub no contesta: la app funciona sin conexión y esto nunca debe estorbar.
 * Se consulta una vez al día como mucho.
 */
/**
 * Pregunta a GitHub. **Lanza** si no hay red o GitHub no contesta, para que quien busca a mano
 * pueda distinguir «estás al día» de «no se pudo preguntar»; `checkUpdate` lo silencia.
 */
export async function fetchLatest(): Promise<Release | null> {
  const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
  const data = (await res.json()) as GhRelease;
  localStorage.setItem(CHECKED, String(Date.now()));
  const version = (data.tag_name || '').replace(/^v/, '');
  if (!version || !isNewer(version, APP_VERSION)) return null;
  const setup = data.assets?.find((a) => /setup\.exe$/i.test(a.name || ''))?.browser_download_url;
  return {
    version,
    notes: (data.body || '').trim(),
    url: data.html_url || `https://github.com/${REPO}/releases/latest`,
    setup: setup || null,
  };
}

export async function checkUpdate(force = false): Promise<Release | null> {
  if (!navigator.onLine) return null;
  const last = Number(localStorage.getItem(CHECKED) || 0);
  if (!force && Date.now() - last < DAY) return null;
  try {
    return await fetchLatest();
  } catch {
    return null; // sin internet, o GitHub no contesta: no es un error que valga la pena contar
  }
}

/** Una versión que ya rechazaste no vuelve a avisar. */
export const dismissed = (v: string) => localStorage.getItem(SEEN) === v;
export const dismiss = (v: string) => localStorage.setItem(SEEN, v);

/**
 * En el navegador y en el teléfono no hay nada que descargar: la PWA se actualiza sola
 * al recargar. El aviso es solo para la app de escritorio.
 */
export const updatesMatter = () => isDesktop();
