import { TOPICS } from '../internship/curriculum';

/**
 * Escalas y calculadoras clínicas de uso frecuente en piso y urgencias.
 * Son puntajes y fórmulas publicados; la interpretación es orientativa:
 * confirma siempre con la GPC vigente y el juicio clínico.
 */

export type Level = 'ok' | 'warn' | 'danger';
export interface Option {
  label: string;
  points: number;
}
export type Field =
  | { id: string; label: string; type: 'check'; points: number }
  | { id: string; label: string; type: 'select'; options: Option[] }
  | { id: string; label: string; type: 'number'; unit: string; min?: number; max?: number; step?: number };

export type Values = Record<string, number | boolean | undefined>;
export interface Result {
  value: string;
  interpretation: string;
  level: Level;
}

export interface Calculator {
  id: string;
  name: string;
  fields: Field[];
  compute: (v: Values) => Result | null;
  source: string;
  /** Palabras del título de los temas donde aparece. */
  topicKeys: string[];
}

const sumPoints = (fields: Field[], v: Values): number | null => {
  let total = 0;
  for (const f of fields) {
    if (f.type === 'check') total += v[f.id] ? f.points : 0;
    else if (f.type === 'select') {
      const idx = v[f.id];
      if (typeof idx !== 'number') return null; // falta contestar
      total += f.options[idx].points;
    }
  }
  return total;
};
const num = (v: Values, id: string) => (typeof v[id] === 'number' && !Number.isNaN(v[id]) ? (v[id] as number) : null);
const fmt = (n: number, d = 1) => n.toLocaleString('es-MX', { maximumFractionDigits: d, minimumFractionDigits: 0 });

const glasgow: Field[] = [
  { id: 'o', label: 'Apertura ocular', type: 'select', options: [
    { label: 'Espontánea', points: 4 }, { label: 'Al estímulo verbal', points: 3 }, { label: 'Al dolor', points: 2 }, { label: 'Ninguna', points: 1 }] },
  { id: 'v', label: 'Respuesta verbal', type: 'select', options: [
    { label: 'Orientado', points: 5 }, { label: 'Confuso', points: 4 }, { label: 'Palabras inapropiadas', points: 3 }, { label: 'Sonidos incomprensibles', points: 2 }, { label: 'Ninguna', points: 1 }] },
  { id: 'm', label: 'Respuesta motora', type: 'select', options: [
    { label: 'Obedece órdenes', points: 6 }, { label: 'Localiza el dolor', points: 5 }, { label: 'Retira al dolor', points: 4 }, { label: 'Flexión anormal (decorticación)', points: 3 }, { label: 'Extensión (descerebración)', points: 2 }, { label: 'Ninguna', points: 1 }] },
];

const wellsTep: Field[] = [
  { id: 'a', label: 'Signos clínicos de TVP', type: 'check', points: 3 },
  { id: 'b', label: 'TEP es el diagnóstico más probable', type: 'check', points: 3 },
  { id: 'c', label: 'FC > 100 lpm', type: 'check', points: 1.5 },
  { id: 'd', label: 'Inmovilización ≥ 3 días o cirugía en las últimas 4 semanas', type: 'check', points: 1.5 },
  { id: 'e', label: 'TVP o TEP previos', type: 'check', points: 1.5 },
  { id: 'f', label: 'Hemoptisis', type: 'check', points: 1 },
  { id: 'g', label: 'Cáncer activo', type: 'check', points: 1 },
];

const wellsTvp: Field[] = [
  { id: 'a', label: 'Cáncer activo', type: 'check', points: 1 },
  { id: 'b', label: 'Parálisis, paresia o inmovilización con yeso de la extremidad', type: 'check', points: 1 },
  { id: 'c', label: 'Encamado > 3 días o cirugía mayor en 12 semanas', type: 'check', points: 1 },
  { id: 'd', label: 'Dolor a lo largo del sistema venoso profundo', type: 'check', points: 1 },
  { id: 'e', label: 'Toda la pierna edematizada', type: 'check', points: 1 },
  { id: 'f', label: 'Pantorrilla > 3 cm más gruesa que la contralateral', type: 'check', points: 1 },
  { id: 'g', label: 'Edema con fóvea solo en la pierna sintomática', type: 'check', points: 1 },
  { id: 'h', label: 'Venas superficiales colaterales (no varicosas)', type: 'check', points: 1 },
  { id: 'i', label: 'TVP documentada previamente', type: 'check', points: 1 },
  { id: 'j', label: 'Diagnóstico alternativo igual o más probable', type: 'check', points: -2 },
];

const curb: Field[] = [
  { id: 'c', label: 'Confusión', type: 'check', points: 1 },
  { id: 'u', label: 'Urea > 7 mmol/L (BUN > 19 mg/dL)', type: 'check', points: 1 },
  { id: 'r', label: 'FR ≥ 30 rpm', type: 'check', points: 1 },
  { id: 'b', label: 'PAS < 90 o PAD ≤ 60 mmHg', type: 'check', points: 1 },
  { id: 'a', label: 'Edad ≥ 65 años', type: 'check', points: 1 },
];

const qsofa: Field[] = [
  { id: 'r', label: 'FR ≥ 22 rpm', type: 'check', points: 1 },
  { id: 'm', label: 'Alteración del estado mental', type: 'check', points: 1 },
  { id: 'p', label: 'PAS ≤ 100 mmHg', type: 'check', points: 1 },
];

const chads: Field[] = [
  { id: 'c', label: 'Insuficiencia cardiaca', type: 'check', points: 1 },
  { id: 'h', label: 'Hipertensión', type: 'check', points: 1 },
  { id: 'a2', label: 'Edad ≥ 75 años', type: 'check', points: 2 },
  { id: 'd', label: 'Diabetes', type: 'check', points: 1 },
  { id: 's', label: 'EVC, AIT o tromboembolia previa', type: 'check', points: 2 },
  { id: 'v', label: 'Enfermedad vascular (IAM, EAP, placa aórtica)', type: 'check', points: 1 },
  { id: 'a1', label: 'Edad 65–74 años', type: 'check', points: 1 },
  { id: 'f', label: 'Sexo femenino', type: 'check', points: 1 },
];

const centor: Field[] = [
  { id: 'f', label: 'Fiebre > 38 °C', type: 'check', points: 1 },
  { id: 'c', label: 'Ausencia de tos', type: 'check', points: 1 },
  { id: 'a', label: 'Adenopatía cervical anterior dolorosa', type: 'check', points: 1 },
  { id: 'e', label: 'Hipertrofia o exudado amigdalino', type: 'check', points: 1 },
  { id: 'age', label: 'Edad', type: 'select', options: [{ label: '3–14 años', points: 1 }, { label: '15–44 años', points: 0 }, { label: '≥ 45 años', points: -1 }] },
];

const apgar: Field[] = [
  { id: 'fc', label: 'Frecuencia cardiaca', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: '< 100 lpm', points: 1 }, { label: '≥ 100 lpm', points: 2 }] },
  { id: 'r', label: 'Esfuerzo respiratorio', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: 'Lento, irregular', points: 1 }, { label: 'Bueno, llanto', points: 2 }] },
  { id: 't', label: 'Tono muscular', type: 'select', options: [{ label: 'Flácido', points: 0 }, { label: 'Cierta flexión', points: 1 }, { label: 'Movimiento activo', points: 2 }] },
  { id: 'i', label: 'Irritabilidad refleja', type: 'select', options: [{ label: 'Sin respuesta', points: 0 }, { label: 'Mueca', points: 1 }, { label: 'Llanto, tos o estornudo', points: 2 }] },
  { id: 'c', label: 'Color', type: 'select', options: [{ label: 'Cianosis o palidez', points: 0 }, { label: 'Acrocianosis', points: 1 }, { label: 'Completamente rosado', points: 2 }] },
];

const silverman: Field[] = [
  { id: 'm', label: 'Movimientos toracoabdominales', type: 'select', options: [{ label: 'Rítmicos y regulares', points: 0 }, { label: 'Tórax inmóvil, abdomen en movimiento', points: 1 }, { label: 'Disociación toracoabdominal', points: 2 }] },
  { id: 't', label: 'Tiraje intercostal', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: 'Discreto', points: 1 }, { label: 'Acentuado', points: 2 }] },
  { id: 'x', label: 'Retracción xifoidea', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: 'Discreta', points: 1 }, { label: 'Muy marcada', points: 2 }] },
  { id: 'a', label: 'Aleteo nasal', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: 'Discreto', points: 1 }, { label: 'Muy acentuado', points: 2 }] },
  { id: 'q', label: 'Quejido espiratorio', type: 'select', options: [{ label: 'Ausente', points: 0 }, { label: 'Audible con estetoscopio', points: 1 }, { label: 'Audible sin estetoscopio', points: 2 }] },
];

const bishop: Field[] = [
  { id: 'd', label: 'Dilatación', type: 'select', options: [{ label: 'Cerrado', points: 0 }, { label: '1–2 cm', points: 1 }, { label: '3–4 cm', points: 2 }, { label: '≥ 5 cm', points: 3 }] },
  { id: 'b', label: 'Borramiento', type: 'select', options: [{ label: '0–30 %', points: 0 }, { label: '40–50 %', points: 1 }, { label: '60–70 %', points: 2 }, { label: '≥ 80 %', points: 3 }] },
  { id: 'e', label: 'Estación', type: 'select', options: [{ label: '−3', points: 0 }, { label: '−2', points: 1 }, { label: '−1 / 0', points: 2 }, { label: '+1 / +2', points: 3 }] },
  { id: 'c', label: 'Consistencia', type: 'select', options: [{ label: 'Firme', points: 0 }, { label: 'Media', points: 1 }, { label: 'Blanda', points: 2 }] },
  { id: 'p', label: 'Posición', type: 'select', options: [{ label: 'Posterior', points: 0 }, { label: 'Media', points: 1 }, { label: 'Anterior', points: 2 }] },
];

const alvarado: Field[] = [
  { id: 'm', label: 'Dolor migratorio a fosa ilíaca derecha', type: 'check', points: 1 },
  { id: 'a', label: 'Anorexia', type: 'check', points: 1 },
  { id: 'n', label: 'Náusea o vómito', type: 'check', points: 1 },
  { id: 'd', label: 'Dolor en fosa ilíaca derecha', type: 'check', points: 2 },
  { id: 'r', label: 'Rebote', type: 'check', points: 1 },
  { id: 'f', label: 'Temperatura > 37.3 °C', type: 'check', points: 1 },
  { id: 'l', label: 'Leucocitosis > 10 000', type: 'check', points: 2 },
  { id: 's', label: 'Neutrofilia (desviación a la izquierda)', type: 'check', points: 1 },
];

const childPugh: Field[] = [
  { id: 'b', label: 'Bilirrubina total', type: 'select', options: [{ label: '< 2 mg/dL', points: 1 }, { label: '2–3 mg/dL', points: 2 }, { label: '> 3 mg/dL', points: 3 }] },
  { id: 'a', label: 'Albúmina', type: 'select', options: [{ label: '> 3.5 g/dL', points: 1 }, { label: '2.8–3.5 g/dL', points: 2 }, { label: '< 2.8 g/dL', points: 3 }] },
  { id: 'i', label: 'INR', type: 'select', options: [{ label: '< 1.7', points: 1 }, { label: '1.7–2.3', points: 2 }, { label: '> 2.3', points: 3 }] },
  { id: 'as', label: 'Ascitis', type: 'select', options: [{ label: 'Ausente', points: 1 }, { label: 'Leve', points: 2 }, { label: 'Moderada a grave', points: 3 }] },
  { id: 'e', label: 'Encefalopatía', type: 'select', options: [{ label: 'Ausente', points: 1 }, { label: 'Grado 1–2', points: 2 }, { label: 'Grado 3–4', points: 3 }] },
];

export const CALCULATORS: Calculator[] = [
  {
    id: 'glasgow',
    name: 'Escala de coma de Glasgow',
    fields: glasgow,
    source: 'Teasdale y Jennett, 1974',
    topicKeys: ['Traumatismo craneoencefálico', 'Evaluación primaria', 'Enfermedad vascular cerebral', 'Estado epiléptico'],
    compute: (v) => {
      const s = sumPoints(glasgow, v);
      if (s === null) return null;
      return s <= 8
        ? { value: `${s}/15`, interpretation: 'Grave (≤ 8): proteger la vía aérea.', level: 'danger' }
        : s <= 12
          ? { value: `${s}/15`, interpretation: 'Moderado (9–12).', level: 'warn' }
          : { value: `${s}/15`, interpretation: 'Leve (13–15).', level: 'ok' };
    },
  },
  {
    id: 'wellsTep',
    name: 'Wells para TEP',
    fields: wellsTep,
    source: 'Wells et al., 2000',
    topicKeys: ['Tromboembolia pulmonar'],
    compute: (v) => {
      const s = sumPoints(wellsTep, v)!;
      return s > 4
        ? { value: fmt(s), interpretation: 'TEP probable (> 4): estudio de imagen (angio-TC).', level: 'danger' }
        : { value: fmt(s), interpretation: 'TEP poco probable (≤ 4): dímero D para descartar.', level: 'ok' };
    },
  },
  {
    id: 'wellsTvp',
    name: 'Wells para TVP',
    fields: wellsTvp,
    source: 'Wells et al., 2003',
    topicKeys: ['trombosis venosa profunda'],
    compute: (v) => {
      const s = sumPoints(wellsTvp, v)!;
      return s >= 2
        ? { value: fmt(s), interpretation: 'TVP probable (≥ 2): ultrasonido Doppler.', level: 'danger' }
        : { value: fmt(s), interpretation: 'TVP poco probable (< 2): dímero D.', level: 'ok' };
    },
  },
  {
    id: 'curb65',
    name: 'CURB-65',
    fields: curb,
    source: 'Lim et al., 2003',
    topicKeys: ['Neumonía adquirida'],
    compute: (v) => {
      const s = sumPoints(curb, v)!;
      return s >= 3
        ? { value: `${s}/5`, interpretation: `Riesgo alto: hospitalizar${s >= 4 ? '; valorar UCI' : ''}.`, level: 'danger' }
        : s === 2
          ? { value: `${s}/5`, interpretation: 'Riesgo intermedio: considerar hospitalización.', level: 'warn' }
          : { value: `${s}/5`, interpretation: 'Riesgo bajo: manejo ambulatorio posible.', level: 'ok' };
    },
  },
  {
    id: 'qsofa',
    name: 'qSOFA',
    fields: qsofa,
    source: 'Sepsis-3, Seymour et al., 2016',
    topicKeys: ['Sepsis y choque'],
    compute: (v) => {
      const s = sumPoints(qsofa, v)!;
      return s >= 2
        ? { value: `${s}/3`, interpretation: 'Positivo (≥ 2): mayor riesgo de mal pronóstico; buscar disfunción orgánica (SOFA).', level: 'danger' }
        : { value: `${s}/3`, interpretation: 'Negativo: no descarta sepsis; reevaluar.', level: 'ok' };
    },
  },
  {
    id: 'chads',
    name: 'CHA₂DS₂-VASc',
    fields: chads,
    source: 'Lip et al., 2010',
    topicKeys: ['Fibrilación auricular'],
    compute: (v) => {
      const s = sumPoints(chads, v)!;
      const female = !!v.f;
      const base = s - (female ? 1 : 0); // riesgo sin contar el sexo
      return base >= 2
        ? { value: `${s}`, interpretation: 'Anticoagulación oral recomendada.', level: 'danger' }
        : base === 1
          ? { value: `${s}`, interpretation: 'Considerar anticoagulación oral.', level: 'warn' }
          : { value: `${s}`, interpretation: 'Riesgo bajo: sin anticoagulación.', level: 'ok' };
    },
  },
  {
    id: 'centor',
    name: 'Centor (McIsaac)',
    fields: centor,
    source: 'McIsaac et al., 1998',
    topicKeys: ['Faringoamigdalitis'],
    compute: (v) => {
      const s = sumPoints(centor, v);
      if (s === null) return null;
      return s >= 4
        ? { value: `${s}`, interpretation: 'Alta probabilidad de estreptococo: prueba rápida/cultivo o tratamiento según GPC.', level: 'danger' }
        : s >= 2
          ? { value: `${s}`, interpretation: 'Probabilidad intermedia: prueba rápida o cultivo.', level: 'warn' }
          : { value: `${s}`, interpretation: 'Baja probabilidad: sin prueba ni antibiótico.', level: 'ok' };
    },
  },
  {
    id: 'apgar',
    name: 'APGAR',
    fields: apgar,
    source: 'Apgar, 1953',
    topicKeys: ['reanimación del recién nacido'],
    compute: (v) => {
      const s = sumPoints(apgar, v);
      if (s === null) return null;
      return s >= 7
        ? { value: `${s}/10`, interpretation: 'Normal (7–10).', level: 'ok' }
        : s >= 4
          ? { value: `${s}/10`, interpretation: 'Depresión moderada (4–6).', level: 'warn' }
          : { value: `${s}/10`, interpretation: 'Depresión grave (0–3).', level: 'danger' };
    },
  },
  {
    id: 'silverman',
    name: 'Silverman-Andersen',
    fields: silverman,
    source: 'Silverman y Andersen, 1956',
    topicKeys: ['Dificultad respiratoria del recién nacido', 'reanimación del recién nacido'],
    compute: (v) => {
      const s = sumPoints(silverman, v);
      if (s === null) return null;
      return s === 0
        ? { value: `${s}/10`, interpretation: 'Sin dificultad respiratoria.', level: 'ok' }
        : s <= 3
          ? { value: `${s}/10`, interpretation: 'Dificultad leve (1–3).', level: 'ok' }
          : s <= 6
            ? { value: `${s}/10`, interpretation: 'Dificultad moderada (4–6).', level: 'warn' }
            : { value: `${s}/10`, interpretation: 'Dificultad grave (7–10).', level: 'danger' };
    },
  },
  {
    id: 'bishop',
    name: 'Bishop',
    fields: bishop,
    source: 'Bishop, 1964',
    topicKeys: ['Trabajo de parto'],
    compute: (v) => {
      const s = sumPoints(bishop, v);
      if (s === null) return null;
      return s >= 8
        ? { value: `${s}/13`, interpretation: 'Cérvix favorable (≥ 8).', level: 'ok' }
        : s >= 7
          ? { value: `${s}/13`, interpretation: 'Intermedio (7).', level: 'warn' }
          : { value: `${s}/13`, interpretation: 'Cérvix desfavorable (≤ 6): considerar maduración cervical.', level: 'warn' };
    },
  },
  {
    id: 'alvarado',
    name: 'Alvarado',
    fields: alvarado,
    source: 'Alvarado, 1986',
    topicKeys: ['Apendicitis', 'Abdomen agudo'],
    compute: (v) => {
      const s = sumPoints(alvarado, v)!;
      return s >= 9
        ? { value: `${s}/10`, interpretation: 'Muy probable (9–10).', level: 'danger' }
        : s >= 7
          ? { value: `${s}/10`, interpretation: 'Probable (7–8).', level: 'danger' }
          : s >= 5
            ? { value: `${s}/10`, interpretation: 'Posible (5–6): observación o imagen.', level: 'warn' }
            : { value: `${s}/10`, interpretation: 'Poco probable (≤ 4).', level: 'ok' };
    },
  },
  {
    id: 'childPugh',
    name: 'Child-Pugh',
    fields: childPugh,
    source: 'Pugh et al., 1973',
    topicKeys: ['Cirrosis'],
    compute: (v) => {
      const s = sumPoints(childPugh, v);
      if (s === null) return null;
      return s <= 6
        ? { value: `${s} · A`, interpretation: 'Clase A (5–6): enfermedad compensada.', level: 'ok' }
        : s <= 9
          ? { value: `${s} · B`, interpretation: 'Clase B (7–9): compromiso funcional significativo.', level: 'warn' }
          : { value: `${s} · C`, interpretation: 'Clase C (10–15): enfermedad descompensada.', level: 'danger' };
    },
  },
  {
    id: 'parkland',
    name: 'Parkland (reanimación en quemaduras)',
    fields: [
      { id: 'kg', label: 'Peso', type: 'number', unit: 'kg', min: 1, max: 300 },
      { id: 'scq', label: 'Superficie corporal quemada (2º profundo y 3er grado)', type: 'number', unit: '%', min: 1, max: 100 },
    ],
    source: 'Baxter, 1968',
    topicKeys: ['Quemaduras'],
    compute: (v) => {
      const kg = num(v, 'kg');
      const scq = num(v, 'scq');
      if (kg === null || scq === null) return null;
      const total = 4 * kg * scq;
      return {
        value: `${fmt(total, 0)} mL / 24 h`,
        interpretation: `Ringer lactato: ${fmt(total / 2, 0)} mL en las primeras 8 h (desde la hora de la quemadura) y ${fmt(total / 2, 0)} mL en las 16 h siguientes. Ajustar por diuresis.`,
        level: 'warn',
      };
    },
  },
  {
    id: 'naCorr',
    name: 'Sodio corregido por glucosa',
    fields: [
      { id: 'na', label: 'Sodio medido', type: 'number', unit: 'mEq/L', min: 90, max: 200 },
      { id: 'glu', label: 'Glucosa', type: 'number', unit: 'mg/dL', min: 20, max: 3000 },
    ],
    source: 'Katz, 1973 (factor 1.6)',
    topicKeys: ['Cetoacidosis', 'Trastornos del sodio'],
    compute: (v) => {
      const na = num(v, 'na');
      const glu = num(v, 'glu');
      if (na === null || glu === null) return null;
      const c = na + (1.6 * (glu - 100)) / 100;
      return { value: `${fmt(c)} mEq/L`, interpretation: c < 135 ? 'Hiponatremia verdadera.' : c > 145 ? 'Hipernatremia.' : 'Sodio corregido normal (135–145).', level: c < 135 || c > 145 ? 'warn' : 'ok' };
    },
  },
  {
    id: 'anionGap',
    name: 'Brecha aniónica',
    fields: [
      { id: 'na', label: 'Sodio', type: 'number', unit: 'mEq/L', min: 90, max: 200 },
      { id: 'cl', label: 'Cloro', type: 'number', unit: 'mEq/L', min: 50, max: 160 },
      { id: 'hco3', label: 'Bicarbonato', type: 'number', unit: 'mEq/L', min: 1, max: 60 },
    ],
    source: 'Na − (Cl + HCO₃)',
    topicKeys: ['Trastornos ácido-base', 'Cetoacidosis'],
    compute: (v) => {
      const na = num(v, 'na');
      const cl = num(v, 'cl');
      const h = num(v, 'hco3');
      if (na === null || cl === null || h === null) return null;
      const ag = na - (cl + h);
      return ag > 12
        ? { value: `${fmt(ag)} mEq/L`, interpretation: 'Elevada (> 12): acidosis metabólica con brecha aumentada.', level: 'warn' }
        : { value: `${fmt(ag)} mEq/L`, interpretation: 'Normal (8–12 aprox.).', level: 'ok' };
    },
  },
  {
    id: 'ckdepi',
    name: 'TFG estimada (CKD-EPI 2021)',
    fields: [
      { id: 'cr', label: 'Creatinina sérica', type: 'number', unit: 'mg/dL', min: 0.1, max: 20, step: 0.01 },
      { id: 'age', label: 'Edad', type: 'number', unit: 'años', min: 18, max: 110 },
      { id: 'sex', label: 'Sexo', type: 'select', options: [{ label: 'Hombre', points: 0 }, { label: 'Mujer', points: 1 }] },
    ],
    source: 'Inker et al., NEJM 2021 (sin raza)',
    topicKeys: ['Enfermedad renal crónica', 'Lesión renal aguda'],
    compute: (v) => {
      const cr = num(v, 'cr');
      const age = num(v, 'age');
      if (cr === null || age === null || typeof v.sex !== 'number') return null;
      const female = v.sex === 1;
      const k = female ? 0.7 : 0.9;
      const a = female ? -0.241 : -0.302;
      const egfr = 142 * Math.min(cr / k, 1) ** a * Math.max(cr / k, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
      const g = egfr >= 90 ? 'G1' : egfr >= 60 ? 'G2' : egfr >= 45 ? 'G3a' : egfr >= 30 ? 'G3b' : egfr >= 15 ? 'G4' : 'G5';
      return { value: `${fmt(egfr, 0)} mL/min/1.73 m²`, interpretation: `Categoría ${g} (KDIGO).`, level: egfr < 30 ? 'danger' : egfr < 60 ? 'warn' : 'ok' };
    },
  },
  {
    id: 'imc',
    name: 'Índice de masa corporal (adulto)',
    fields: [
      { id: 'kg', label: 'Peso', type: 'number', unit: 'kg', min: 2, max: 400 },
      { id: 'cm', label: 'Talla', type: 'number', unit: 'cm', min: 50, max: 250 },
    ],
    source: 'OMS',
    topicKeys: ['Detección de diabetes', 'Diabetes mellitus tipo 2'],
    compute: (v) => {
      const kg = num(v, 'kg');
      const cm = num(v, 'cm');
      if (kg === null || cm === null) return null;
      const b = kg / (cm / 100) ** 2;
      const c = b < 18.5 ? 'Bajo peso' : b < 25 ? 'Normal' : b < 30 ? 'Sobrepeso' : b < 35 ? 'Obesidad grado I' : b < 40 ? 'Obesidad grado II' : 'Obesidad grado III';
      return { value: `${fmt(b)} kg/m²`, interpretation: c, level: b >= 30 || b < 18.5 ? 'warn' : 'ok' };
    },
  },
];

/** Calculadoras relevantes para un tema. */
export function calculatorsForTopic(topicId: string): Calculator[] {
  const t = TOPICS.find((x) => x.id === topicId);
  if (!t) return [];
  const title = t.title.toLowerCase();
  return CALCULATORS.filter((c) => c.topicKeys.some((k) => title.includes(k.toLowerCase())));
}
