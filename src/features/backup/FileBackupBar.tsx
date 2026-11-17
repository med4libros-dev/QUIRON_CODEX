import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { downloadBackup, fileBackupOverdue, lastFileBackup } from '../../lib/backup';
import { useNotes } from '../../store/notes';
import { useInternship } from '../../internship/store';
import { useUI } from '../../store/ui';

const POSTPUESTO = 'qc:fileBackupSnooze';

/**
 * En iPad (y en cualquier navegador sin carpetas) no hay respaldo automático posible:
 * iOS no deja apuntar a una carpeta. Lo único que queda es descargar un archivo, y un
 * respaldo que depende de que te acuerdes no es un respaldo. Esta barra se acuerda por ti.
 */
export function FileBackupBar() {
  const [dias, setDias] = useState<number | null>(null);
  const notas = useNotes((s) => s.notes.length);
  const done = useInternship((s) => Object.keys(s.done).length);
  // El plan ya es trabajo tuyo: si existe, hay algo que perder.
  const hayPlan = useInternship((s) => !!s.config);
  const showToast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ver = () => {
      const snooze = Number(localStorage.getItem(POSTPUESTO) || 0);
      if (Date.now() < snooze) return setDias(null);
      setDias(fileBackupOverdue(hayPlan || notas + done > 0));
    };
    ver();
    const t = setInterval(ver, 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [notas, done, hayPlan]);

  if (dias === null) return null;
  const nunca = !lastFileBackup();

  return (
    <div className="sync-bar file-backup-bar" role="status">
      <Icon name="shield" size={17} />
      <span>
        {nunca
          ? 'En este dispositivo no hay respaldo todavía. Aquí no se puede automático, así que descárgalo tú.'
          : `Van ${dias} días sin respaldar en este dispositivo.`}
      </span>
      <span className="spacer" />
      <button
        className="btn sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await downloadBackup(false);
            showToast('Respaldo descargado. Guárdalo en Archivos o mándatelo por correo.');
            setDias(null);
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'No se pudo descargar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Descargar respaldo
      </button>
      <button
        className="icon-btn xs"
        aria-label="Mañana"
        title="Recordármelo mañana"
        onClick={() => {
          localStorage.setItem(POSTPUESTO, String(Date.now() + 86400000));
          setDias(null);
        }}
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
