import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { APP_VERSION } from '../../version';
import { dismiss, fetchLatest, type Release } from '../../lib/update';
import { openExternal, isDesktop } from '../../lib/platform';

type Estado = { tipo: 'nada' } | { tipo: 'buscando' } | { tipo: 'aldia' } | { tipo: 'hay'; rel: Release } | { tipo: 'error'; msg: string };

/**
 * Buscar actualización a mano. El aviso automático pregunta una vez al día; esto no espera
 * a nadie: sirve cuando acabo de publicar algo y lo quieres ya.
 */
export function UpdateCheck() {
  const [st, setSt] = useState<Estado>({ tipo: 'nada' });

  async function buscar() {
    setSt({ tipo: 'buscando' });
    if (!navigator.onLine) {
      setSt({ tipo: 'error', msg: 'No hay internet. La app funciona igual; vuelve a intentarlo cuando haya red.' });
      return;
    }
    try {
      const rel = await fetchLatest();
      setSt(rel ? { tipo: 'hay', rel } : { tipo: 'aldia' });
    } catch {
      setSt({ tipo: 'error', msg: 'No se pudo preguntar a GitHub. Puede ser la red o que GitHub esté caído.' });
    }
  }

  return (
    <div className="upd">
      <div className="field-row">
        <span className="small">
          Tienes la <b>{APP_VERSION}</b>
        </span>
        <span className="spacer" />
        <button className="btn sm" onClick={buscar} disabled={st.tipo === 'buscando'}>
          {st.tipo === 'buscando' ? 'Buscando…' : 'Buscar actualización'}
        </button>
      </div>

      {st.tipo === 'aldia' && (
        <p className="small ok-text">
          <Icon name="check" size={14} /> Estás al día.
        </p>
      )}
      {st.tipo === 'error' && <p className="small muted">{st.msg}</p>}
      {st.tipo === 'hay' && (
        <div className="upd-hay">
          <p className="small">
            Hay una versión nueva: <b>{st.rel.version}</b>.
            {isDesktop()
              ? ' Cierra la app antes de instalar; si la dejas abierta, el instalador no puede reemplazarla y luego no abre.'
              : ' En la versión web basta con recargar.'}
          </p>
          {st.rel.notes && <pre className="upd-notas">{st.rel.notes.slice(0, 900)}</pre>}
          <div className="field-row">
            {isDesktop() ? (
              <button
                className="btn sm primary"
                onClick={() => {
                  dismiss(st.rel.version);
                  openExternal(st.rel.setup || st.rel.url);
                }}
              >
                Descargar
              </button>
            ) : (
              <button className="btn sm primary" onClick={() => location.reload()}>
                Recargar para actualizar
              </button>
            )}
            <button className="btn sm ghost" onClick={() => openExternal(st.rel.url)}>
              Ver qué trae
            </button>
          </div>
        </div>
      )}
      {!isDesktop() && st.tipo !== 'hay' && (
        <p className="small muted">
          Esta es la versión web: se actualiza sola al recargar. El botón sirve para saber si ya publiqué algo nuevo.
        </p>
      )}
    </div>
  );
}
