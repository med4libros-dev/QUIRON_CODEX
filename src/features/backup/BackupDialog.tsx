import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import {
  chooseFolder,
  downloadBackup,
  folderStatus,
  folderSupported,
  forgetFolder,
  getFolder,
  lastBackup,
  loadFromFolder,
  reconnectFolder,
  restoreFromFile,
  saveToFolder,
} from '../../lib/backup';

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca';

/** Panel «Respaldo»: dónde está guardado tu progreso y cómo llevarlo a otra computadora. */
export function BackupDialog({ onClose }: { onClose: () => void }) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [folder, setFolder] = useState<{ name: string; status: string } | null>(null);
  const [last, setLast] = useState(lastBackup());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      setPersisted((await navigator.storage?.persisted?.()) ?? null);
      const est = await navigator.storage?.estimate?.();
      if (est?.usage != null) setUsage(`${(est.usage / 1048576).toFixed(1)} MB usados`);
    } catch {
      /* no disponible */
    }
    const dir = await getFolder();
    setFolder(dir ? { name: dir.name, status: await folderStatus() } : null);
    setLast(lastBackup());
  };
  useEffect(() => {
    void refresh();
  }, []);

  const run = async (fn: () => Promise<string | void>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const extra = await fn();
      setMsg({ ok: true, text: extra ? `${okText} ${extra}` : okText });
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (!/abort/i.test(text)) setMsg({ ok: false, text });
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <Modal title="Respaldo de tu progreso" onClose={onClose} width={520}>
      <div className="backup">
        <section>
          <h4>Dónde se guarda</h4>
          <p className="muted small">
            Todo (PDFs, notas, cuadernos, calendario, metas y minutos de estudio) se guarda automáticamente en este navegador
            y sigue ahí aunque cierres la app o apagues la computadora. Se pierde solo si borras los datos de navegación.
          </p>
          <p className="small">
            {persisted ? (
              <span className="ok-text">● Almacenamiento protegido: el navegador no lo borrará por falta de espacio.</span>
            ) : (
              <span className="muted">● Almacenamiento normal.</span>
            )}{' '}
            <span className="muted">{usage}</span>
          </p>
        </section>

        <section>
          <h4>Respaldo automático en una carpeta</h4>
          <p className="muted small">
            Elige una carpeta de <b>OneDrive</b> y Quirón Codex guardará ahí tu progreso cada 2 minutos. Desde otra computadora (tu Surface),
            elige la misma carpeta y usa «Traer progreso».
          </p>
          {!folderSupported() ? (
            <p className="small muted">Tu navegador no permite elegir carpetas. Usa Microsoft Edge o Chrome, o el respaldo en archivo.</p>
          ) : folder ? (
            <>
              <p className="small">
                Carpeta: <b>{folder.name}</b> · último respaldo: {fmtDate(last)}
                {folder.status !== 'granted' && <span className="warn-text"> · necesita permiso</span>}
              </p>
              <div className="field-row">
                {folder.status !== 'granted' ? (
                  <button className="btn primary sm" disabled={busy} onClick={() => run(async () => void (await reconnectFolder()), 'Carpeta reconectada.')}>
                    Reconectar carpeta
                  </button>
                ) : (
                  <button className="btn primary sm" disabled={busy} onClick={() => run(async () => void (await saveToFolder()), 'Respaldo guardado en la carpeta.')}>
                    <Icon name="upload" size={15} /> Respaldar ahora
                  </button>
                )}
                <button
                  className="btn sm"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const when = await loadFromFolder();
                      setTimeout(() => location.reload(), 900);
                      return `(respaldo del ${fmtDate(when)}). Recargando…`;
                    }, 'Progreso traído de la carpeta')
                  }
                >
                  <Icon name="download" size={15} /> Traer progreso
                </button>
                <button className="btn ghost sm" disabled={busy} onClick={() => run(async () => void (await forgetFolder()), 'Carpeta desconectada.')}>
                  Desconectar
                </button>
              </div>
            </>
          ) : (
            <button className="btn primary sm" disabled={busy} onClick={() => run(async () => `«${await chooseFolder()}». Guardando…`, 'Carpeta elegida:').then(() => saveToFolder()).then(() => refresh())}>
              <Icon name="folder" size={15} /> Elegir carpeta de respaldo
            </button>
          )}
        </section>

        <section>
          <h4>Respaldo en un archivo</h4>
          <p className="muted small">Un solo archivo con todo tu progreso. Guárdalo donde quieras y restáuralo en cualquier computadora.</p>
          <div className="field-row">
            <button className="btn sm" disabled={busy} onClick={() => run(() => downloadBackup(true), 'Respaldo descargado (con PDFs).')}>
              <Icon name="download" size={15} /> Descargar con PDFs
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => run(() => downloadBackup(false), 'Respaldo descargado (sin PDFs).')}>
              Solo notas y progreso
            </button>
            <button className="btn ghost sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> Restaurar archivo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f)
                  void run(async () => {
                    await restoreFromFile(f);
                    setTimeout(() => location.reload(), 900);
                    return 'Recargando…';
                  }, 'Respaldo restaurado.');
              }}
            />
          </div>
        </section>
        {msg && <p className={`small ${msg.ok ? 'ok-text' : 'error'}`}>{msg.text}</p>}
      </div>
    </Modal>
  );
}
