import { useEffect } from 'react';
import { NavRail } from './components/layout/NavRail';
import { SplitPane } from './components/layout/SplitPane';
import { TopBar } from './components/layout/TopBar';
import { CalendarView } from './features/calendar/CalendarView';
import { NotebooksView } from './features/notebooks/NotebooksView';
import { InternshipView } from './internship/InternshipView';
import { NotesPanel } from './features/notes/NotesPanel';
import { PdfWorkspace } from './features/pdf/PdfWorkspace';
import { usePomodoroTicker } from './features/pomodoro/usePomodoroTicker';
import { ProgressView } from './features/progress/ProgressView';
import { useSettings } from './store/settings';
import { PearlMenu, Toast } from './features/pearls/PearlMenu';
import { FlashcardModal, FlashcardReview } from './flashcards/FlashcardUI';
import { TopicSheet } from './features/topics/TopicSheet';
import { GuardQuick, TemarioModal } from './features/topics/Temario';
import { SoapModal } from './soap/SoapModal';
import { MiniPlayer } from './features/music/MiniPlayer';
import { ExamView } from './exam/ExamView';
import { WardView } from './ward/WardView';
import { SearchModal } from './search/SearchModal';
import { TtsBar } from './components/TtsBar';
import { purgeExpiredShift } from './ward/store';
import { HyView } from './hy/HyView';
import { LogbookView } from './logbook/LogbookView';
import { CompareView } from './features/pdf/CompareView';
import { DiagramModal } from './ai/DiagramModal';
import { HlQuizModal } from './ai/HlQuizModal';
import { ClozeModal } from './flashcards/ClozeModal';
import { ShortcutsModal, WhatsNew } from './home/WhatsNew';
import { startReminders } from './lib/reminders';
import { setNotifyFallback } from './lib/notify';
import { useUI } from './store/ui';

/** ¿Toca modo noche ahora? (rango que puede cruzar la medianoche, p. ej. 22→6). */
export function nightActive(mode: 'off' | 'auto' | 'on', from: number, to: number, h = new Date().getHours()): boolean {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  if (from === to) return false;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

export default function App() {
  const view = useSettings((s) => s.view);
  const theme = useSettings((s) => s.theme);
  const setDark = useSettings((s) => s.setDark);
  const look = useSettings((s) => s.look);
  const night = useSettings((s) => s.night);
  const nightFrom = useSettings((s) => s.nightFrom);
  const nightTo = useSettings((s) => s.nightTo);

  // Vista guardada que ya no existe (p. ej. la antigua «Fuentes»): vuelve a Inicio.
  useEffect(() => {
    const known = ['internado', 'study', 'notebooks', 'calendar', 'progress', 'hy', 'exam', 'ward', 'logbook'];
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

  // Recordatorios del sistema (si están activados en Ajustes).
  useEffect(() => {
    setNotifyFallback((text) => useUI.getState().showToast(text));
    return startReminders();
  }, []);

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

  usePomodoroTicker();

  return (
    <div className="app">
      <NavRail />
      <div className="main">
        <TopBar />
        {/* Estudio se mantiene montado: el PDF y la nota no se recargan al ir al calendario. */}
        <div className="view" hidden={view !== 'study'}>
          <SplitPane pdf={<PdfWorkspace />} notes={<NotesPanel />} />
        </div>
        {view === 'internado' && (
          <div className="view scroll">
            <InternshipView />
          </div>
        )}
        {view === 'notebooks' && (
          <div className="view scroll">
            <NotebooksView />
          </div>
        )}
        {view === 'calendar' && (
          <div className="view scroll">
            <CalendarView />
          </div>
        )}
        {view === 'progress' && (
          <div className="view scroll">
            <ProgressView />
          </div>
        )}
        {view === 'hy' && (
          <div className="view scroll">
            <HyView />
          </div>
        )}
        {view === 'exam' && (
          <div className="view scroll">
            <ExamView />
          </div>
        )}
        {view === 'ward' && (
          <div className="view scroll">
            <WardView />
          </div>
        )}
        {view === 'logbook' && (
          <div className="view scroll">
            <LogbookView />
          </div>
        )}
      </div>
      <TopicSheet />
      <TemarioModal />
      <GuardQuick />
      <SoapModal />
      <MiniPlayer />
      <SearchModal />
      <CompareView />
      <DiagramModal />
      <HlQuizModal />
      <ClozeModal />
      <ShortcutsModal />
      <WhatsNew />
      <TtsBar />
      <FlashcardModal />
      <FlashcardReview />
      <PearlMenu />
      <Toast />
      <div className="night-veil" aria-hidden="true" />
    </div>
  );
}
