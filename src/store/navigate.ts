import { useLibrary } from './library';
import { useSettings } from './settings';

/** Abre un PDF de la biblioteca en Estudio, opcionalmente en una página. Devuelve false si ya no existe. */
export function openPdfPage(docId: string, page?: number): boolean {
  const lib = useLibrary.getState();
  if (!lib.docs.some((d) => d.id === docId)) return false;
  if (page) lib.setLastPage(docId, page);
  const st = useSettings.getState();
  if (st.paneMode === 'notes') st.setPaneMode('both');
  // Sin reiniciar la nota activa (setActiveDoc lo haría).
  if (st.activeDocId !== docId) useSettings.setState({ activeDocId: docId });
  useSettings.getState().setView('study');
  if (page) lib.goTo(docId, page);
  return true;
}
