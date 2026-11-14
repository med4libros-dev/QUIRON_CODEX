import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { useUI } from '../../store/ui';
import {
  ACCEPTED_LABEL,
  canPickDirectory,
  checkRemembered,
  fmtTime,
  loadFromInput,
  next,
  pickDirectory,
  playAt,
  prev,
  reopenRemembered,
  seek,
  setVolume,
  toggle,
  toggleMute,
  useMusic,
} from './store';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mini reproductor flotante (cristal líquido). Colapsado es una píldora con la canción actual;
 * expandido muestra controles, progreso, volumen y la lista de la carpeta.
 */
export function MiniPlayer() {
  const s = useMusic((x) => x);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showList, setShowList] = useState(false);
  const [q, setQ] = useState('');
  const [dragT, setDragT] = useState<number | null>(null);
  const track = s.tracks[s.index];

  useEffect(() => {
    void checkRemembered();
  }, []);

  const filtered = useMemo(() => {
    const n = norm(q.trim());
    return s.tracks.map((t, i) => ({ t, i })).filter(({ t }) => !n || norm(t.path).includes(n));
  }, [s.tracks, q]);

  const choose = async () => {
    if (canPickDirectory()) {
      try {
        const n = await pickDirectory();
        if (n) useUI.getState().showToast(`${n} canciones cargadas`);
      } catch (e) {
        // Cancelado por el usuario: nada que hacer. Otro error → se ofrece el selector clásico.
        if ((e as { name?: string }).name !== 'AbortError') inputRef.current?.click();
      }
    } else inputRef.current?.click();
  };

  const reopen = async () => {
    try {
      const n = await reopenRemembered();
      if (n) useUI.getState().showToast(`${n} canciones de «${s.canReopen}»`);
    } catch {
      useMusic.setState({ canReopen: null });
      void choose();
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      hidden
      multiple
      accept="audio/*,.mp3,.wav,.flac,.ogg"
      // webkitdirectory no está en los tipos de React: se pasa como atributo.
      {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      onChange={(e) => {
        const files = e.target.files;
        if (files?.length) {
          const n = loadFromInput(files);
          if (n) useUI.getState().showToast(`${n} canciones cargadas`);
        }
        e.target.value = '';
      }}
      data-testid="music-input"
    />
  );

  if (!s.expanded)
    return (
      <div className={`mini-player pill${s.playing ? ' playing' : ''}`}>
        {input}
        <button className="mp-orb" onClick={() => useMusic.setState({ expanded: true })} aria-label="Abrir reproductor de música" title="Música">
          {s.playing ? (
            <span className="mp-eq" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <Icon name="music" size={18} />
          )}
        </button>
        {track && (
          <>
            <button className="mp-pill-title ellipsis" onClick={() => useMusic.setState({ expanded: true })}>
              {track.name}
            </button>
            <button className="mp-btn sm" onClick={toggle} aria-label={s.playing ? 'Pausa' : 'Reproducir'}>
              <Icon name={s.playing ? 'pause' : 'play'} size={15} />
            </button>
            <button className="mp-btn sm" onClick={next} aria-label="Siguiente">
              <Icon name="skip" size={15} />
            </button>
          </>
        )}
      </div>
    );

  const t = dragT ?? s.time;
  const pct = s.duration ? (t / s.duration) * 100 : 0;
  return (
    <section className="mini-player open" aria-label="Reproductor de música">
      {input}
      <header className="mp-head">
        <div className="mp-art" aria-hidden>
          {s.playing ? (
            <span className="mp-eq big">
              <i />
              <i />
              <i />
            </span>
          ) : (
            <Icon name="music" size={20} />
          )}
        </div>
        <div className="mp-meta">
          <b className="ellipsis">{track ? track.name : 'Sin música'}</b>
          <span className="muted small ellipsis">{track ? `${s.folder} · ${s.index + 1} de ${s.tracks.length}` : `Carga una carpeta (${ACCEPTED_LABEL})`}</span>
        </div>
        <button className="mp-btn sm" onClick={() => useMusic.setState({ expanded: false })} aria-label="Minimizar reproductor" title="Minimizar">
          <Icon name="minimize" size={15} />
        </button>
      </header>

      {s.error && <p className="mp-error small">{s.error}</p>}

      {s.tracks.length > 0 && (
        <>
          <div className="mp-progress">
            <span className="tabular small">{fmtTime(t)}</span>
            <input
              type="range"
              min={0}
              max={s.duration || 0}
              step={0.1}
              value={Math.min(t, s.duration || 0)}
              style={{ '--pct': `${pct}%` } as CSSProperties}
              onChange={(e) => setDragT(Number(e.target.value))}
              onPointerUp={(e) => {
                seek(Number((e.target as HTMLInputElement).value));
                setDragT(null);
              }}
              onKeyUp={(e) => {
                seek(Number((e.target as HTMLInputElement).value));
                setDragT(null);
              }}
              aria-label="Progreso de la canción"
              disabled={!s.duration}
            />
            <span className="tabular small">{fmtTime(s.duration)}</span>
          </div>
          <div className="mp-controls">
            <button className={`mp-btn sm${s.shuffle ? ' on' : ''}`} onClick={() => useMusic.setState({ shuffle: !s.shuffle })} aria-pressed={s.shuffle} aria-label="Aleatorio" title="Aleatorio">
              <Icon name="shuffle" size={15} />
            </button>
            <button className="mp-btn" onClick={prev} aria-label="Anterior">
              <Icon name="skipBack" size={18} />
            </button>
            <button className="mp-btn main" onClick={toggle} aria-label={s.playing ? 'Pausa' : 'Reproducir'}>
              <Icon name={s.playing ? 'pause' : 'play'} size={22} />
            </button>
            <button className="mp-btn" onClick={next} aria-label="Siguiente">
              <Icon name="skip" size={18} />
            </button>
            <button className={`mp-btn sm${s.repeat ? ' on' : ''}`} onClick={() => useMusic.setState({ repeat: !s.repeat })} aria-pressed={s.repeat} aria-label="Repetir" title="Repetir lista">
              <Icon name="repeat" size={15} />
            </button>
          </div>
          <div className="mp-volume">
            <button className="mp-btn sm" onClick={toggleMute} aria-label={s.muted ? 'Activar sonido' : 'Silenciar'}>
              <Icon name={s.muted || s.volume === 0 ? 'volumeX' : 'volume'} size={15} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={s.muted ? 0 : s.volume}
              style={{ '--pct': `${(s.muted ? 0 : s.volume) * 100}%` } as CSSProperties}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volumen"
            />
            <button className={`mp-btn sm${showList ? ' on' : ''}`} onClick={() => setShowList((v) => !v)} aria-pressed={showList} aria-label="Lista de canciones" title="Lista">
              <Icon name="list" size={15} />
            </button>
          </div>
        </>
      )}

      {showList && s.tracks.length > 0 && (
        <div className="mp-list-wrap">
          {s.tracks.length > 8 && <input className="input sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar canción…" aria-label="Buscar canción" />}
          <ol className="mp-list">
            {filtered.map(({ t: tr, i }) => (
              <li key={tr.id}>
                <button className={i === s.index ? 'current' : ''} onClick={() => void playAt(i)}>
                  <span className="tabular muted small">{i + 1}</span>
                  <span className="ellipsis">{tr.name}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <footer className="mp-foot">
        <button className="btn ghost sm" onClick={() => void choose()}>
          <Icon name="folder" size={14} /> {s.tracks.length ? 'Cambiar carpeta' : 'Elegir carpeta'}
        </button>
        {s.canReopen && !s.tracks.length && (
          <button className="btn ghost sm" onClick={() => void reopen()}>
            Reabrir «{s.canReopen}»
          </button>
        )}
      </footer>
    </section>
  );
}
