import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'columns', title: 'Doble plana y controles flotantes', text: 'El botón de columnas pone dos páginas a la vez (para tablas a doble hoja). En pantalla completa ya no te quedas sin controles: acerca el lápiz al borde de arriba y aparecen página, zoom y búsqueda.' },
  { icon: 'layers', title: 'Organizar hojas del lienzo', text: 'Botón «Hojas»: miniaturas que arrastras para reordenar y fusionar con la anterior. Y con el lazo puedes mandar lo seleccionado a la hoja de arriba o de abajo.' },
  { icon: 'cards', title: 'Repaso FSRS y cola de guardia', text: 'El repaso espaciado ahora usa FSRS: calcula el día exacto según lo que de verdad recuerdas. En Herramientas → «Repaso de guardia»: 10 minutos, botones grandes, con una mano. La exigencia se ajusta en Preferencias.' },
  { icon: 'chart', title: 'Historial de simulacros', text: 'Pestaña «Historial» en Simulacros: cómo vienes intento a intento, en qué especialidad fallas y un botón para repetir solo las que fallaste.' },
  { icon: 'pencil', title: 'Tu letra, mejor leída', text: 'Guarda tus abreviaturas («IAM = infarto agudo de miocardio») y el reconocimiento deja de equivocarse en las mismas. En Cuadernos puedes transcribir todas las notas del cuaderno de una pasada.' },
  { icon: 'list', title: 'Temario editable', text: 'En Temario → «Editar»: cambia títulos y prioridades, parte un tema en dos, quita los que no vas a estudiar y agrega los tuyos. El plan del año se recalcula y lo ya estudiado se conserva.' },
  { icon: 'calendar', title: 'Informe semanal más honesto', text: 'Ahora compara los minutos que hiciste con los que el plan pedía, lista los temas que cerraste y cuenta los pendientes que se te movieron.' },
  { icon: 'clock', title: 'Turno por hora', text: 'Los pendientes con hora de todos tus pacientes, juntos y en orden, con atajos «+30m / +1h / +2h» al capturarlos.' },
  { icon: 'database', title: 'Espacio y revisión', text: 'En Respaldo → «Espacio y revisión»: cuánto llevas usado, qué guías pesan más (con borrado definitivo) y un botón que comprueba que la carpeta compartida de verdad está escribiendo.' },
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
