import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'mic', title: 'La clase grabada, ahora transcrita', text: 'Botón «Transcribir» en la barra de grabación: pasa la clase a texto con marcas de tiempo y entra en Ctrl+K. Necesita el motor Gemini, porque la API de Claude no recibe audio.' },
  { icon: 'swap', title: 'Ponerme al día', text: 'En «Pendientes»: reparte lo que quedó atrás en los próximos días con espacio, saltándose las guardias. Si algo no cabe, te dice cuánto quedó fuera en vez de reventar un día.' },
  { icon: 'target', title: 'Mini-examen del día', text: 'Cinco casos de los temas que te tocaban hoy, con explicación inmediata y la cita de la GPC. Sale del banco que ya tienes; si no hay preguntas de esos temas, lo dice.' },
  { icon: 'flow', title: 'Flujogramas y capas', text: 'Plantillas de algoritmo en tinta para escribir dentro, flechas que se enganchan solas a las cajas, y una capa de borrador que va debajo, más tenue, y se puede ocultar sin borrarla.' },
  { icon: 'layers', title: 'El lienzo ya no se arrastra', text: 'Con cuadernos de cientos de hojas solo se monta lo que se ve. Y al exportar a PDF se respeta el tamaño de hoja: una nota apaisada o en rollo ya no sale deformada.' },
  { icon: 'monitor', title: 'Instalable en Edge', text: 'La versión web se instala como aplicación y abre sin internet. En la app de escritorio no cambia nada.' },
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
