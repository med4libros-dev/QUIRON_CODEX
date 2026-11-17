import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'layers', title: 'Tus ultrarresúmenes, dentro de la app', text: 'Le apuntas una vez a la carpeta donde los guardas y quedan a mano en «Resúmenes». No se copian a ningún lado: siguen siendo tus archivos, se leen de ahí cuando abres uno.' },
  { icon: 'search', title: 'Se reconocen solos', text: 'De cada PDF lee solo la primera página, saca el título de verdad —no el nombre del archivo, que suele ser «Med Interna 7»— y lo empareja con tu temario. Lo que atina queda fijo; lo dudoso te lo marca para que lo confirmes de un toque.' },
  { icon: 'book', title: 'Aparecen en la ficha del tema', text: 'Cuando abres un tema del temario, sus resúmenes están ahí, junto a tus PDFs. Se abren en el mismo lector, con resaltado, lápiz y notas de siempre.' },
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
