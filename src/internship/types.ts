/* Modelo de datos del módulo de Internado. */

export type SpecialtyId = 'mi' | 'cg' | 'go' | 'ped' | 'urg' | 'sp';

export interface Specialty {
  id: SpecialtyId;
  name: string;
  short: string;
  color: string;
}

/** Tema del temario. `yield` = prioridad sugerida para ENARM (3 alta · 1 baja), editable a futuro. */
export interface Topic {
  id: string;
  specialty: SpecialtyId;
  title: string;
  minutes: number;
  yield: 1 | 2 | 3;
  /** Términos para buscar la GPC (si difieren del título). */
  gpc?: string;
}

export interface Rotation {
  id: string;
  specialty: SpecialtyId;
  start: string; // YYYY-MM-DD
  end: string;
}

export interface InternshipConfig {
  start: string;
  end: string;
  rotations: Rotation[];
  /** 0 = sin guardias · 3 = ABC (cada 3er día) · 4 = ABCD. */
  guardiaEvery: 0 | 3 | 4;
  firstGuardia: string;
  dailyMinutes: number;
  weekendMinutes: number;
  /** Minutos el día de guardia (solo repaso breve). */
  guardiaMinutes: number;
  /** Fracción de la carga normal el día después de guardia. */
  postGuardiaFactor: number;
  /** Semanas finales dedicadas a repaso integral. */
  reviewWeeks: number;
  /** Fracción del tiempo de temas nuevos dedicada a la especialidad de la rotación actual. */
  primaryShare: number;
}

export type LessonKind = 'new' | 'review' | 'final';

export interface Lesson {
  /** Identificador estable: `${topicId}:${parte}` · `${topicId}:r${n}` · `${topicId}:f${n}` */
  id: string;
  topicId: string;
  minutes: number;
  kind: LessonKind;
  part: number;
  parts: number;
  /** Si se reprogramó (Modo supervivencia): fecha original. */
  movedFrom?: string;
  /** Repaso de refuerzo agregado por tus resultados (tema débil). */
  adaptive?: boolean;
}

export interface DayPlan {
  date: string;
  rotation?: SpecialtyId;
  guardia: boolean;
  postGuardia: boolean;
  capacity: number;
  lessons: Lesson[];
}
