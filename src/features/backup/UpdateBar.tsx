import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { checkUpdate, dismiss, dismissed, updatesMatter, type Release } from '../../lib/update';
import { openExternal } from '../../lib/platform';

/**
 * Aviso de versión nueva. Se consulta una vez al día, nunca al arrancar en frío
 * (los primeros segundos son para abrir la app, no para hablar con GitHub), y si no hay
 * internet simplemente no aparece.
 */
export function UpdateBar() {
  const [rel, setRel] = useState<Release | null>(null);

  useEffect(() => {
    if (!updatesMatter()) return;
    const t = setTimeout(async () => {
      const r = await checkUpdate();
      if (r && !dismissed(r.version)) setRel(r);
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  if (!rel) return null;
  return (
    <div className="sync-bar update-bar" role="status">
      <Icon name="download" size={17} />
      <span>
        Hay una versión nueva: <b>{rel.version}</b>
        <i className="muted small"> · cierra la app antes de instalar</i>
      </span>
      <span className="spacer" />
      <button className="btn sm" onClick={() => openExternal(rel.setup || rel.url)}>
        Descargar
      </button>
      <button className="btn sm ghost" onClick={() => openExternal(rel.url)}>
        Qué trae
      </button>
      <button
        className="icon-btn xs"
        aria-label="Ahora no"
        title="Ahora no"
        onClick={() => {
          dismiss(rel.version);
          setRel(null);
        }}
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
