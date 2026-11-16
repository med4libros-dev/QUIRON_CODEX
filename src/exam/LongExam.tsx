import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { Runner } from './ExamView';

export interface LongPlan {
  /** Los bloques, cada uno con sus preguntas ya elegidas. */
  blocks: string[][];
  minutesPerBlock: number;
  restMinutes: number;
  mode: 'exam' | 'study';
}

interface BlockResult {
  right: number;
  total: number;
  seconds: number;
}

/**
 * Examen largo: varios bloques cronometrados seguidos, con descanso entre uno y otro,
 * para ensayar la resistencia de una jornada completa y no solo un bloque suelto.
 *
 * Cada bloque se guarda como un intento propio (así el historial y la tendencia siguen
 * funcionando) y al final se muestra el acumulado.
 */
export function LongExam({ plan, onClose }: { plan: LongPlan; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<BlockResult[]>([]);
  const [resting, setResting] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!resting) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resting]);

  useEffect(() => {
    if (resting && left <= 0) {
      setResting(false);
      setI((n) => n + 1);
    }
  }, [resting, left]);

  const done = results.length === plan.blocks.length && !resting;

  if (done) {
    const right = results.reduce((a, r) => a + r.right, 0);
    const total = results.reduce((a, r) => a + r.total, 0);
    const mins = Math.round(results.reduce((a, r) => a + r.seconds, 0) / 60);
    return (
      <Modal title="Examen largo terminado" onClose={onClose} width={620}>
        <p className="long-score">
          <b className="tabular">{right}</b> de {total} · {total ? Math.round((right / total) * 100) : 0} %
        </p>
        <p className="muted small">{mins} min de examen, sin contar los descansos. Cada bloque quedó guardado por separado en el historial.</p>
        <ol className="long-blocks">
          {results.map((r, k) => (
            <li key={k}>
              <span>Bloque {k + 1}</span>
              <span className="spacer" />
              <b className="tabular">
                {r.right}/{r.total}
              </b>
              <span className="muted small"> · {Math.round(r.seconds / 60)} min</span>
            </li>
          ))}
        </ol>
        <p className="muted small">Repasa las falladas desde el historial: ahí puedes repetir solo esas.</p>
      </Modal>
    );
  }

  if (resting) {
    const mm = String(Math.max(0, Math.floor(left / 60))).padStart(2, '0');
    const ss = String(Math.max(0, left % 60)).padStart(2, '0');
    return (
      <Modal title={`Descanso · siguiente: bloque ${i + 2} de ${plan.blocks.length}`} onClose={onClose} width={480}>
        <p className="long-rest tabular">
          {mm}:{ss}
        </p>
        <p className="muted small">Levántate, toma agua. El siguiente bloque empieza solo cuando acabe la cuenta.</p>
        <div className="field-row">
          <button className="btn ghost" onClick={onClose}>
            Dejarlo aquí
          </button>
          <span className="spacer" />
          <button
            className="btn primary"
            onClick={() => {
              setResting(false);
              setI((n) => n + 1);
            }}
          >
            <Icon name="play" size={15} /> Empezar ya
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Runner
      ids={plan.blocks[i]}
      title={`Examen largo · bloque ${i + 1} de ${plan.blocks.length}`}
      minutes={plan.minutesPerBlock}
      mode={plan.mode}
      onClose={onClose}
      chain={{
        index: i,
        total: plan.blocks.length,
        onNext: (right, total, seconds) => {
          const next = [...results, { right, total, seconds }];
          setResults(next);
          if (next.length < plan.blocks.length) {
            setLeft(plan.restMinutes * 60);
            setResting(true);
          }
        },
      }}
    />
  );
}
