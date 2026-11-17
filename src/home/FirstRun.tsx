import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { chooseFolder, folderStatus, saveToFolder } from '../lib/backup';
import { useSummaries } from '../summaries/store';
import { useTopicStore } from '../internship/topicStore';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';

const HIDDEN = 'qc:firstRunHidden';

/**
 * Lo que falta para que la app aguante el año. Aparece en Inicio mientras quede algo
 * pendiente y se va sola cuando todo está listo; cada punto se resuelve desde aquí.
 */
export function FirstRun() {
  const [backup, setBackup] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDDEN) === '1');
  const [busy, setBusy] = useState(false);
  const folderName = useSummaries((s) => s.folderName);
  const info = useTopicStore((s) => s.info);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    folderStatus()
      .then((st) => setBackup(st === 'granted'))
      .catch(() => setBackup(false));
  }, []);

  const fichas = Object.values(info).filter((i) => {
    const g = i.guard;
    return g && (g.criteria || g.firstLine || g.secondLine || g.referral);
  }).length;

  const pend = [
    backup === false && {
      id: 'respaldo',
      title: 'Elige la carpeta de respaldo',
      why: 'Sin esto, todo tu año vive solo en este equipo. Lo mejor es una carpeta de OneDrive: sincroniza la PC y la Surface, y queda una copia por día.',
      cta: 'Elegir carpeta',
      run: async () => {
        await chooseFolder();
        await saveToFolder();
        setBackup(true);
        showToast('Respaldo configurado.');
      },
    },
    !folderName && {
      id: 'resumenes',
      title: 'Apunta a tu carpeta de resúmenes',
      why: 'Los ultrarresúmenes se quedan donde están y se enganchan con tu temario. No se copia nada.',
      cta: 'Abrir Resúmenes',
      run: async () => useSettings.getState().setView('summaries'),
    },
    fichas === 0 && {
      id: 'fichas',
      title: 'Llena tus primeras fichas de guardia',
      why: 'Criterios, primera y segunda línea, cuándo referir, con lo que dice tu GPC. Es lo que vas a consultar en el teléfono a las 3 a.m.',
      cta: 'Abrir el temario',
      run: async () => useUI.getState().setTemarioOpen(true),
    },
  ].filter(Boolean) as { id: string; title: string; why: string; cta: string; run: () => Promise<unknown> }[];

  if (hidden || backup === null || pend.length === 0) return null;

  return (
    <section className="card first-run">
      <div className="card-head">
        <h3>
          <Icon name="check" size={16} /> Antes de empezar el internado
        </h3>
        <span className="spacer" />
        <button
          className="icon-btn xs"
          aria-label="Ocultar"
          title="Ocultar"
          onClick={() => {
            localStorage.setItem(HIDDEN, '1');
            setHidden(true);
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <ul className="fr-list">
        {pend.map((p) => (
          <li key={p.id}>
            <div>
              <b>{p.title}</b>
              <p className="muted small">{p.why}</p>
            </div>
            <button
              className="btn sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await p.run();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : 'No se pudo.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {p.cta}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
