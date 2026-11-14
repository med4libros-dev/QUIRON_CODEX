import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { createPortal } from 'react-dom';
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

type Menu = 'tools' | 'prefs' | null;

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
  const [menu, setMenu] = useState<{ id: Menu; top: number }>({ id: null, top: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    folderStatus()
      .then((s) => setNeedsReconnect(s === 'prompt'))
      .catch(() => undefined);
  }, [backupOpen]);

  // El menú se cierra al tocar fuera o con Esc.
  useEffect(() => {
    if (!menu.id) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!popRef.current?.contains(t) && !t.closest('[data-rail-menu]')) setMenu({ id: null, top: 0 });
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu({ id: null, top: 0 });
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu.id]);

  const toggleMenu = (id: Menu) => (e: RMouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu((m) => (m.id === id ? { id: null, top: 0 } : { id, top: r.top }));
  };
  const run = (fn: () => void) => () => {
    setMenu({ id: null, top: 0 });
    fn();
  };

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
      <button
        className={`rail-btn guard-btn${menu.id === 'tools' ? ' open' : ''}`}
        data-rail-menu
        onClick={toggleMenu('tools')}
        aria-haspopup="menu"
        aria-expanded={menu.id === 'tools'}
        title="Herramientas: GPC y temario, Vista de Guardia, Nota SOAP"
      >
        <Icon name="shield" size={20} />
        <span>Herramientas</span>
      </button>
      <div className="spacer" />
      <button
        className={`rail-btn${menu.id === 'prefs' ? ' open' : ''}`}
        data-rail-menu
        onClick={toggleMenu('prefs')}
        aria-haspopup="menu"
        aria-expanded={menu.id === 'prefs'}
        title={needsReconnect ? 'Ajustes · Respaldo: reconecta tu carpeta para seguir guardando' : 'Ajustes: respaldo, noche y recordatorios, tema y estilo'}
      >
        <Icon name="settings" size={20} />
        <span>Ajustes</span>
        {needsReconnect && <i className="rail-dot" />}
      </button>

      {menu.id &&
        createPortal(
          <div className="rail-pop" role="menu" ref={popRef} style={{ top: Math.min(menu.top, window.innerHeight - (menu.id === 'tools' ? 190 : 250)) }}>
            {menu.id === 'tools' ? (
              <>
                <button role="menuitem" onClick={run(() => useUI.getState().setTemarioOpen(true))} title="GPC y temario: sube tu GRR/GER o búscala en sitios oficiales">
                  <Icon name="list" size={17} />
                  <span>
                    GPC <small>Temario, mapa y guías</small>
                  </span>
                </button>
                <button role="menuitem" onClick={run(() => useUI.getState().setGuardQuickOpen(true))} title="Vista de Guardia: fichas de bolsillo y calculadoras (G)">
                  <Icon name="shield" size={17} />
                  <span>
                    Guardia <small>Fichas, fármacos, signos vitales</small>
                  </span>
                </button>
                <button role="menuitem" onClick={run(() => useUI.getState().setSoapOpen(true))} title="Generador de notas médicas: evolución (SOAP), ingreso, postquirúrgica, egreso">
                  <Icon name="clipboard" size={17} />
                  <span>
                    Nota SOAP <small>Evolución, ingreso, egreso</small>
                  </span>
                </button>
              </>
            ) : (
              <>
                <button role="menuitem" onClick={run(() => setBackupOpen(true))} title={needsReconnect ? 'Respaldo: reconecta tu carpeta para seguir guardando' : 'Respaldo de tu progreso'}>
                  <Icon name="upload" size={17} />
                  <span>
                    Respaldo <small>{needsReconnect ? 'Reconecta tu carpeta' : 'Carpeta, archivo y cifrado'}</small>
                  </span>
                  {needsReconnect && <i className="rail-dot" />}
                </button>
                <button role="menuitem" onClick={run(() => setPrefsOpen(true))} title="Modo noche y recordatorios">
                  <Icon name="bell" size={17} />
                  <span>
                    Noche y avisos <small>Modo noche, recordatorios</small>
                  </span>
                </button>
                <div className="rail-pop-sep" />
                <button role="menuitem" onClick={() => setTheme(NEXT[theme])} title={`Tema: ${THEME_LABEL[theme]} (clic para cambiar)`}>
                  <Icon name={THEME_ICON[theme]} size={17} />
                  <span>
                    Tema: {THEME_LABEL[theme]}
                  </span>
                </button>
                <button role="menuitem" onClick={() => setLook(look === 'glass' ? 'pistache' : 'glass')} title={`Estilo: ${look === 'glass' ? 'Cristal líquido' : 'Pistache (mate)'} (clic para cambiar)`}>
                  <Icon name="drop" size={17} />
                  <span>Estilo: {look === 'glass' ? 'Cristal' : 'Mate'}</span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}
      {prefsOpen && <PrefsDialog onClose={() => setPrefsOpen(false)} />}
    </nav>
  );
}
