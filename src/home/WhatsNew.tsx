import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useInternship } from '../internship/store';
import { useUI } from '../store/ui';
import { APP_VERSION } from '../version';

const SEEN = 'qc:seenVersion';

const NEWS: { icon: Parameters<typeof Icon>[0]['name']; title: string; text: string }[] = [
  { icon: 'lasso', title: 'Lo que encierras con el lazo, leído', text: 'Encierra un párrafo escrito a mano y el botón «Aa» lo pasa a texto, a fórmula o a flashcard. Transcribe solo ese recorte, no la hoja entera, y lo puedes corregir antes de llevártelo.' },
  { icon: 'columns', title: 'Margen de notas junto al PDF', text: 'En la barra del lector: una franja en blanco a la derecha de la guía para escribir sin encimar el texto. Dos tamaños (30 % y 60 %). Lo que ya habías anotado no se mueve.' },
  { icon: 'layers', title: 'Miniaturas, tamaños de hoja y rollo', text: 'Columna de miniaturas al lado del lienzo para saber dónde vas; A4, carta, apaisada o rollo continuo; y una imagen tuya de fondo fijo (una lámina, un formato del hospital) para escribir encima.' },
  { icon: 'mic', title: 'Grabar la clase y volver a ella', text: 'Mientras grabas, cada trazo guarda su minuto. Después, «Tocar para saltar» y un toque en el apunte te lleva al momento en que lo escribiste. Para clases y seminarios, no para pacientes. El audio no sale de tu equipo ni entra en los respaldos.' },
  { icon: 'target', title: 'Examen largo', text: 'Varios bloques cronometrados seguidos, con descanso entre ellos, para ensayar la jornada completa y no solo un bloque suelto. Los números los pones tú.' },
  { icon: 'swap', title: 'Dos cosas que ahora pasan solas', text: 'En Preferencias puedes encender que tu letra se transcriba en segundo plano (entra sola al buscador) y que lo que deje tu otra computadora se traiga sin preguntar, siempre que aquí no haya cambios sin respaldar.' },
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
