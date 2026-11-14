import { Icon } from './Icon';

/** Etiqueta «me lo preguntaron» (examen real, adscrito, pase de visita): se repasa con prioridad. */
export function AskedToggle({ on, onToggle, label = false }: { on: boolean; onToggle: () => void; label?: boolean }) {
  return (
    <button
      className={`asked-btn${on ? ' on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={on}
      aria-label="Me lo preguntaron"
      title={on ? 'Me lo preguntaron (clic para quitar)' : 'Marcar «me lo preguntaron»: se repasa con prioridad'}
    >
      <Icon name="mic" size={13} />
      {(label || on) && <span>Me lo preguntaron</span>}
    </button>
  );
}
