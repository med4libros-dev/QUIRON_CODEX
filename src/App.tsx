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

export default function App() {
  const view = useSettings((s) => s.view);
  const theme = useSettings((s) => s.theme);
  const setDark = useSettings((s) => s.setDark);
  const look = useSettings((s) => s.look);

  // Vista guardada que ya no existe (p. ej. la antigua «Fuentes»): vuelve a Inicio.
  useEffect(() => {
    const known = ['internado', 'study', 'notebooks', 'calendar', 'progress', 'hy', 'exam', 'ward'];
    if (!known.includes(view)) useSettings.getState().setView('internado');
  }, [view]);

  // La lista del turno caduca sola, aunque no abras la vista «Turno».
  useEffect(() => {
    purgeExpiredShift();
    const t = setInterval(() => purgeExpiredShift(), 60_000);
    return () => clearInterval(t);
  }, []);

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
      </div>
      <TopicSheet />
      <TemarioModal />
      <GuardQuick />
      <SoapModal />
      <MiniPlayer />
      <SearchModal />
      <TtsBar />
      <FlashcardModal />
      <FlashcardReview />
      <PearlMenu />
      <Toast />
    </div>
  );
}
