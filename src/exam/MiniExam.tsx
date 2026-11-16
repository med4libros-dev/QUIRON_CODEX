import { useMemo } from 'react';
import { questionStats, useExam } from './store';
import { Runner } from './ExamView';
import { useUI } from '../store/ui';

/**
 * Mini-examen del día: cinco casos de los temas que te tocaban hoy, en modo estudio
 * (explicación y cita de la GPC en cuanto respondes).
 *
 * Solo usa el banco que ya tienes; si no hay preguntas de esos temas, lo dice y no inventa nada.
 */
export function MiniExam({ topicIds, onClose }: { topicIds: string[]; onClose: () => void }) {
  const questions = useExam((s) => s.questions);
  const attempts = useExam((s) => s.attempts);
  const stats = useMemo(() => questionStats(attempts, questions), [attempts, questions]);

  const ids = useMemo(() => {
    const pool = questions.filter((q) => q.topicId && topicIds.includes(q.topicId));
    const rank = (id: string, asked?: boolean) => {
      const s = stats.get(id);
      return (!s ? 0 : !s.last ? 1 : 2) - (asked ? 0.5 : 0);
    };
    return [...pool]
      .map((q) => ({ q, r: rank(q.id, q.asked), k: Math.random() }))
      .sort((a, b) => a.r - b.r || a.k - b.k)
      .slice(0, 5)
      .map((x) => x.q.id);
  }, [questions, topicIds, stats]);

  if (!ids.length) {
    useUI.getState().showToast('Todavía no hay preguntas de los temas de hoy. Genéralas en Simulacros desde tu GPC.');
    onClose();
    return null;
  }

  return <Runner ids={ids} title="Mini-examen del día" minutes={Math.max(3, ids.length)} mode="study" onClose={onClose} />;
}
