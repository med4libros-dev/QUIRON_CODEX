import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'shield', title: 'Bolsillo: la app en el teléfono', text: 'En una pantalla de teléfono, Quirón abre en un modo de cuatro cosas: ficha de guardia, dosis por peso, las 17 escalas y la cola de repaso. Barra abajo, a una mano. «Ver todo» abre la app completa si la necesitas.' },
  { icon: 'monitor', title: 'Pensado para el Fold', text: 'Cerrado (~344 px) abre en Bolsillo; al desplegar (~690 px) pasa a la app completa en el momento, sin recargar ni perder lo que estabas viendo. Al cerrar, vuelve.' },
  { icon: 'target', title: 'Todo se puede tocar', text: 'Ningún control baja ya de 44 px con el dedo, ni en el teléfono ni en la tableta. Antes 75 de ellos sí: la barra lateral eran botones de 55 × 31.' },
];

/** «Novedades» una vez por versión (solo si ya usabas la app: en una instalación nueva no aparece). */
export function WhatsNew() {
  const config = useInternship((s) => s.config);
  const hydrated = useInternship.useHydrated();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    const seen = localStorage.getItem(SEEN);
    if (seen !== APP_VERSION) {
      localStorage.setItem(SEEN, APP_VERSION);
      setOpen(seen !== null || !!config);
    }
  }, [hydrated, config]);
  if (!open) return null;
  return (
    <Modal title={`Novedades de Quirón Codex ${APP_VERSION}`} onClose={() => setOpen(false)} width={560} footer={<><span className="spacer" /><button className="btn primary" onClick={() => setOpen(false)}>Entendido</button></>}>
      <ul className="news-list">
        {NEWS.map((n) => (
          <li key={n.title}>
            <Icon name={n.icon} size={18} />
            <div>
              <b>{n.title}</b>
              <p className="muted small">{n.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

const KEYS: [string, string][] = [
  ['Ctrl + K', 'Buscar en todo (temas, notas, texto de tus PDF…)'],
  ['G', 'Vista de Guardia'],
  ['?', 'Esta lista de atajos'],
  ['V · H · U · D · N · R · E', 'PDF: navegar, resaltar, subrayar, dibujar, post-it, recortar, borrar'],
  ['B', 'PDF: marcar la página actual'],
  ['Ctrl + Z', 'PDF y lienzo: deshacer'],
  ['Espacio', 'Flashcards: voltear la tarjeta'],
  ['Esc', 'Cerrar ventanas y menús'],
];

export function ShortcutsModal() {
  const open = useUI((s) => s.shortcutsOpen);
  if (!open) return null;
  return (
    <Modal title="Atajos de teclado" onClose={() => useUI.setState({ shortcutsOpen: false })} width={520}>
      <table className="keys-table">
        <tbody>
          {KEYS.map(([k, v]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
