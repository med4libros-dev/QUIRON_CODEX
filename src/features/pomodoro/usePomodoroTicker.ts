import { useEffect } from 'react';
import { chime, notify } from '../../lib/sound';
import { usePomodoro } from '../../store/pomodoro';

/** Un único reloj global: detecta el fin de fase aunque el Pomodoro no esté visible. */
export function usePomodoroTicker() {
  useEffect(() => {
    const t = setInterval(() => {
      const s = usePomodoro.getState();
      if (s.running && s.endAt && Date.now() >= s.endAt) {
        const wasFocus = s.phase === 'focus';
        s.complete();
        chime();
        notify(wasFocus ? 'Pomodoro completado. Toma un descanso.' : 'Descanso terminado. De vuelta al estudio.');
      }
    }, 500);
    return () => clearInterval(t);
  }, []);
}
