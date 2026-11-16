import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { folderStatus, saveToFolder } from '../../lib/backup';
import { idb } from '../../lib/idb';
import { useLibrary } from '../../store/library';
import { useTrash } from '../../store/trash';
import { useUI } from '../../store/ui';

/** Tamaño legible: KB cuando aún no llega a un mega. */
const mb = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

interface Row {
  id: string;
  name: string;
  size: number;
  /** El PDF ya no está en la biblioteca: solo lo retiene la papelera. */
  inTrash: boolean;
}

/**
 * Revisión de espacio y respaldo: cuánto estás usando, qué es lo que pesa y si la carpeta
 * compartida de verdad está escribiendo. Nada se borra sin que lo pidas.
 */
export function StorageReview({ onClose }: { onClose: () => void }) {
  const docs = useLibrary((s) => s.docs);
  const trash = useTrash((s) => s.items);
  const showToast = useUI((s) => s.showToast);
  const [quota, setQuota] = useState<{ usage: number; quota: number } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<string>('');

  const scan = useCallback(async () => {
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est?.usage != null && est.quota != null) setQuota({ usage: est.usage, quota: est.quota });
    const keys = await idb.keys('pdfs');
    const trashDocs = new Map(
      trash.flatMap((t) => (t.payload.kind === 'doc' ? [[t.payload.doc.id, t.payload.doc.name] as const] : [])),
    );
    const out: Row[] = [];
    for (const id of keys) {
      const blob = await idb.get<Blob>('pdfs', id);
      const size = blob instanceof Blob ? blob.size : 0;
      const doc = docs.find((d) => d.id === id);
      out.push({ id, name: doc?.name ?? trashDocs.get(id) ?? 'Archivo suelto', size, inTrash: !doc });
    }
    setRows(out.sort((a, b) => b.size - a.size));
  }, [docs, trash]);

  useEffect(() => {
    void scan();
  }, [scan]);

  const totalPdfs = (rows ?? []).reduce((n, r) => n + r.size, 0);
  const trashBytes = (rows ?? []).filter((r) => r.inTrash).reduce((n, r) => n + r.size, 0);
  const pct = quota ? Math.min(100, Math.round((quota.usage / quota.quota) * 100)) : null;

  const purge = async (r: Row) => {
    if (!confirm(`¿Borrar «${r.name}» definitivamente? Se libera ${mb(r.size)} y no se puede deshacer.`)) return;
    await idb.del('pdfs', r.id);
    void idb.del('kv', `search:${r.id}`);
    if (!r.inTrash) void useLibrary.getState().removeDoc(r.id);
    const t = useTrash.getState().items.find((x) => x.payload.kind === 'doc' && x.payload.doc.id === r.id);
    if (t) useTrash.getState().drop(t.id);
    showToast(`Liberados ${mb(r.size)}.`);
    void scan();
  };

  return (
    <Modal title="Espacio y respaldo" onClose={onClose} width={600}>
      <section>
        <h4>Cuánto estás usando</h4>
        {quota ? (
          <>
            <div className="quota-bar" aria-hidden="true">
              <i style={{ width: `${pct}%` }} data-high={pct! > 85 ? '1' : undefined} />
            </div>
            <p className="muted small">
              {mb(quota.usage)} de {mb(quota.quota)} ({pct} %). De eso, {mb(totalPdfs)} son tus PDFs
              {trashBytes > 0 && `, y ${mb(trashBytes)} siguen ocupados por la papelera`}.
            </p>
            {pct! > 85 && (
              <p className="small error">
                Vas apretado. Si el navegador se queda sin espacio dejará de guardar: borra alguna guía pesada que ya no uses o
                vacía la papelera.
              </p>
            )}
          </>
        ) : (
          <p className="muted small">Este equipo no informa cuánto espacio queda.</p>
        )}
        {trashBytes > 0 && (
          <button className="btn ghost sm" onClick={() => confirm('¿Vaciar la papelera? Se libera el espacio y ya no se puede recuperar nada.') && void useTrash.getState().empty().then(scan)}>
            <Icon name="trash" size={14} /> Vaciar papelera ({mb(trashBytes)})
          </button>
        )}
      </section>

      <section>
        <h4>Lo que más pesa</h4>
        {rows === null ? (
          <p className="muted small">Midiendo…</p>
        ) : !rows.length ? (
          <p className="muted small">Todavía no tienes PDFs guardados.</p>
        ) : (
          <ul className="size-list">
            {rows.slice(0, 10).map((r) => (
              <li key={r.id}>
                <span className="ellipsis" title={r.name}>
                  {r.name}
                  {r.inTrash && <em className="muted small"> · en la papelera</em>}
                </span>
                <b className="tabular small">{mb(r.size)}</b>
                <button className="icon-btn xs danger" onClick={() => void purge(r)} title="Borrar definitivamente" aria-label={`Borrar ${r.name}`}>
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4>¿La carpeta está escribiendo?</h4>
        <p className="muted small">
          Escribe el respaldo ahora mismo y vuelve a leerlo para comprobar que quedó completo. Si la carpeta es de OneDrive, esto
          también fuerza la sincronización.
        </p>
        <div className="row gap">
          <button
            className="btn sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFolder('');
              try {
                const st = await folderStatus();
                if (st !== 'granted') {
                  setFolder('No hay carpeta conectada (o falta volver a dar permiso) en Respaldo.');
                  return;
                }
                const okWrite = await saveToFolder();
                setFolder(okWrite ? 'Escrito y verificado: la carpeta está al día.' : 'No se pudo escribir en la carpeta.');
              } catch (e) {
                setFolder(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="check" size={15} /> Probar ahora
          </button>
          {folder && <span className={`small ${folder.startsWith('Escrito') ? 'ok-text' : 'error'}`}>{folder}</span>}
        </div>
      </section>
    </Modal>
  );
}
