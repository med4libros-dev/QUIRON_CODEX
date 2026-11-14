import { useState } from 'react';
import { Icon } from './Icon';

/** Tarjetas plegables de Inicio: el estado se recuerda en este equipo. */
const KEY = 'qc:folds';
const read = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
};

export function useFold(id: string, defaultOpen = true): [boolean, () => void] {
  const [open, setOpen] = useState(() => read()[id] ?? defaultOpen);
  const toggle = () =>
    setOpen((o) => {
      const all = read();
      all[id] = !o;
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch {
        /* sin almacenamiento */
      }
      return !o;
    });
  return [open, toggle];
}

export function FoldBtn({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button className={`fold-btn${open ? ' open' : ''}`} onClick={onToggle} aria-expanded={open} aria-label={open ? `Plegar ${label}` : `Mostrar ${label}`} title={open ? 'Plegar' : 'Mostrar'}>
      <Icon name="chevronRight" size={14} />
    </button>
  );
}
