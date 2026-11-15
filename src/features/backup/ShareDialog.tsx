import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { exportIcs, icsCount, type IcsOptions } from '../../lib/ics';
import { exportPack, type PackOptions } from '../../lib/studyPack';
import { useInternship } from '../../internship/store';
import { usePlanner } from '../../store/planner';

/**
 * Llevar el estudio a otro lado:
 *  · un archivo .html de solo lectura para repasar en el celular (sin instalar nada), y
 *  · el plan en .ics para verlo en el calendario del teléfono.
 */
export function ShareDialog({ onClose }: { onClose: () => void }) {
  const [pack, setPack] = useState<PackOptions>({ notes: true, pearls: true, cards: true, highlights: true, images: false });
  const [ics, setIcs] = useState<IcsOptions>({ rotations: true, guardias: true, sessions: true });
  const [msg, setMsg] = useState('');
  const hasPlan = !!useInternship((s) => s.config);
  const sessions = usePlanner((s) => s.sessions.length);

  const nothing = !pack.notes && !pack.pearls && !pack.cards && !pack.highlights;
  const check = (k: keyof PackOptions) => (
    <label className="chk">
      <input type="checkbox" checked={pack[k]} onChange={(e) => setPack({ ...pack, [k]: e.target.checked })} />
      {{ notes: 'Notas', pearls: 'Perlas', cards: 'Flashcards', highlights: 'Resaltados', images: 'Incluir imágenes (pesa más)' }[k]}
    </label>
  );

  return (
    <Modal title="Llevarlo a otro lado" onClose={onClose} width={520}>
      <section>
        <h4>Repasar en el celular</h4>
        <p className="muted small">
          Un solo archivo .html que se abre en cualquier teléfono, sin instalar nada y sin internet. Trae buscador. Es de solo
          lectura: lo que estudies ahí no regresa a la app. No incluye los PDFs (pesan demasiado), pero sí tus resaltados con su
          página.
        </p>
        <div className="chk-row">
          {check('notes')}
          {check('pearls')}
          {check('cards')}
          {check('highlights')}
        </div>
        <div className="chk-row">{check('images')}</div>
        <button
          className="btn primary sm"
          disabled={nothing}
          onClick={() => {
            const size = exportPack(pack);
            setMsg(`Paquete listo (${(size / 1048576).toFixed(1)} MB). Pásalo al teléfono por WhatsApp, OneDrive o cable y ábrelo ahí.`);
          }}
        >
          <Icon name="download" size={15} /> Crear paquete de repaso
        </button>
      </section>

      <section>
        <h4>Plan en el calendario del teléfono</h4>
        <p className="muted small">
          Archivo .ics con tus rotaciones, guardias y sesiones de estudio. Lo abres una vez en el calendario (Google, Outlook,
          Apple) y aparecen ahí. Es una foto del plan de hoy: si lo cambias, vuelve a exportarlo.
        </p>
        <div className="chk-row">
          <label className="chk">
            <input type="checkbox" checked={ics.rotations} disabled={!hasPlan} onChange={(e) => setIcs({ ...ics, rotations: e.target.checked })} />
            Rotaciones
          </label>
          <label className="chk">
            <input type="checkbox" checked={ics.guardias} disabled={!hasPlan} onChange={(e) => setIcs({ ...ics, guardias: e.target.checked })} />
            Guardias
          </label>
          <label className="chk">
            <input type="checkbox" checked={ics.sessions} disabled={!sessions} onChange={(e) => setIcs({ ...ics, sessions: e.target.checked })} />
            Sesiones de estudio
          </label>
        </div>
        {!hasPlan && <p className="muted small">Todavía no has generado el plan del internado (pestaña Internado).</p>}
        <button
          className="btn sm"
          onClick={() => {
            const n = icsCount(ics);
            if (!n) return setMsg('Con esas opciones no sale ningún evento.');
            exportIcs(ics);
            setMsg(`Se exportaron ${n} eventos. Abre el archivo en el teléfono para agregarlos al calendario.`);
          }}
        >
          <Icon name="calendar" size={15} /> Exportar plan (.ics)
        </button>
      </section>
      {msg && <p className="small ok-text">{msg}</p>}
    </Modal>
  );
}
