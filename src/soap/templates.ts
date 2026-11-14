import { createStore } from '../lib/createStore';

/**
 * Plantillas de notas médicas con los apartados que pide la NOM-004-SSA3-2012
 * (fecha y hora, signos vitales, evolución, resultados, diagnóstico, pronóstico, plan,
 * nombre y firma de quien elabora). El contenido clínico sale de TU ficha de guardia
 * y de lo que escribas: la app no inventa dosis ni hallazgos.
 *
 * Marcadores: {{campo}}. Un campo vacío se imprime como «___» para que se note qué falta.
 */
export type NoteType = 'evolucion' | 'ingreso' | 'postqx' | 'egreso';

export const NOTE_TYPES: { id: NoteType; label: string }[] = [
  { id: 'evolucion', label: 'Nota de evolución (SOAP)' },
  { id: 'ingreso', label: 'Nota de ingreso' },
  { id: 'postqx', label: 'Nota postquirúrgica' },
  { id: 'egreso', label: 'Nota de egreso' },
];

export const FIELDS: { id: string; label: string; group: 'pac' | 'sv' | 'clin' }[] = [
  { id: 'sexo', label: 'Sexo', group: 'pac' },
  { id: 'edad', label: 'Edad (años)', group: 'pac' },
  { id: 'servicio', label: 'Servicio', group: 'pac' },
  { id: 'dia', label: 'Día de estancia / POP', group: 'pac' },
  { id: 'ta', label: 'TA (mmHg)', group: 'sv' },
  { id: 'fc', label: 'FC (lpm)', group: 'sv' },
  { id: 'fr', label: 'FR (rpm)', group: 'sv' },
  { id: 'temp', label: 'Temp (°C)', group: 'sv' },
  { id: 'sat', label: 'SatO₂ (%)', group: 'sv' },
  { id: 'gluc', label: 'Glucosa capilar (mg/dL)', group: 'sv' },
  { id: 'subjetivo', label: 'S · Subjetivo (lo que refiere)', group: 'clin' },
  { id: 'exploracion', label: 'O · Exploración física', group: 'clin' },
  { id: 'labs', label: 'O · Laboratorio y gabinete', group: 'clin' },
  { id: 'analisis', label: 'A · Análisis / evolución', group: 'clin' },
  { id: 'plan', label: 'P · Plan e indicaciones', group: 'clin' },
  { id: 'pronostico', label: 'Pronóstico', group: 'clin' },
  { id: 'cirugia', label: 'Cirugía realizada / hallazgos', group: 'clin' },
];

export const DEFAULT_TEMPLATES: Record<NoteType, string> = {
  evolucion: `NOTA DE EVOLUCIÓN
Fecha: {{fecha}}   Hora: {{hora}}   Servicio: {{servicio}}
Paciente {{sexo}} de {{edad}} años, en su día {{dia}} de estancia hospitalaria, con diagnóstico de {{dx}}.

S: {{subjetivo}}

O: TA {{ta}} mmHg · FC {{fc}} lpm · FR {{fr}} rpm · Temp {{temp}} °C · SatO₂ {{sat}} % · Glucosa capilar {{gluc}} mg/dL
Exploración física: {{exploracion}}
Laboratorio y gabinete: {{labs}}

A: {{analisis}}
Criterios diagnósticos de referencia (GPC):
{{criterios}}

P: {{plan}}
Manejo de referencia según GPC:
{{plan_gpc}}
Vigilar criterios de referencia / datos de alarma:
{{referencia}}

Pronóstico: {{pronostico}}

Elaboró: ________________________   Cédula: ____________   Firma: ____________`,
  ingreso: `NOTA DE INGRESO
Fecha: {{fecha}}   Hora: {{hora}}   Servicio: {{servicio}}
Paciente {{sexo}} de {{edad}} años que ingresa con diagnóstico de {{dx}}.

Padecimiento actual: {{subjetivo}}

Signos vitales: TA {{ta}} mmHg · FC {{fc}} lpm · FR {{fr}} rpm · Temp {{temp}} °C · SatO₂ {{sat}} % · Glucosa capilar {{gluc}} mg/dL
Exploración física: {{exploracion}}
Laboratorio y gabinete: {{labs}}

Análisis: {{analisis}}
Criterios diagnósticos de referencia (GPC):
{{criterios}}

Diagnóstico(s): {{dx}}
Plan: {{plan}}
Manejo de referencia según GPC:
{{plan_gpc}}

Pronóstico: {{pronostico}}

Elaboró: ________________________   Cédula: ____________   Firma: ____________`,
  postqx: `NOTA POSTQUIRÚRGICA
Fecha: {{fecha}}   Hora: {{hora}}   Servicio: {{servicio}}
Paciente {{sexo}} de {{edad}} años, POP día {{dia}}, diagnóstico preoperatorio: {{dx}}.

Cirugía realizada y hallazgos: {{cirugia}}

S: {{subjetivo}}
O: TA {{ta}} mmHg · FC {{fc}} lpm · FR {{fr}} rpm · Temp {{temp}} °C · SatO₂ {{sat}} %
Exploración física (herida, drenajes, peristalsis): {{exploracion}}
Laboratorio: {{labs}}

A: {{analisis}}
P: {{plan}}
Datos de alarma a vigilar:
{{referencia}}

Pronóstico: {{pronostico}}

Elaboró: ________________________   Cédula: ____________   Firma: ____________`,
  egreso: `NOTA DE EGRESO
Fecha: {{fecha}}   Hora: {{hora}}   Servicio: {{servicio}}
Paciente {{sexo}} de {{edad}} años, {{dia}} días de estancia, diagnóstico de ingreso y de egreso: {{dx}}.

Resumen de la evolución: {{analisis}}
Signos vitales al egreso: TA {{ta}} mmHg · FC {{fc}} lpm · FR {{fr}} rpm · Temp {{temp}} °C · SatO₂ {{sat}} %
Estudios relevantes: {{labs}}

Motivo de egreso: mejoría.
Indicaciones al egreso: {{plan}}
Acudir a urgencias en caso de:
{{referencia}}

Pronóstico: {{pronostico}}

Elaboró: ________________________   Cédula: ____________   Firma: ____________`,
};

export const BLANK = '___';

/** Rellena una plantilla. Las listas (una línea = un elemento) se imprimen con viñetas. */
export function fillTemplate(tpl: string, values: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = (values[key] ?? '').trim();
    return v || BLANK;
  });
}

/** Texto multilínea de la ficha de guardia → viñetas. */
export const bullets = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `  • ${l}`)
    .join('\n');

/** Tus plantillas editadas (si no editas, se usa la de fábrica). */
export const useSoapTemplates = createStore<{
  custom: Partial<Record<NoteType, string>>;
  setTemplate: (t: NoteType, text: string | null) => void;
}>(
  (set) => ({
    custom: {},
    setTemplate: (t, text) =>
      set((s) => {
        const custom = { ...s.custom };
        if (text === null) delete custom[t];
        else custom[t] = text;
        return { custom };
      }),
  }),
  { key: 'alq:soap', storage: 'local', pick: ({ custom }) => ({ custom }) },
);
