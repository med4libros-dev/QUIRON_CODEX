import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../Icon';
import emblem from '../../assets/quiron-emblem.png';
import { BackupDialog } from '../../features/backup/BackupDialog';
import { PrefsDialog } from '../../features/prefs/PrefsDialog';
import { folderStatus } from '../../lib/backup';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import type { Theme, View } from '../../types';

const ITEMS: { view: View; icon: IconName; label: string }[] = [
  { view: 'internado', icon: 'home', label: 'Inicio' },
  { view: 'study', icon: 'book', label: 'Estudio' },
  { view: 'notebooks', icon: 'notebook', label: 'Cuadernos' },
  { view: 'calendar', icon: 'calendar', label: 'Calendario' },
  { view: 'progress', icon: 'chart', label: 'Progreso' },
  { view: 'hy', icon: 'star', label: 'Perlas HY' },
  { view: 'exam', icon: 'target', label: 'Simulacros' },
  { view: 'ward', icon: 'bed', label: 'Turno' },
  { view: 'logbook', icon: 'journal', label: 'Bitácora' },
];

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON: Record<Theme, IconName> = { light: 'sun', dark: 'moon', system: 'monitor' };
const THEME_LABEL: Record<Theme, string> = { light: 'Claro', dark: 'Oscuro', system: 'Automático' };

export function NavRail() {
  const view = useSettings((s) => s.view);
  const setView = useSettings((s) => s.setView);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const look = useSettings((s) => s.look);
  const setLook = useSettings((s) => s.setLook);
  const [backupOpen, setBackupOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);

  useEffect(() => {
    folderStatus()
      .then((s) => setNeedsReconnect(s === 'prompt'))
      .catch(() => undefined);
  }, [backupOpen]);

  return (
    <nav className="rail" aria-label="Secciones">
      <div className="rail-logo" title="Quirón Codex">
        <img src={emblem} alt="Quirón Codex" draggable={false} />
      </div>
      {ITEMS.map((it) => (
        <button
          key={it.view}
          className={`rail-btn${view === it.view ? ' active' : ''}`}
          onClick={() => setView(it.view)}
          aria-current={view === it.view ? 'page' : undefined}
        >
          <Icon name={it.icon} size={20} />
          <span>{it.label}</span>
        </button>
      ))}
      <button className="rail-btn guard-btn" onClick={() => useUI.getState().setTemarioOpen(true)} title="GPC y temario: sube tu GRR/GER o búscala en sitios oficiales">
        <Icon name="list" size={20} />
        <span>GPC</span>
      </button>
      <button className="rail-btn" onClick={() => useUI.getState().setGuardQuickOpen(true)} title="Vista de Guardia: fichas de bolsillo y calculadoras (G)">
        <Icon name="shield" size={20} />
        <span>Guardia</span>
      </button>
      <button className="rail-btn" onClick={() => useUI.getState().setSoapOpen(true)} title="Generador de notas médicas: evolución (SOAP), ingreso, postquirúrgica, egreso">
        <Icon name="clipboard" size={20} />
        <span>Nota SOAP</span>
      </button>
      <div className="spacer" />
      <button
        className="rail-btn"
        onClick={() => setBackupOpen(true)}
        title={needsReconnect ? 'Respaldo: reconecta tu carpeta para seguir guardando' : 'Respaldo de tu progreso'}
      >
        <Icon name="settings" size={20} />
        <span>Respaldo</span>
        {needsReconnect && <i className="rail-dot" />}
      </button>
      <button className="rail-btn" onClick={() => setPrefsOpen(true)} title="Ajustes: modo noche y recordatorios">
        <Icon name="bell" size={20} />
        <span>Ajustes</span>
      </button>
      <button
        className="rail-btn"
        onClick={() => setTheme(NEXT[theme])}
        title={`Tema: ${THEME_LABEL[theme]} (clic para cambiar)`}
      >
        <Icon name={THEME_ICON[theme]} size={20} />
        <span>{THEME_LABEL[theme]}</span>
      </button>
      <button
        className="rail-btn"
        onClick={() => setLook(look === 'glass' ? 'pistache' : 'glass')}
        title={`Estilo: ${look === 'glass' ? 'Cristal líquido' : 'Pistache (mate)'} (clic para cambiar)`}
      >
        <Icon name="drop" size={20} />
        <span>{look === 'glass' ? 'Cristal' : 'Mate'}</span>
      </button>
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}
      {prefsOpen && <PrefsDialog onClose={() => setPrefsOpen(false)} />}
    </nav>
  );
}
