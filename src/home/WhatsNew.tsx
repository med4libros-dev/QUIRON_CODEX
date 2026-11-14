import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'battery', title: 'Más batería y arranque más rápido', text: 'Con la Surface desconectada se quita el fondo animado y se suaviza el cristal (Ajustes → Preferencias → Ahorro de batería). Las vistas y la exportación a PDF se cargan solo cuando las usas.' },
  { icon: 'columns', title: 'Surface en vertical', text: 'En modo tableta, Estudio pone el PDF arriba y las notas abajo; el calendario muestra la semana completa.' },
  { icon: 'shield', title: 'Tus datos, más seguros', text: 'El respaldo en la carpeta se verifica al escribirlo y te avisa si falla. Si restauras el archivo equivocado, Respaldo → «Deshacer restauración».' },
  { icon: 'upload', title: 'PDF dañados', text: 'Un archivo dañado o que no es PDF ya no entra a tu biblioteca; te dice cuál fue.' },
  { icon: 'hand', title: 'Más fácil con el dedo y el lápiz', text: 'Botones y casillas más grandes en lo nuevo (huecos, marcadores, tarjetas plegables, menús).' },
  { icon: 'square', title: 'Flashcards de huecos (0.6)', text: 'PDF → menú «⋯» → Flashcards de huecos, o «Huecos» al seleccionar texto. Escondes la palabra clave de tus subrayados.' },
  { icon: 'download', title: 'PDF anotado', text: 'PDF → «⋯» → Exportar PDF anotado: tu guía con resaltados, tinta, post-its y el índice de marcadores.' },
  { icon: 'sparkles', title: 'Tu API key en un solo lugar', text: 'Ajustes → Preferencias → IA. La usan síntesis, simulacros, mnemotecnias, diagramas y preguntas.' },
  { icon: 'cursor', title: 'Atajos', text: 'Pulsa «?» para verlos todos; «G» abre la Vista de Guardia desde cualquier parte.' },
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
