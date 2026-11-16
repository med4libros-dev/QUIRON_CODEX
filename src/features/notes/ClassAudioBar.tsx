import { useEffect, useRef, useState, type RefObject } from 'react';
import { Icon } from '../../components/Icon';
import { audioSupported, clock, deleteRecording, loadRecording, recordingElapsed, recordingNote, startRecording, stopRecording } from '../../lib/classAudio';
import { useUI } from '../../store/ui';

interface Props {
  noteId: string;
  /** Lo llama el lienzo cuando tocas un trazo con la escucha abierta. */
  seekRef: RefObject<((seconds: number) => void) | null>;
  /** Avisa al lienzo si hay audio y si está escuchando, para activar el toque-para-saltar. */
  onListening: (on: boolean) => void;
}

/**
 * Grabar la clase y volver a ella: mientras grabas, cada trazo guarda su segundo; al reproducir,
 * tocar un apunte salta al momento en que lo escribiste.
 *
 * El audio no sale de este equipo y no entra en los respaldos.
 */
export function ClassAudioBar({ noteId, seekRef, onListening }: Props) {
  const [rec, setRec] = useState(recordingNote() === noteId);
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    let alive = true;
    void loadRecording(noteId).then((b) => {
      if (!alive) return;
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return b ? URL.createObjectURL(b) : null;
      });
    });
    return () => {
      alive = false;
    };
  }, [noteId, rec]);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setElapsed(Math.round((recordingElapsed() ?? 0) / 1000)), 1000);
    return () => clearInterval(t);
  }, [rec]);

  useEffect(() => {
    seekRef.current = listening
      ? (s) => {
          const a = audio.current;
          if (!a) return;
          a.currentTime = Math.max(0, s - 2);
          void a.play();
        }
      : null;
    onListening(listening);
  }, [listening, seekRef, onListening]);

  const begin = async () => {
    try {
      await startRecording(noteId);
      setRec(true);
      setElapsed(0);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo empezar a grabar');
    }
  };

  const end = async () => {
    try {
      const out = await stopRecording();
      setRec(false);
      showToast(out ? `Clase guardada · ${clock(out.seconds)}` : 'No se grabó nada');
    } catch {
      setRec(false);
      showToast('No se pudo guardar la grabación');
    }
  };

  if (!audioSupported() && !url) return null;

  return (
    <div className="class-audio">
      {rec ? (
        <>
          <button className="btn danger sm" onClick={() => void end()}>
            <Icon name="stop" size={15} /> Parar
          </button>
          <span className="chip rec-dot tabular">● {clock(elapsed)}</span>
          <span className="muted small">Cada trazo queda ligado a este minuto.</span>
        </>
      ) : (
        <button className="btn ghost sm" onClick={() => void begin()} disabled={!!recordingNote()}>
          <Icon name="mic" size={15} /> Grabar la clase
        </button>
      )}

      {url && !rec && (
        <>
          <audio ref={audio} src={url} controls preload="metadata" className="class-player" />
          <button
            className={`btn ghost sm${listening ? ' active' : ''}`}
            onClick={() => setListening((v) => !v)}
            aria-pressed={listening}
            title="Toca un apunte del lienzo para saltar al momento en que lo escribiste"
          >
            <Icon name="target" size={15} /> Tocar para saltar
          </button>
          <button
            className="icon-btn xs"
            onClick={() => {
              if (!confirm('¿Borrar la grabación de esta nota? No se puede deshacer.')) return;
              void deleteRecording(noteId).then(() => {
                setUrl(null);
                setListening(false);
                showToast('Grabación borrada');
              });
            }}
            title="Borrar la grabación"
            aria-label="Borrar la grabación"
          >
            <Icon name="trash" size={14} />
          </button>
        </>
      )}
      {!url && !rec && <span className="muted small">Para clases y seminarios. No la uses con un paciente delante.</span>}
    </div>
  );
}
