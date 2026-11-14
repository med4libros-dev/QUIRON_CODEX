import { Pomodoro } from '../../features/pomodoro/Pomodoro';
import { LayoutControls } from './LayoutControls';
import { useLibrary } from '../../store/library';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { Icon } from '../Icon';
import emblem from '../../assets/quiron-emblem.png';
import type { View } from '../../types';

const TITLES: Record<View, string> = { internado: 'Inicio', study: 'Estudio', notebooks: 'Cuadernos', calendar: 'Calendario', progress: 'Progreso', hy: 'Perlas HY', exam: 'Simulacros', ward: 'Turno', logbook: 'Bitácora' };

export function TopBar() {
  const view = useSettings((s) => s.view);
  const activeDocId = useSettings((s) => s.activeDocId);
  const docName = useLibrary((s) => s.docs.find((d) => d.id === activeDocId)?.name);

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="brand hide-narrow">
          <img src={emblem} alt="" aria-hidden draggable={false} />
          Quirón Codex
        </span>
        <span className="crumb-sep hide-narrow">/</span>
        <span className="view-title">{TITLES[view]}</span>
        {view === 'study' && docName && (
          <>
            <span className="crumb-sep">/</span>
            <span className="muted ellipsis">{docName}</span>
          </>
        )}
      </div>
      {view === 'study' && <LayoutControls />}
      <button className="btn ghost sm search-btn" onClick={() => useUI.getState().setSearchOpen(true)} title="Buscar en todo (Ctrl+K)" aria-label="Buscar en todo">
        <Icon name="search" size={15} /> <span className="hide-narrow">Buscar</span> <kbd className="hide-narrow">Ctrl K</kbd>
      </button>
      <Pomodoro />
    </header>
  );
}
