import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { encryptionOn, encryptionUnlocked, markFolderSeen, startSyncWatch, syncFromFolder, type SyncInfo } from '../../lib/backup';
import { useUI } from '../../store/ui';

const when = (iso: string) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Aviso de sincronización: si la carpeta compartida trae algo más nuevo (lo dejó la otra
 * computadora), aparece esta barra para traerlo. Nunca se trae solo: lo decides tú, y antes
 * de reemplazar se guarda una copia de cómo estaba todo (Respaldo → Deshacer restauración).
 */
export function SyncBar() {
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    const onSync = (e: Event) => setInfo((e as CustomEvent<SyncInfo>).detail);
    window.addEventListener('qc:sync', onSync);
    startSyncWatch();
    return () => window.removeEventListener('qc:sync', onSync);
  }, []);

  if (!info?.folderAt) return null;

  const dismiss = () => {
    if (info.folderAt) markFolderSeen(info.folderAt);
    setInfo(null);
  };

  const bring = async () => {
    if (encryptionOn() && !encryptionUnlocked()) {
      showToast('El respaldo está cifrado: ábrelo desde Respaldo para escribir la contraseña.');
      return;
    }
    if (info.localChanges && !confirm('Aquí hay cambios de hoy que se reemplazarán con lo de la carpeta.\n\n¿Continuar? Se guarda una copia para poder deshacerlo.')) return;
    setBusy(true);
    try {
      await syncFromFolder();
      showToast('Progreso al día. Recargando…');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      showToast(`No se pudo traer: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  };

  return (
    <div className="sync-bar" role="status">
      <Icon name="swap" size={16} />
      <span className="small">
        Tu otra computadora dejó avance más nuevo en la carpeta ({when(info.folderAt)}).
        {info.localChanges ? ' Aquí también hay cambios de hoy.' : ''}
      </span>
      <div className="spacer" />
      <button className="btn primary sm" onClick={() => void bring()} disabled={busy}>
        {busy ? 'Trayendo…' : 'Traer lo más nuevo'}
      </button>
      <button className="icon-btn xs" onClick={dismiss} title="Ignorar por ahora" aria-label="Ignorar el aviso">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
