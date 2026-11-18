import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { INTOCABLE, PARTES, reiniciar } from './reset';
import { folderSupported } from '../lib/backup';

const PALABRA = 'REINICIAR';

/**
 * Empezar de cero. Esto borra de verdad, así que la pantalla hace tres cosas:
 * decir exactamente qué se va, descargar un respaldo antes, y pedir que lo escribas.
 */
export function ResetModal({ onClose }: { onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(['progreso']);
  const [texto, setTexto] = useState('');
  const [respaldo, setRespaldo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const marcar = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const listo = sel.length > 0 && texto.trim().toUpperCase() === PALABRA;

  async function hacerlo() {
    setBusy(true);
    setErr('');
    try {
      await reiniciar(sel, respaldo);
      location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo reiniciar.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Empezar de cero" onClose={onClose} width={620}>
      <p className="small">
        Útil cuando lo que tienes es de prueba y quieres arrancar limpio el día que empiece el internado de verdad. Elige qué se va:
      </p>

      <ul className="reset-list">
        {PARTES.map((p) => (
          <li key={p.id}>
            <label>
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => marcar(p.id)} />
              <span>
                <b>{p.label}</b>
                <small>{p.detalle}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="small muted">{INTOCABLE}</p>

      <label className="field-row reset-bk">
        <input type="checkbox" checked={respaldo} onChange={(e) => setRespaldo(e.target.checked)} />
        <span className="small">
          Descargar un respaldo completo antes de borrar{' '}
          {!folderSupported() && <b>(en este dispositivo es tu única copia, no lo desmarques)</b>}
        </span>
      </label>

      <div className="reset-confirm">
        <p className="small warn-text">
          <Icon name="shield" size={14} /> Esto no se puede deshacer desde la app. Escribe <b>{PALABRA}</b> para confirmar.
        </p>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={PALABRA} aria-label="Confirmación" />
      </div>

      {err && <p className="small warn-text">{err}</p>}

      <div className="field-row">
        <button className="btn ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <span className="spacer" />
        <button className="btn danger" onClick={hacerlo} disabled={!listo || busy}>
          {busy ? 'Borrando…' : `Reiniciar ${sel.length} ${sel.length === 1 ? 'cosa' : 'cosas'}`}
        </button>
      </div>
    </Modal>
  );
}
