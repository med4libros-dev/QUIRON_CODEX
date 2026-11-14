import { setTtsRate, skipTts, stopTts, togglePauseTts, useTts } from '../lib/tts';
import { Icon } from './Icon';

/** Barra flotante mientras se lee en voz alta. */
export function TtsBar() {
  const s = useTts((x) => x);
  if (!s.speaking) return null;
  const it = s.queue[s.index];
  return (
    <div className="tts-bar" role="status" aria-label="Lectura en voz alta">
      <Icon name="speaker" size={16} />
      <div className="tts-meta">
        <b className="ellipsis">{it?.title || s.label}</b>
        <span className="muted small">
          {s.index + 1} de {s.queue.length}
        </span>
      </div>
      <button className="mp-btn sm" onClick={() => skipTts(-1)} aria-label="Anterior">
        <Icon name="skipBack" size={14} />
      </button>
      <button className="mp-btn sm" onClick={togglePauseTts} aria-label={s.paused ? 'Continuar' : 'Pausa'}>
        <Icon name={s.paused ? 'play' : 'pause'} size={14} />
      </button>
      <button className="mp-btn sm" onClick={() => skipTts(1)} aria-label="Siguiente">
        <Icon name="skip" size={14} />
      </button>
      <select className="select xs" value={s.rate} onChange={(e) => setTtsRate(Number(e.target.value))} aria-label="Velocidad">
        {[0.8, 1, 1.15, 1.3, 1.5].map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
      <button className="mp-btn sm" onClick={stopTts} aria-label="Detener lectura">
        <Icon name="stop" size={14} />
      </button>
    </div>
  );
}
