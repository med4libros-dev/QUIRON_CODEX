import { Pomodoro } from '../../features/pomodoro/Pomodoro';
import { LayoutControls } from './LayoutControls';
import { useLibrary } from '../../store/library';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { Icon } from '../Icon';
import emblem from '../../assets/quiron-emblem.png';
import type { View } from '../../types';

const TITLES: Record<View, string> = { internado: 'Inicio', study: 'Estudio', notebooks: 'Cuadernos', calendar: 'Calendario', progress: 'Progreso', sources: 'Fuentes · NotebookLM', hy: 'Perlas HY' };

export function TopBar() {
  const view = useSettings((s) => s.view);
  const activeDocId = useSettings((s) => s.activeDocId);
  const drawer = useUI((s) => s.sourcesDrawer);
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
      <button
        className={`btn ghost sm nlm-btn${drawer ? ' active' : ''}`}
        onClick={() => useUI.getState().setSourcesDrawer(!drawer)}
        aria-pressed={drawer}
        title="NotebookLM: accesos directos a tus fuentes y captura de fragmentos"
      >
        <Icon name="link" size={15} /> <span className="hide-narrow">NotebookLM</span>
      </button>
      <Pomodoro />
    </header>
  );
}
