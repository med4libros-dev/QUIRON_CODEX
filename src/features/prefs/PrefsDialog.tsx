import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { checkReminders, dailySummary } from '../../lib/reminders';
import { notify, notifyPermission } from '../../lib/notify';
import { isDesktop } from '../../lib/platform';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { APP_VERSION } from '../../version';

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Preferencias: modo noche, recordatorios del sistema e IA. */
export function PrefsDialog({ onClose }: { onClose: () => void }) {
  const night = useSettings((s) => s.night);
  const nightFrom = useSettings((s) => s.nightFrom);
  const nightTo = useSettings((s) => s.nightTo);
  const reminders = useSettings((s) => s.reminders);
  const reminderHour = useSettings((s) => s.reminderHour);
  const { setNight, setReminders } = useSettings.getState();
  const [msg, setMsg] = useState<string | null>(null);
  const apiKey = useSettings((s) => s.apiKey);
  const model = useSettings((s) => s.model);
  const saver = useSettings((s) => s.saver);
  const [keyDraft, setKeyDraft] = useState('');

  return (
    <Modal title="Preferencias" onClose={onClose} width={540}>
      <div className="prefs">
        <section>
          <h4>
            <Icon name="moon" size={15} /> Modo noche
          </h4>
          <p className="muted small">Tonos cálidos, sin luz azul y PDFs más tenues para estudiar después de la guardia sin quitarte el sueño.</p>
          <div className="seg" role="radiogroup" aria-label="Modo noche">
            {(
              [
                ['off', 'Apagado'],
                ['auto', 'Automático'],
                ['on', 'Siempre'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={night === id ? 'active' : ''} aria-pressed={night === id} onClick={() => setNight(id)}>
                {label}
              </button>
            ))}
          </div>
          {night === 'auto' && (
            <div className="field-row tight">
              <span className="small">De</span>
              <select className="select xs" value={nightFrom} onChange={(e) => setNight('auto', Number(e.target.value), nightTo)} aria-label="Inicio del modo noche">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hh(h)}
                  </option>
                ))}
              </select>
              <span className="small">a</span>
              <select className="select xs" value={nightTo} onChange={(e) => setNight('auto', nightFrom, Number(e.target.value))} aria-label="Fin del modo noche">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hh(h)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section>
          <h4>
            <Icon name="bell" size={15} /> Recordatorios
          </h4>
          <p className="muted small">
            Avisos de {isDesktop() ? 'Windows' : 'tu navegador'} mientras Quirón Codex está abierto (aunque esté minimizado): tus flashcards y refuerzo del día, los pendientes del Turno que tengan hora y 30 min antes de terminar el turno.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={reminders}
              onChange={async (e) => {
                const on = e.target.checked;
                if (on) {
                  const ok = await notifyPermission();
                  setMsg(ok ? null : 'Sin permiso de notificaciones: los avisos saldrán dentro de la app.');
                }
                setReminders(on);
                if (on) checkReminders();
              }}
            />{' '}
            Activar recordatorios
          </label>
          {reminders && (
            <div className="field-row tight">
              <span className="small">Aviso diario a las</span>
              <select className="select xs" value={reminderHour} onChange={(e) => setReminders(true, Number(e.target.value))} aria-label="Hora del aviso diario">
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hh(h)}
                  </option>
                ))}
              </select>
              <button
                className="btn ghost sm"
                onClick={() => {
                  const d = dailySummary();
                  notify(d?.title ?? 'Quirón Codex', d?.body ?? 'Así se verán tus recordatorios.');
                }}
              >
                Probar
              </button>
            </div>
          )}
          {msg && <p className="small warn-text">{msg}</p>}
        </section>

        <section>
          <h4>
            <Icon name="battery" size={15} /> Ahorro de batería
          </h4>
          <p className="muted small">Quita el fondo animado y suaviza el efecto cristal para que la Surface dure más. En «Automático» se activa al desconectar el cargador.</p>
          <div className="seg" role="radiogroup" aria-label="Ahorro de batería">
            {(
              [
                ['auto', 'Automático'],
                ['on', 'Siempre'],
                ['off', 'Nunca'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className={saver === id ? 'active' : ''} aria-pressed={saver === id} onClick={() => useSettings.getState().setSaver(id)}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>
            <Icon name="sparkles" size={15} /> IA (Claude)
          </h4>
          <p className="muted small">
            Opcional. Se usa para síntesis, simulacros, mnemotecnias, diagramas y preguntas desde subrayados; siempre con tu material. La clave se guarda solo en este equipo.
          </p>
          {apiKey ? (
            <div className="field-row tight">
              <span className="small ok-text">● Clave guardada (…{apiKey.slice(-4)})</span>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => confirm('¿Quitar tu API key de este equipo?') && useSettings.getState().setApiKey('')}>
                Quitar
              </button>
            </div>
          ) : (
            <div className="field-row tight">
              <input className="input grow" type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" aria-label="API key de Anthropic" />
              <button
                className="btn sm"
                disabled={!keyDraft.trim()}
                onClick={() => {
                  useSettings.getState().setApiKey(keyDraft.trim());
                  setKeyDraft('');
                }}
              >
                Guardar
              </button>
            </div>
          )}
          <label className="field">
            <span className="small">Modelo</span>
            <input className="input sm" value={model} onChange={(e) => useSettings.getState().setModel(e.target.value)} aria-label="Modelo de Claude" />
          </label>
        </section>

        <p className="small muted">
          Quirón Codex {APP_VERSION} ·{' '}
          <button className="linkish" onClick={() => (onClose(), useUI.setState({ shortcutsOpen: true }))}>
            Atajos de teclado
          </button>
        </p>
      </div>
    </Modal>
  );
}
