import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';
import emblem from '../../assets/quiron-emblem.png';
import { BackupDialog } from '../../features/backup/BackupDialog';
import { TrashDialog } from '../../features/trash/TrashDialog';
import { WidgetsDialog } from '../../features/widgets/WidgetsDialog';
import { guardDeck } from '../../flashcards/FlashcardUI';
import { useCards } from '../../flashcards/store';
import { useTrash } from '../../store/trash';
import { PrefsDialog } from '../../features/prefs/PrefsDialog';
import { backupError, folderStatus } from '../../lib/backup';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import type { Theme, View } from '../../types';

const ITEMS: { view: View; icon: IconName; label: string }[] = [
  { view: 'internado', icon: 'home', label: 'Inicio' },
  { view: 'study', icon: 'book', label: 'Estudio' },
  { view: 'summaries', icon: 'layers', label: 'Resúmenes' },
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
  const [backupOpen, setBackupOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const trashCount = useTrash((s) => s.items.length);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [menu, setMenu] = useState<{ id: Menu; top: number }>({ id: null, top: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  const [failed, setFailed] = useState(() => !!backupError());
  useEffect(() => {
    folderStatus()
      .then((s) => setNeedsReconnect(s === 'prompt'))
      .catch(() => undefined);
    setFailed(!!backupError());
  }, [backupOpen]);
  useEffect(() => {
    const on = () => setFailed(!!backupError());
    window.addEventListener('qc:backup', on);
    return () => window.removeEventListener('qc:backup', on);
  }, []);
  const backupAlert = needsReconnect || failed;
  const backupHint = failed ? 'El respaldo automático falló' : 'Reconecta tu carpeta';

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
        title={backupAlert ? `Ajustes · Respaldo: ${backupHint.toLowerCase()}` : 'Ajustes: respaldo, preferencias, tema y estilo'}
      >
        <Icon name="settings" size={20} />
        <span>Ajustes</span>
        {backupAlert && <i className="rail-dot" />}
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
                <button
                  role="menuitem"
                  onClick={run(() => {
                    const deck = guardDeck(useCards.getState().cards, 10);
                    if (!deck.length) return useUI.getState().showToast('Todavía no tienes flashcards que repasar.');
                    useUI.getState().startReview({ cardIds: deck, title: 'Repaso de guardia', minutes: 10, oneHand: true });
                  })}
                  title="Repaso corto de pie: 10 minutos, botones grandes, con una mano"
                >
                  <Icon name="cards" size={17} />
                  <span>
                    Repaso de guardia <small>10 min, con una mano</small>
                  </span>
                </button>
                <button role="menuitem" onClick={run(() => setWidgetsOpen(true))} title="Ventanitas siempre encima: cápsula de estudio, pendientes, repaso y captura rápida">
                  <Icon name="layers" size={17} />
                  <span>
                    Widgets <small>Ventanitas siempre encima</small>
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
                <button role="menuitem" onClick={run(() => setBackupOpen(true))} title={backupAlert ? `Respaldo: ${backupHint.toLowerCase()}` : 'Respaldo de tu progreso'}>
                  <Icon name="upload" size={17} />
                  <span>
                    Respaldo <small>{backupAlert ? backupHint : 'Carpeta, archivo y cifrado'}</small>
                  </span>
                  {backupAlert && <i className="rail-dot" />}
                </button>
                <button role="menuitem" onClick={run(() => setTrashOpen(true))} title="Lo que borraste en los últimos 30 días">
                  <Icon name="trash" size={17} />
                  <span>
                    Papelera <small>{trashCount ? `${trashCount} elemento${trashCount === 1 ? '' : 's'} · 30 días` : 'Vacía'}</small>
                  </span>
                </button>
                <button role="menuitem" onClick={run(() => setPrefsOpen(true))} title="Modo noche, recordatorios e IA">
                  <Icon name="bell" size={17} />
                  <span>
                    Preferencias <small>Noche, avisos e IA</small>
                  </span>
                </button>
                <div className="rail-pop-sep" />
                <button role="menuitem" onClick={() => setTheme(NEXT[theme])} title={`Tema: ${THEME_LABEL[theme]} (clic para cambiar)`}>
                  <Icon name={THEME_ICON[theme]} size={17} />
                  <span>
                    Tema: {THEME_LABEL[theme]}
                  </span>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
      {backupOpen && <BackupDialog onClose={() => setBackupOpen(false)} />}
      {trashOpen && <TrashDialog onClose={() => setTrashOpen(false)} />}
      {widgetsOpen && <WidgetsDialog onClose={() => setWidgetsOpen(false)} />}
      {prefsOpen && <PrefsDialog onClose={() => setPrefsOpen(false)} />}
    </nav>
  );
}
