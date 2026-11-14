import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'lasso', title: 'Lazo', text: 'En el lienzo, el botón del lazo encierra lo que escribiste para moverlo, agrandarlo, cambiarle el color, duplicarlo o borrarlo.' },
  { icon: 'flow', title: 'Formas rectas', text: 'Dibuja una flecha, un cuadro o un círculo y deja el lápiz quieto medio segundo: se convierte en forma limpia. Se apaga en Preferencias → Lápiz.' },
  { icon: 'pen', title: 'Plumas favoritas', text: 'Cuatro plumas a un toque, arriba de los colores. Mantén presionada una para guardar ahí la pluma que estés usando. El botón lateral del lápiz hace de borrador o de lazo.' },
  { icon: 'copy', title: 'Hojas del lienzo', text: 'Inserta hojas en medio, súbelas, bájalas o quítalas; y plantillas Cornell y de dos columnas.' },
  { icon: 'moon', title: 'Guía en oscuro y pantalla completa', text: 'En el PDF, menú «⋯»: fondo negro con texto claro, y lectura sin barras (Esc para salir).' },
  { icon: 'clock', title: 'Tu tiempo de estudio se cuenta solo', text: 'Mientras lees o escribes, el reloj de arriba suma tu tiempo y lo guarda en Progreso. Se detiene a los 2 minutos sin actividad.' },
  { icon: 'sparkles', title: 'Gemini o Claude', text: 'En Ajustes → Preferencias → IA puedes elegir el motor y poner tu clave de Google (Gemini) en vez de la de Anthropic.' },
  { icon: 'target', title: 'Diagnóstico del lápiz', text: 'Preferencias → Lápiz → Diagnóstico: mide el retraso real en tu Surface y te dice dónde está el problema.' },
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
