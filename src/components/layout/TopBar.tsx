import { Pomodoro } from '../../features/pomodoro/Pomodoro';
import { LayoutControls } from './LayoutControls';
import { useLibrary } from '../../store/library';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { Icon } from '../Icon';
import { useStudyToday } from '../../lib/autoFocus';
import emblem from '../../assets/quiron-emblem.png';
import type { View } from '../../types';

/** Reloj de estudio de hoy: corre solo mientras lees o escribes. */
function StudyClock() {
  const { minutes, partial, counting } = useStudyToday();
  if (!minutes && !counting) return null;
  const h = Math.floor(minutes / 60);
  const label = h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
  return (
    <button
      className={`study-clock${counting ? ' on' : ''}`}
      onClick={() => useSettings.getState().setView('progress')}
      title={counting ? `Contando tu estudio de hoy (${partial}s del minuto en curso). Se detiene solo a los 2 min sin actividad.` : 'Estudio registrado hoy. Abre Progreso para ver el detalle.'}
    >
      <Icon name="clock" size={14} /> {label}
    </button>
  );
}

const TITLES: Record<View, string> = { internado: 'Inicio', study: 'Estudio', notebooks: 'Cuadernos', calendar: 'Calendario', progress: 'Progreso', hy: 'Perlas HY', exam: 'Simulacros', ward: 'Turno', logbook: 'Bitácora' };

export function TopBar() {
  const view = useSettings((s) => s.view);
  const activeDocId = useSettings((s) => s.activeDocId);
  const docName = useLibrary((s) => s.docs.find((d) => d.id === activeDocId)?.name);
  const nightOn = useUI((s) => s.nightOn);

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
      <StudyClock />
      {view === 'study' && <LayoutControls />}
      {nightOn && (
        <button className="night-chip" onClick={() => useSettings.getState().setNight('off')} title="Modo noche activo: toca para apagarlo (Ajustes → Preferencias)" aria-label="Apagar modo noche">
          <Icon name="moon" size={14} /> <span className="hide-narrow">Noche</span>
        </button>
      )}
      <button className="btn ghost sm search-btn" onClick={() => useUI.getState().setSearchOpen(true)} title="Buscar en todo (Ctrl+K)" aria-label="Buscar en todo">
        <Icon name="search" size={15} /> <span className="hide-narrow">Buscar</span> <kbd className="hide-narrow">Ctrl K</kbd>
      </button>
      <Pomodoro />
    </header>
  );
}
