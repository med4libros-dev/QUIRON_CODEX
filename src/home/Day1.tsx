import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { chooseFolder, downloadBackup, folderStatus, folderSupported, lastFileBackup, saveToFolder } from '../lib/backup';
import { SPECIALTY, TOPICS } from '../internship/curriculum';
import { useTopicStore } from '../internship/topicStore';
import { useInternship } from '../internship/store';
import { useSummaries } from '../summaries/store';
import { useDrugs } from '../drugs/store';
import { useSettings } from '../store/settings';
import { useUI } from '../store/ui';

const WEB = 'https://med4libros-dev.github.io/QUIRON_CODEX/';
/** Cuántas fichas de urgencias valen la pena antes del primer turno. */
const META_FICHAS = 10;

/** Los temas de urgencias de mayor prioridad: lo que más probablemente te toque la primera semana. */
export function urgenciasPrioritarias(n = META_FICHAS) {
  return TOPICS.filter((t) => t.specialty === 'urg')
    .sort((a, b) => b.yield - a.yield)
    .slice(0, n);
}

const llena = (g?: { criteria: string; firstLine: string; secondLine: string; referral: string }) =>
  !!g && !!(g.criteria.trim() || g.firstLine.trim() || g.secondLine.trim() || g.referral.trim());

/**
 * Preparar el día 1. No es un tutorial: es la lista de lo que de verdad hace falta
 * antes del primer turno, con el estado real de cada cosa y el botón para resolverla.
 */
export function Day1Modal({ onClose, onEditPlan }: { onClose: () => void; onEditPlan: () => void }) {
  const [carpeta, setCarpeta] = useState<boolean | null>(null);
  const [busy, setBusy] = useState('');
  const config = useInternship((s) => s.config);
  const info = useTopicStore((s) => s.info);
  const resumenes = useSummaries((s) => s.summaries.length);
  const drugs = useDrugs((s) => s.drugs.length);
  const showToast = useUI((s) => s.showToast);

  useEffect(() => {
    folderStatus()
      .then((st) => setCarpeta(st === 'granted'))
      .catch(() => setCarpeta(false));
  }, []);

  const urg = useMemo(() => urgenciasPrioritarias(), []);
  const conFicha = urg.filter((t) => llena(info[t.id]?.guard)).length;
  const respaldoOk = folderSupported() ? carpeta === true : lastFileBackup() > 0;

  const pasos = [
    {
      id: 'fecha',
      titulo: 'Tu fecha real de inicio',
      por: 'El plan reparte 139 temas en el año a partir de ese día. Con una fecha de prueba, todo lo demás queda mal calendarizado.',
      hecho: !!config,
      detalle: config ? `Empieza el ${config.start}` : 'Sin plan todavía',
      cta: config ? 'Ajustar el plan' : 'Crear el plan',
      hacer: () => {
        onClose();
        onEditPlan();
      },
    },
    {
      id: 'respaldo',
      titulo: 'Dónde se respalda',
      por: folderSupported()
        ? 'Una carpeta de OneDrive sincroniza la PC y la Surface, y deja una copia por día.'
        : 'Aquí no hay respaldo automático posible: descarga el archivo y guárdalo en Archivos o mándatelo por correo.',
      hecho: respaldoOk,
      detalle: respaldoOk ? 'Listo' : 'Sin respaldo en este dispositivo',
      cta: folderSupported() ? 'Elegir carpeta' : 'Descargar respaldo',
      hacer: async () => {
        setBusy('respaldo');
        try {
          if (folderSupported()) {
            await chooseFolder();
            await saveToFolder();
            setCarpeta(true);
          } else {
            await downloadBackup(false);
          }
          showToast('Respaldo listo.');
        } catch (e) {
          showToast(e instanceof Error ? e.message : 'No se pudo.');
        } finally {
          setBusy('');
        }
      },
    },
    {
      id: 'fichas',
      titulo: `Fichas de guardia: ${conFicha} de ${META_FICHAS}`,
      por: 'Es lo que vas a consultar en el teléfono a las 3 a.m. Si están vacías, Bolsillo solo te sirve para escalas y dosis.',
      hecho: conFicha >= META_FICHAS,
      detalle: conFicha === 0 ? 'Ninguna todavía' : `Faltan ${Math.max(0, META_FICHAS - conFicha)}`,
      cta: 'Abrir el temario',
      hacer: () => {
        onClose();
        useUI.getState().setTemarioOpen(true);
      },
    },
    {
      id: 'dosis',
      titulo: 'Fármacos por peso',
      por: 'La app no trae dosis de fábrica a propósito. En Vista de Guardia → Fármacos por peso, captura los que más vas a usar con lo que diga tu GPC.',
      hecho: drugs >= 5,
      detalle: drugs === 0 ? 'Ninguno capturado' : `${drugs} capturados`,
      cta: 'Abrir Guardia',
      hacer: () => {
        onClose();
        useUI.getState().setGuardQuickOpen(true);
      },
    },
    {
      id: 'resumenes',
      titulo: 'Tus ultrarresúmenes',
      por: 'Se quedan en su carpeta y se enganchan al temario. No se copia nada.',
      hecho: resumenes > 0,
      detalle: resumenes > 0 ? `${resumenes} indexados` : 'Sin carpeta apuntada',
      cta: 'Abrir Resúmenes',
      hacer: () => {
        onClose();
        useSettings.getState().setView('summaries');
      },
      opcional: !folderSupported(),
    },
  ].filter((p) => !p.opcional);

  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <Modal title="Preparar el día 1" onClose={onClose} width={640}>
      <p className="small">
        Lo que de verdad hace falta antes de tu primer turno. <b>{hechos} de {pasos.length}</b> listos.
      </p>

      <ol className="d1-list">
        {pasos.map((p) => (
          <li key={p.id} className={p.hecho ? 'ok' : undefined}>
            <Icon name={p.hecho ? 'check' : 'circle'} size={17} />
            <div>
              <b>{p.titulo}</b>
              <p className="muted small">{p.por}</p>
              <span className="small d1-estado">{p.detalle}</span>
            </div>
            <button className="btn sm" disabled={busy === p.id} onClick={() => void p.hacer()}>
              {busy === p.id ? 'Un momento…' : p.cta}
            </button>
          </li>
        ))}
      </ol>

      <section className="d1-tel">
        <h4>
          <Icon name="monitor" size={15} /> En el teléfono
        </h4>
        <p className="small muted">
          Abre esta dirección en el navegador del teléfono y usa «Agregar a inicio». Queda como app, funciona sin internet y abre en Bolsillo:
          guardia, dosis, escalas, repaso y bitácora.
        </p>
        <code className="d1-url">{WEB}</code>
        <p className="small muted">
          Ahí tus datos son otros: el teléfono no comparte almacenamiento con la Surface. Para llevarte el progreso, respalda aquí y restaura
          allá desde el archivo.
        </p>
      </section>

      <p className="small muted">
        Las fichas de urgencias que yo priorizaría: {urg.slice(0, 5).map((t) => t.title).join(', ')}
        {urg.length > 5 ? ', …' : ''} ({SPECIALTY.urg.name}).
      </p>

      <div className="field-row">
        <span className="spacer" />
        <button className="btn" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </Modal>
  );
}
