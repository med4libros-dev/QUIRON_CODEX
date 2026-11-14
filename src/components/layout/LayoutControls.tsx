import { useEffect } from 'react';
import { Icon } from '../Icon';
import { useSettings } from '../../store/settings';

/**
 * Distribución de la pantalla de estudio: solo PDF / ambos / solo notas, e intercambiar lados.
 * Atajos: Alt+1 (PDF) · Alt+2 (ambos) · Alt+3 (notas) · Alt+S (intercambiar).
 */
export function LayoutControls() {
  const mode = useSettings((s) => s.paneMode);
  const setMode = useSettings((s) => s.setPaneMode);
  const swapped = useSettings((s) => s.swapPanes);
  const toggleSwap = useSettings((s) => s.toggleSwap);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || useSettings.getState().view !== 'study') return;
      const k = e.key.toLowerCase();
      const s = useSettings.getState();
      if (k === '1') s.setPaneMode('pdf');
      else if (k === '2') s.setPaneMode('both');
      else if (k === '3') s.setPaneMode('notes');
      else if (k === 's') s.toggleSwap();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // El orden de los botones sigue el lado en que está cada panel.
  const pdfBtn = (
    <button key="pdf" className={mode === 'pdf' ? 'active' : ''} onClick={() => setMode('pdf')} title="Solo el PDF (Alt+1)" aria-label="Ampliar el PDF">
      <Icon name="book" size={15} /> <span className="hide-narrow">PDF</span>
    </button>
  );
  const notesBtn = (
    <button key="notes" className={mode === 'notes' ? 'active' : ''} onClick={() => setMode('notes')} title="Solo las notas (Alt+3)" aria-label="Ampliar las notas">
      <Icon name="pen" size={15} /> <span className="hide-narrow">Notas</span>
    </button>
  );
  const bothBtn = (
    <button key="both" className={mode === 'both' ? 'active' : ''} onClick={() => setMode('both')} title="Pantalla dividida (Alt+2)" aria-label="Pantalla dividida">
      <Icon name="columns" size={15} />
    </button>
  );

  return (
    <div className="layout-controls">
      <div className="seg" role="radiogroup" aria-label="Distribución">
        {swapped ? [notesBtn, bothBtn, pdfBtn] : [pdfBtn, bothBtn, notesBtn]}
      </div>
      <button className="icon-btn" onClick={toggleSwap} title="Intercambiar lados del PDF y las notas (Alt+S)" aria-label="Intercambiar lados">
        <Icon name="swap" />
      </button>
    </div>
  );
}
