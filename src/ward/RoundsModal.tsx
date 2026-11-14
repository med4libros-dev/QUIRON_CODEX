import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { TOPIC } from '../internship/curriculum';
import { speak, stopTts, ttsSupported } from '../lib/tts';
import { useUI } from '../store/ui';
import { TASK_KINDS, useWard, type WardPatient } from './store';

/** Guion del pase de visita a partir de lo que capturaste del paciente (nada inventado). */
export function roundsScript(p: WardPatient): { label: string; text: string }[] {
  const sexo = p.sex === 'masculino' ? 'masculino' : p.sex === 'femenino' ? 'femenino' : '';
  const ident = [p.bed && `Cama ${p.bed}`, [sexo ? `paciente ${sexo}` : p.age ? 'paciente' : '', p.age && `de ${p.age}${/\D/.test(p.age) ? '' : ' años'}`].filter(Boolean).join(' '), p.weight && `${p.weight} kg`].filter(Boolean).join(', ');
  const dx = p.dx || (p.topicId ? TOPIC[p.topicId]?.title : '');
  const v = p.vitals;
  const vit = v ? [v.fc && `FC ${v.fc}`, v.fr && `FR ${v.fr}`, v.tas && `TAS ${v.tas}`].filter(Boolean).join(', ') : '';
  const open = p.tasks.filter((t) => !t.done);
  const done = p.tasks.filter((t) => t.done);
  const label = (k: string) => TASK_KINDS.find((x) => x.id === k)?.label.toLowerCase() ?? '';
  return [
    { label: 'Identificación', text: ident || '— (captura cama, sexo y edad)' },
    { label: 'Diagnóstico', text: dx || '— (captura el diagnóstico)' },
    { label: 'Estado actual', text: [vit && `Signos vitales: ${vit}.`, p.note].filter(Boolean).join(' ') || '— (agrega una nota rápida de evolución)' },
    { label: 'Resultados / hecho', text: done.length ? done.map((t) => `${t.text} (${label(t.kind)})`).join('; ') : 'Sin pendientes cerrados.' },
    { label: 'Plan y pendientes', text: open.length ? open.map((t) => `${t.text}${t.at ? ` a las ${t.at}` : ''}`).join('; ') : 'Sin pendientes.' },
  ];
}

const GOALS = [60, 90, 120];

/** Ensayo del pase de visita: guion + cronómetro (meta de 60–90 s por paciente). */
export function RoundsModal() {
  const pid = useUI((s) => s.rounds);
  const patient = useWard((s) => s.patients.find((p) => p.id === pid) ?? null);
  const [goal, setGoal] = useState(90);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const started = useRef(0);
  const script = useMemo(() => (patient ? roundsScript(patient) : []), [patient]);

  useEffect(() => {
    setElapsed(0);
    setRunning(false);
  }, [pid]);
  useEffect(() => {
    if (!running) return;
    started.current = Date.now() - elapsed * 1000;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!pid || !patient) return null;
  const close = () => {
    stopTts();
    useUI.getState().setRounds(null);
  };
  const over = elapsed > goal;
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  return (
    <Modal title={`Ensayo del pase de visita · ${patient.bed || 'paciente'}`} onClose={close} width={600}>
      <div className="rounds">
        <p className="muted small">Preséntalo en voz alta siguiendo el orden. El guion sale solo de lo que capturaste; complétalo en tu tarjeta si falta algo.</p>
        <ol className="rounds-script">
          {script.map((s) => (
            <li key={s.label}>
              <b>{s.label}</b>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <div className="rounds-timer">
          <span className={`rounds-clock tabular${over ? ' over' : ''}`} aria-live="polite">
            {mm}
          </span>
          <div className="rounds-bar">
            <i style={{ width: `${Math.min(100, (elapsed / goal) * 100)}%` }} className={over ? 'over' : ''} />
          </div>
          <div className="seg">
            {GOALS.map((g) => (
              <button key={g} className={goal === g ? 'active' : ''} onClick={() => setGoal(g)}>
                {g} s
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <button className="btn primary" onClick={() => setRunning((r) => !r)}>
            <Icon name={running ? 'pause' : 'play'} size={15} /> {running ? 'Pausa' : elapsed ? 'Continuar' : 'Empezar'}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setRunning(false);
              setElapsed(0);
            }}
          >
            <Icon name="reset" size={15} /> Reiniciar
          </button>
          {ttsSupported() && (
            <button className="btn ghost" onClick={() => speak(script.map((s) => ({ text: `${s.label}. ${s.text}` })), 'Pase de visita')} title="Escuchar el guion como modelo">
              <Icon name="speaker" size={15} /> Escuchar guion
            </button>
          )}
          <span className="spacer" />
          {!running && elapsed > 0 && <span className={`small ${over ? 'warn-text' : 'ok-text'}`}>{over ? `Te pasaste ${elapsed - goal} s: recorta el estado actual.` : 'Dentro del tiempo.'}</span>}
        </div>
      </div>
    </Modal>
  );
}
