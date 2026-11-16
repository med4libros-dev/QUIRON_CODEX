import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { InkDiagnostic } from './InkDiagnostic';
import { AI_KEY_HINT, AI_LABEL, type AiProvider } from '../../lib/ai';
import { saveAiKey } from '../../lib/useAi';
import { checkReminders, dailySummary } from '../../lib/reminders';
import { notify, notifyPermission } from '../../lib/notify';
import { isDesktop } from '../../lib/platform';
import { useSettings } from '../../store/settings';
import { useUI } from '../../store/ui';
import { useTools } from '../../store/tools';
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
  const [diag, setDiag] = useState(false);
  const provider = useSettings((s) => s.aiProvider);
  const geminiModel = useSettings((s) => s.geminiModel);
  const curKey = useSettings((s) => (s.aiProvider === 'gemini' ? s.geminiKey : s.apiKey));
  const model = useSettings((s) => s.model);
  const saver = useSettings((s) => s.saver);
  const inkPredict = useSettings((s) => s.inkPredict);
  const ocrAuto = useSettings((s) => s.inkOcrAuto);
  const syncAuto = useSettings((s) => s.syncAuto);
  const retention = useSettings((s) => s.retention);
  const setRetention = useSettings((s) => s.setRetention);
  const barrel = useTools((s) => s.barrel);
  const snapShapes = useTools((s) => s.snapShapes);
  const [keyDraft, setKeyDraft] = useState('');

  return (
    <>
    {diag && <InkDiagnostic onClose={() => setDiag(false)} />}
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
            <Icon name="swap" size={15} /> Carpeta compartida
          </h4>
          <label className="check">
            <input type="checkbox" checked={syncAuto} onChange={(e) => useSettings.getState().setSyncAuto(e.target.checked)} /> Traer solo lo que deje la otra computadora
          </label>
          <p className="muted small">
            Revisa la carpeta cada dos minutos y trae lo más nuevo sin preguntar, pero solo cuando aquí no hay cambios sin respaldar. Si los hay —o si el respaldo está
            cifrado y bloqueado— vuelve a aparecer la barra para que decidas tú. Nunca reemplaza en silencio lo que escribiste.
          </p>
        </section>

        <section>
          <h4>
            <Icon name="cards" size={15} /> Repaso
          </h4>
          <p className="muted small">
            Qué tan seguido quieres volver a ver cada tarjeta. Más exigente = intervalos más cortos y más repasos al día; más
            relajado = menos repasos, con algo más de olvido.
          </p>
          <div className="seg" role="radiogroup" aria-label="Exigencia del repaso">
            {(
              [
                [0.85, 'Relajado'],
                [0.9, 'Normal'],
                [0.95, 'Estricto'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} role="radio" aria-checked={retention === v} className={retention === v ? 'active' : ''} onClick={() => setRetention(v)}>
                {label} <span className="muted small">{Math.round(v * 100)} %</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>
            <Icon name="pen" size={15} /> Lápiz
          </h4>
          <div className="field-row tight">
            <span className="small">Botón lateral del lápiz</span>
            <select className="select xs" value={barrel} onChange={(e) => useTools.getState().setBarrel(e.target.value as 'eraser' | 'lasso' | 'none')} aria-label="Botón lateral del lápiz">
              <option value="eraser">Borrador</option>
              <option value="lasso">Lazo</option>
              <option value="none">Nada</option>
            </select>
          </div>
          <label className="check">
            <input type="checkbox" checked={snapShapes} onChange={(e) => useTools.getState().setSnapShapes(e.target.checked)} /> Formas rectas al dejar el lápiz quieto
          </label>
          <label className="check">
            <input type="checkbox" checked={inkPredict} onChange={(e) => useSettings.getState().setInkPredict(e.target.checked)} /> Punta predictiva (experimental)
          </label>
          <p className="muted small">Adelanta el trazo unos milisegundos con la predicción de Windows. Pruébala: si la punta «baila» o las letras parecen unirse, déjala apagada.</p>
          <label className="check">
            <input type="checkbox" checked={ocrAuto} onChange={(e) => useSettings.getState().setInkOcrAuto(e.target.checked)} /> Reconocer mi letra en segundo plano
          </label>
          <p className="muted small">
            Transcribe solas las notas en reposo para que lo escrito a mano entre al buscador sin pedirlo hoja por hoja. Necesita el motor de IA configurado y consume de tu
            cuenta: una petición por hoja. Sale de este equipo solo la imagen de tus hojas.
          </p>
          <button className="btn ghost sm" onClick={() => setDiag(true)}>
            <Icon name="target" size={14} /> Diagnóstico del lápiz
          </button>
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
            <Icon name="sparkles" size={15} /> IA
          </h4>
          <p className="muted small">
            Opcional. Se usa para síntesis, simulacros, mnemotecnias, diagramas y preguntas desde subrayados; siempre con tu material. Elige con cuál quieres trabajar: la clave se guarda solo en este equipo y el material se envía directo a ese proveedor.
          </p>
          <div className="seg" role="radiogroup" aria-label="Motor de IA">
            {(['claude', 'gemini'] as AiProvider[]).map((id) => (
              <button key={id} className={provider === id ? 'active' : ''} aria-pressed={provider === id} onClick={() => useSettings.getState().setAiProvider(id)}>
                {AI_LABEL[id]}
              </button>
            ))}
          </div>
          {curKey ? (
            <div className="field-row tight">
              <span className="small ok-text">● Clave de {AI_LABEL[provider]} guardada (…{curKey.slice(-4)})</span>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => confirm(`¿Quitar tu API key de ${AI_LABEL[provider]} de este equipo?`) && saveAiKey('')}>
                Quitar
              </button>
            </div>
          ) : (
            <div className="field-row tight">
              <input className="input grow" type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder={AI_KEY_HINT[provider]} aria-label={`API key de ${AI_LABEL[provider]}`} />
              <button
                className="btn sm"
                disabled={!keyDraft.trim()}
                onClick={() => {
                  saveAiKey(keyDraft.trim());
                  setKeyDraft('');
                }}
              >
                Guardar
              </button>
            </div>
          )}
          <label className="field">
            <span className="small">Modelo</span>
            <input
              className="input sm"
              value={provider === 'gemini' ? geminiModel : model}
              onChange={(e) => (provider === 'gemini' ? useSettings.getState().setGeminiModel(e.target.value) : useSettings.getState().setModel(e.target.value))}
              aria-label={`Modelo de ${AI_LABEL[provider]}`}
            />
          </label>
          <p className="muted small">
            {provider === 'gemini'
              ? 'La clave de Gemini se obtiene en Google AI Studio (aistudio.google.com). Modelos útiles: gemini-2.5-flash (rápido y barato) o gemini-2.5-pro (más cuidadoso).'
              : 'La clave de Claude se obtiene en console.anthropic.com.'}
          </p>
        </section>

        <p className="small muted">
          Quirón Codex {APP_VERSION} ·{' '}
          <button className="linkish" onClick={() => (onClose(), useUI.setState({ shortcutsOpen: true }))}>
            Atajos de teclado
          </button>
        </p>
      </div>
    </Modal>
    </>
  );
}
