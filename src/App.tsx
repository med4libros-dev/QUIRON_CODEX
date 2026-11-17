import { Icon } from './components/Icon';
import { Suspense, lazy, useEffect, useState } from 'react';
import { NavRail } from './components/layout/NavRail';
import { SplitPane } from './components/layout/SplitPane';
import { TopBar } from './components/layout/TopBar';
import { InternshipView } from './internship/InternshipView';
import { usePomodoroTicker } from './features/pomodoro/usePomodoroTicker';
import { useSettings } from './store/settings';
import { PearlMenu, Toast } from './features/pearls/PearlMenu';
import { FlashcardModal, FlashcardReview } from './flashcards/FlashcardUI';
import { TopicSheet } from './features/topics/TopicSheet';
import { GuardQuick, TemarioModal } from './features/topics/Temario';
import { SoapModal } from './soap/SoapModal';
import { MiniPlayer } from './features/music/MiniPlayer';
import { SearchModal } from './search/SearchModal';
import { TtsBar } from './components/TtsBar';
import { purgeExpiredShift } from './ward/store';
import { DiagramModal } from './ai/DiagramModal';
import { HlQuizModal } from './ai/HlQuizModal';
import { ClozeModal } from './flashcards/ClozeModal';
import { OcclusionModal } from './flashcards/OcclusionModal';
import { SyncBar } from './features/backup/SyncBar';
import { guardDeck } from './flashcards/FlashcardUI';
import { useCards } from './flashcards/store';
import { onDesktopEvent } from './lib/widgets';
import { onWindowMessage } from './lib/windowSync';
import { useTrash } from './store/trash';
import { ShortcutsModal, WhatsNew } from './home/WhatsNew';
import { PocketApp } from './pocket/PocketApp';
import { startReminders } from './lib/reminders';
import { startAutoFocus } from './lib/autoFocus';
import { startInkOcrAuto } from './lib/inkOcrAuto';
import { setPersistErrorHandler } from './lib/createStore';
import { setNotifyFallback } from './lib/notify';
import { useUI } from './store/ui';

/* Vistas que no se usan al abrir: se cargan la primera vez que entras (arranque más rápido). */
// Estudio (lector de PDF con pdf.js, editor y lienzo) se carga la primera vez que entras: Inicio abre antes.
const PdfWorkspace = lazy(() => import('./features/pdf/PdfWorkspace').then((m) => ({ default: m.PdfWorkspace })));
const NotesPanel = lazy(() => import('./features/notes/NotesPanel').then((m) => ({ default: m.NotesPanel })));
const CompareView = lazy(() => import('./features/pdf/CompareView').then((m) => ({ default: m.CompareView })));
const CalendarView = lazy(() => import('./features/calendar/CalendarView').then((m) => ({ default: m.CalendarView })));
const NotebooksView = lazy(() => import('./features/notebooks/NotebooksView').then((m) => ({ default: m.NotebooksView })));
const ProgressView = lazy(() => import('./features/progress/ProgressView').then((m) => ({ default: m.ProgressView })));
const ExamView = lazy(() => import('./exam/ExamView').then((m) => ({ default: m.ExamView })));
const WardView = lazy(() => import('./ward/WardView').then((m) => ({ default: m.WardView })));
const SummariesView = lazy(() => import('./summaries/SummariesView').then((m) => ({ default: m.SummariesView })));
const HyView = lazy(() => import('./hy/HyView').then((m) => ({ default: m.HyView })));
const LogbookView = lazy(() => import('./logbook/LogbookView').then((m) => ({ default: m.LogbookView })));

/** ¿Toca modo noche ahora? (rango que puede cruzar la medianoche, p. ej. 22→6). */
export function nightActive(mode: 'off' | 'auto' | 'on', from: number, to: number, h = new Date().getHours()): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

function ViewLoading() {
  return <div className="view-loading" aria-busy="true" />;
}

export default function App() {
  const view = useSettings((s) => s.view);
  const theme = useSettings((s) => s.theme);
  const setDark = useSettings((s) => s.setDark);
  const look = useSettings((s) => s.look);
  const night = useSettings((s) => s.night);
  const nightFrom = useSettings((s) => s.nightFrom);
  const nightTo = useSettings((s) => s.nightTo);
  const saver = useSettings((s) => s.saver);

  // Vista guardada que ya no existe (p. ej. la antigua «Fuentes»): vuelve a Inicio.
  useEffect(() => {
    const known = ['internado', 'study', 'notebooks', 'calendar', 'progress', 'hy', 'exam', 'ward', 'logbook', 'summaries'];
    if (!known.includes(view)) useSettings.getState().setView('internado');
  }, [view]);

  // La lista del turno caduca sola, aunque no abras la vista «Turno».
  useEffect(() => {
    purgeExpiredShift();
    const t = setInterval(() => purgeExpiredShift(), 60_000);
    return () => clearInterval(t);
  }, []);

  // Atajos globales: G = Vista de Guardia, ? = lista de atajos (no mientras escribes).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || !t || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (document.querySelector('.modal-backdrop, .compare-overlay')) return;
      if (e.key === '?') {
        e.preventDefault();
        useUI.setState({ shortcutsOpen: true });
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        useUI.getState().setGuardQuickOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Seguridad de datos: avisar si algo no se pudo guardar y si el almacenamiento está casi lleno.
  useEffect(() => {
    let lastWarn = 0;
    setPersistErrorHandler(() => {
      if (Date.now() - lastWarn < 60_000) return;
      lastWarn = Date.now();
      useUI.getState().showToast('No se pudo guardar tu último cambio: el almacenamiento puede estar lleno. Haz un respaldo y borra PDFs que ya no uses.');
    });
    const t = setTimeout(async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        if (!est?.quota || !est.usage) return;
        const pct = est.usage / est.quota;
        const today = new Date().toDateString();
        if (pct > 0.85 && localStorage.getItem('qc:quotaWarned') !== today) {
          localStorage.setItem('qc:quotaWarned', today);
          useUI.getState().showToast(`El almacenamiento está al ${Math.round(pct * 100)}%: haz un respaldo y borra PDFs que ya no uses.`);
        }
      } catch {
        /* no disponible */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Recordatorios del sistema (si están activados en Ajustes).
  useEffect(() => {
    setNotifyFallback((text) => useUI.getState().showToast(text));
    return startReminders();
  }, []);

  // Ahorro de batería: sin fondo animado ni desenfoque fuerte cuando la Surface va con batería.
  useEffect(() => {
    const el = document.documentElement;
    const set = (on: boolean) => {
      if (on) el.dataset.saver = 'on';
      else delete el.dataset.saver;
    };
    if (saver !== 'auto') {
      set(saver === 'on');
      return;
    }
    type Battery = EventTarget & { charging: boolean };
    const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> };
    let bat: Battery | null = null;
    const update = () => set(!!bat && !bat.charging);
    let cancelled = false;
    nav.getBattery?.()
      .then((b) => {
        if (cancelled) return;
        bat = b;
        update();
        b.addEventListener('chargingchange', update);
      })
      .catch(() => set(false));
    if (!nav.getBattery) set(false);
    return () => {
      cancelled = true;
      bat?.removeEventListener('chargingchange', update);
    };
  }, [saver]);

  // Modo noche: se revisa cada minuto por si cambia la hora.
  useEffect(() => {
    const apply = () => {
      const on = nightActive(night, nightFrom, nightTo);
      if (useUI.getState().nightOn !== on) useUI.setState({ nightOn: on });
      if (on) document.documentElement.dataset.night = 'on';
      else delete document.documentElement.dataset.night;
    };
    apply();
    const t = setInterval(apply, 60_000);
    return () => clearInterval(t);
  }, [night, nightFrom, nightTo]);

  useEffect(() => {
    const el = document.documentElement;
    el.dataset.look = look;
    el.dataset.view = view;
  }, [look, view]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      setDark(dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, setDark]);

  /**
   * Atajos del sistema (app de escritorio) y avisos de los widgets: abrir la búsqueda
   * desde cualquier programa o empezar el repaso desde la ventanita.
   */
  useEffect(() => {
    const offs: (() => void)[] = [];
    void onDesktopEvent('qc://search', () => useUI.getState().setSearchOpen(true)).then((off) => offs.push(off));
    offs.push(
      onWindowMessage('open-review', () => {
        const deck = guardDeck(useCards.getState().cards, 10);
        if (deck.length) useUI.getState().startReview({ cardIds: deck, title: 'Repaso', minutes: 10, oneHand: true });
      }),
    );
    return () => offs.forEach((off) => off());
  }, []);

  // Papelera: al abrir, se va lo que ya pasó de 30 días.
  useEffect(() => {
    void useTrash.getState().purgeOld();
  }, []);

  usePomodoroTicker();
  // Cronómetro automático: cuenta el tiempo real leyendo o escribiendo en Estudio y Cuadernos.
  useEffect(startAutoFocus, []);
  // Reconocimiento de la letra en segundo plano (si lo activaste en Preferencias).
  useEffect(startInkOcrAuto, []);
  const [studySeen, setStudySeen] = useState(view === 'study');
  if (view === 'study' && !studySeen) setStudySeen(true);
  const compareOn = useUI((s) => !!s.compare);
  const pocketFull = useSettings((s) => s.pocketFull);
  const phone = useNarrowScreen();
  const focus = useUI((s) => s.focus);
  useEffect(() => {
    const el = document.documentElement;
    if (focus) el.dataset.focus = 'on';
    else delete el.dataset.focus;
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal-backdrop') && useUI.getState().setFocus(false);
    const onFs = () => !document.fullscreenElement && useUI.getState().focus && useUI.getState().setFocus(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [focus]);

  // Teléfono (o el Fold cerrado): se abre en Bolsillo. Al desplegar, la app completa, sin perder nada.
  if (phone && !pocketFull) return <PocketApp />;

  return (
    <div className="app">
      <NavRail />
      <div className="main">
        <TopBar />
        {/* Estudio se mantiene montado: el PDF y la nota no se recargan al ir al calendario. */}
        <div className="view" hidden={view !== 'study'}>
          {studySeen && (
            <Suspense fallback={<ViewLoading />}>
              <SplitPane pdf={<PdfWorkspace />} notes={<NotesPanel />} />
            </Suspense>
          )}
        </div>
        {view === 'internado' && (
          <div className="view scroll">
            <InternshipView />
          </div>
        )}
        {view === 'notebooks' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <NotebooksView />
            </Suspense>
          </div>
        )}
        {view === 'calendar' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <CalendarView />
            </Suspense>
          </div>
        )}
        {view === 'progress' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <ProgressView />
            </Suspense>
          </div>
        )}
        {view === 'hy' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <HyView />
            </Suspense>
          </div>
        )}
        {view === 'exam' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <ExamView />
            </Suspense>
          </div>
        )}
        {view === 'ward' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <WardView />
            </Suspense>
          </div>
        )}
        {view === 'logbook' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <LogbookView />
            </Suspense>
          </div>
        )}
        {view === 'summaries' && (
          <div className="view scroll">
            <Suspense fallback={<ViewLoading />}>
              <SummariesView />
            </Suspense>
          </div>
        )}
      </div>
      <TopicSheet />
      <TemarioModal />
      <GuardQuick />
      <SoapModal />
      <MiniPlayer />
      <SearchModal />
      {compareOn && (
        <Suspense fallback={null}>
          <CompareView />
        </Suspense>
      )}
      <DiagramModal />
      <HlQuizModal />
      <ClozeModal />
      <OcclusionModal />
      <SyncBar />
      <ShortcutsModal />
      <WhatsNew />
      <TtsBar />
      <FlashcardModal />
      <FlashcardReview />
      <PearlMenu />
      <Toast />
      {focus && (
        <button className="focus-exit" onClick={() => useUI.getState().setFocus(false)} title="Salir de pantalla completa (Esc)" aria-label="Salir de pantalla completa">
          <Icon name="minimize" size={15} /> Salir
        </button>
      )}
      <div className="night-veil" aria-hidden="true" />
    </div>
  );
}

/**
 * ¿La pantalla es de teléfono? Se mide en vivo: el Fold pasa de ~344 px cerrado
 * a ~690 px abierto sin recargar, y la app tiene que reacomodarse en el momento.
 */
function useNarrowScreen(max = 560) {
  const [narrow, setNarrow] = useState(() => (typeof window === 'undefined' ? false : window.innerWidth <= max));
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${max}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [max]);
  return narrow;
}
