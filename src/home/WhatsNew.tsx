import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'checklist', title: 'Preparar el día 1', text: 'En Turno, botón «Preparar el día 1» (y en la pantalla de bienvenida): cinco pasos para llegar listo a tu primera guardia. Confirma la fecha, descarga un respaldo, te dice cuántas fichas de guardia llevas de las diez de urgencias, revisa tus dosis y tus resúmenes. Lo que falta queda marcado.' },
  { icon: 'page', title: 'La barra del lienzo ocupa la mitad', text: 'Todo lo que se elige una vez por nota —tamaño de hoja, estilo de papel, capa, plantillas de flujograma, fondo— se fue al botón «Hoja». La barra se queda con lo de cada trazo. El lienzo gana unos 250 píxeles de alto en la Surface.' },
  { icon: 'download', title: 'Exportar vive en el menú ⋯', text: 'PDF, PDF con símbolos y Word salieron de la barra y están en el menú de tres puntos de la nota, con una línea que explica para qué sirve cada uno. El de símbolos sigue siendo el que conserva griego, flechas, ≥ y µ.' },
  { icon: 'moon', title: 'Las ventanas ya no son transparentes', text: 'Preferencias y los demás diálogos tapan de verdad lo que hay detrás. El vidrio líquido se queda donde adorna —barras y cápsulas— y se quita donde estorbaba para leer.' },
  { icon: 'check', title: 'Las barras flotantes no se montan encima', text: 'La barra de sincronización y la de actualización se esconden mientras tienes una ventana abierta, y dejan sitio al final de la página para que el último botón no quede debajo.' },
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
