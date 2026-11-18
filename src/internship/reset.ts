import { idb } from '../lib/idb';
import { downloadBackup } from '../lib/backup';
import { flushPersistence, freezePersistence } from '../lib/createStore';

/** Cada cosa que se puede reiniciar por separado, con lo que de verdad borra. */
export interface Parte {
  id: string;
  label: string;
  detalle: string;
  /** Claves de IndexedDB (almacén kv) que se vacían. */
  kv?: string[];
  /** Claves de localStorage que se vacían. */
  local?: string[];
  /** Si se vacía entero o solo una parte del objeto guardado. */
  parcial?: (previo: Record<string, unknown>) => Record<string, unknown>;
}

export const PARTES: Parte[] = [
  {
    id: 'progreso',
    label: 'Progreso del temario',
    detalle: 'Las lecciones que marcaste como hechas, los días en supervivencia y las lecciones movidas. El plan y sus fechas se conservan.',
    local: ['alq:internship'],
    parcial: (p) => ({ ...p, done: {}, survival: {}, shifts: {} }),
  },
  {
    id: 'plan',
    label: 'El plan completo',
    detalle: 'Además del progreso, borra la configuración: fecha de inicio, rotaciones, guardias y minutos. Vuelve a salir el asistente.',
    local: ['alq:internship'],
  },
  {
    id: 'temario',
    label: 'Tus cambios al temario',
    detalle: 'Los temas que agregaste, renombraste o quitaste. Vuelven los 139 originales.',
    kv: ['curriculum'],
  },
  {
    id: 'tarjetas',
    label: 'Flashcards',
    detalle: 'Todas tus tarjetas y su programación de repaso.',
    kv: ['cards'],
  },
  {
    id: 'simulacros',
    label: 'Simulacros',
    detalle: 'El banco de preguntas y el historial de intentos.',
    kv: ['exam'],
  },
  {
    id: 'clinico',
    label: 'Fichas de guardia y casos',
    detalle: 'Las fichas que llenaste con tu GPC, los casos registrados y los documentos vinculados a cada tema.',
    kv: ['topics'],
  },
  {
    id: 'bitacora',
    label: 'Bitácora',
    detalle: 'Procedimientos contados y diario de reflexión.',
    kv: ['logbook'],
  },
];

/** Lo que nunca toca esta pantalla, por si la duda frena a alguien. */
export const INTOCABLE = 'Tus notas, cuadernos, lienzos, perlas HY y los PDF que subiste no se tocan aquí.';

/**
 * Reinicia lo elegido. Antes descarga un respaldo completo: esto no se puede deshacer
 * y nadie debería perder un año por un clic.
 */
export async function reiniciar(ids: string[], conRespaldo = true): Promise<void> {
  if (ids.length === 0) return;
  if (conRespaldo) await downloadBackup(false);

  await flushPersistence();
  // Se congela la persistencia para que ningún store vuelva a escribir lo que acabamos
  // de borrar antes de que la app recargue.
  freezePersistence();

  const partes = PARTES.filter((p) => ids.includes(p.id));
  // «El plan completo» incluye el progreso: si están los dos, el parcial sobra.
  const planEntero = ids.includes('plan');

  for (const p of partes) {
    for (const k of p.kv ?? []) await idb.del('kv', k);
    for (const k of p.local ?? []) {
      if (p.parcial && !planEntero) {
        const previo = localStorage.getItem(k);
        if (!previo) continue;
        try {
          localStorage.setItem(k, JSON.stringify(p.parcial(JSON.parse(previo))));
        } catch {
          localStorage.removeItem(k);
        }
      } else {
        localStorage.removeItem(k);
      }
    }
  }
}
