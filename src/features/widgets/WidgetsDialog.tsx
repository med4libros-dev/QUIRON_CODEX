import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { SHORTCUTS, WIDGETS, closeWidget, openWidget, openWidgets, widgetsAvailable, type WidgetKind } from '../../lib/widgets';
import { useUI } from '../../store/ui';

/**
 * Widgets: ventanitas que se quedan encima de lo que estés haciendo (el PDF de la guía,
 * el expediente, lo que sea). Solo existen en la app de escritorio: en el navegador no hay
 * forma de poner una ventana sobre otra aplicación.
 */
export function WidgetsDialog({ onClose }: { onClose: () => void }) {
  const can = widgetsAvailable();
  const [open, setOpen] = useState<WidgetKind[]>([]);
  const [busy, setBusy] = useState<WidgetKind | null>(null);
  const showToast = useUI((s) => s.showToast);

  const refresh = () => void openWidgets().then(setOpen);
  useEffect(() => {
    if (can) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can]);

  const toggle = async (kind: WidgetKind) => {
    setBusy(kind);
    try {
      if (open.includes(kind)) await closeWidget(kind);
      else await openWidget(kind);
      refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title="Widgets" onClose={onClose} width={540}>
      {!can ? (
        <p className="muted small">
          Los widgets son ventanas que flotan sobre los demás programas, así que solo funcionan en la app de escritorio de Windows.
          En la versión web no hay manera de hacerlo.
        </p>
      ) : (
        <>
          <p className="muted small">
            Cada widget es una ventanita siempre encima. Arrástrala de su barra, ponla donde quieras y ciérrala con su ✕. Comparten
            los mismos datos que la app: lo que captures aparece aquí al instante.
          </p>
          <ul className="wdg-list">
            {WIDGETS.map((w) => (
              <li key={w.kind}>
                <span className="grow">
                  {w.title}
                  <small>{w.hint}</small>
                </span>
                <button className={`btn sm${open.includes(w.kind) ? '' : ' primary'}`} disabled={busy === w.kind} onClick={() => void toggle(w.kind)}>
                  {open.includes(w.kind) ? 'Cerrar' : 'Abrir'}
                </button>
              </li>
            ))}
          </ul>
          <h4>Atajos del sistema</h4>
          <p className="muted small">
            Funcionan aunque la app esté minimizada o estés en otro programa. Son fijos para no chocar con los de Windows.
          </p>
          <ul className="wdg-list">
            <li>
              <span className="grow">
                Captura rápida<small>Una perla, una nota o una flashcard sin abrir la app</small>
              </span>
              <kbd>{SHORTCUTS.capture}</kbd>
            </li>
            <li>
              <span className="grow">
                Buscar<small>Abre la app en la búsqueda (notas, tu letra, perlas, guías)</small>
              </span>
              <kbd>{SHORTCUTS.search}</kbd>
            </li>
            <li>
              <span className="grow">
                Cápsula de estudio<small>Muestra u oculta la cápsula</small>
              </span>
              <kbd>{SHORTCUTS.glance}</kbd>
            </li>
          </ul>
          <p className="muted small">
            <Icon name="shield" size={13} /> Nada de esto sale de tu equipo.
          </p>
        </>
      )}
    </Modal>
  );
}
