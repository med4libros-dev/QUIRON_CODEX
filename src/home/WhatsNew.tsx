import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'pencil', title: 'Buscar en lo que escribiste a mano', text: 'En la nota, menú «⋯» → Reconocer mi letra: transcribe tus hojas con la IA que elegiste. Después Ctrl+K encuentra lo que anotaste con el lápiz, y puedes pasar la hoja a texto editable.' },
  { icon: 'search', title: 'Ctrl+F dentro de la guía', text: 'Busca una palabra en el PDF abierto, salta de coincidencia en coincidencia y las marca sobre la página.' },
  { icon: 'columns', title: 'Pestañas y márgenes', text: 'Varias guías abiertas a la vez en pestañas; el botón de márgenes recorta el borde blanco para aprovechar la pantalla. En Marcadores ahora también está el índice que trae el propio PDF.' },
  { icon: 'eye', title: 'Tapar para repasar', text: 'Recorta un esquema y tapa sus etiquetas: sale una tarjeta por cada una. Y en hojas Cornell o de dos columnas, «Tapar y repasar» cubre la columna izquierda.' },
  { icon: 'highlighter', title: 'Todos los resaltados de un tema', text: 'En la ficha del tema, pestaña «Resaltados»: todo lo que marcaste en sus guías, en una hoja, con su página y filtrable por color.' },
  { icon: 'trash', title: 'Papelera de 30 días e historial', text: 'Lo que borres (notas, guías, hojas) se puede recuperar 30 días desde Ajustes → Papelera. Cada nota guarda además versiones anteriores de su texto.' },
  { icon: 'tag', title: 'Etiquetas y dictado', text: 'Pon etiquetas a tus notas y fíltralas en Cuadernos. Y si traes las manos ocupadas, dicta a la nota por voz.' },
  { icon: 'swap', title: 'Surface y PC al día', text: 'Si la otra computadora dejó avance más nuevo en la carpeta compartida, la app te ofrece traerlo al abrir. Y en Respaldo → «Llevarlo a otro lado» sacas un paquete para repasar en el celular y el plan en .ics para tu calendario.' },
  { icon: 'notebook', title: 'Cuaderno completo a PDF', text: 'Desde el menú «⋯» de la nota: todas las notas del cuaderno en un PDF con índice.' },
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
