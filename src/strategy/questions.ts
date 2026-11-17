/**
 * Dos bloques, con usos distintos a propósito:
 *
 * - «circunstancias»: tu realidad (tiempo, guardias, dónde estudias, qué te importa).
 *   Esto sí ajusta el plan, porque el plan es aritmética sobre tiempo disponible.
 * - «preferencias»: cómo te gusta trabajar. Esto NO cambia lo que se recomienda estudiar;
 *   solo decide qué herramientas de la app se te sugieren. Emparejar la enseñanza con un
 *   supuesto «estilo de aprendizaje» no mejora los resultados: está replicado que no.
 *   Lo que sí importa es que uses algo, y uno usa lo que no le pesa.
 */
export interface Q {
  id: string;
  block: 'circunstancias' | 'preferencias';
  text: string;
  options: { value: string; label: string }[];
}

export const QUESTIONS: Q[] = [
  {
    id: 'tiempo',
    block: 'circunstancias',
    text: '¿Cuánto tiempo real te queda para estudiar un día normal de rotación?',
    options: [
      { value: 'nada', label: 'Casi nada: llego muerto' },
      { value: 'poco', label: 'Media hora, si acaso' },
      { value: 'normal', label: 'Entre una y dos horas' },
      { value: 'mucho', label: 'Más de dos horas' },
    ],
  },
  {
    id: 'postguardia',
    block: 'circunstancias',
    text: 'El día después de una guardia, ¿cómo quedas?',
    options: [
      { value: 'inservible', label: 'Inservible: duermo' },
      { value: 'poco', label: 'Algo puedo, pero poco' },
      { value: 'normal', label: 'Casi como cualquier día' },
    ],
  },
  {
    id: 'cuando',
    block: 'circunstancias',
    text: '¿Cuándo estudias mejor?',
    options: [
      { value: 'manana', label: 'Temprano, antes del hospital' },
      { value: 'tarde', label: 'Al salir' },
      { value: 'noche', label: 'De noche' },
      { value: 'huecos', label: 'En huecos sueltos del día' },
    ],
  },
  {
    id: 'donde',
    block: 'circunstancias',
    text: '¿Dónde estudias la mayor parte del tiempo?',
    options: [
      { value: 'casa', label: 'En casa, con mi tableta' },
      { value: 'hospital', label: 'En el hospital, entre pendientes' },
      { value: 'transporte', label: 'En el transporte' },
      { value: 'mixto', label: 'De todo un poco' },
    ],
  },
  {
    id: 'meta',
    block: 'circunstancias',
    text: 'De aquí a un año, ¿qué te importa más?',
    options: [
      { value: 'enarm', label: 'Llegar fuerte al ENARM' },
      { value: 'internado', label: 'No quedar mal en el hospital' },
      { value: 'ambas', label: 'Las dos por igual' },
      { value: 'sobrevivir', label: 'Sobrevivir el año' },
    ],
  },
  {
    id: 'abandono',
    block: 'circunstancias',
    text: 'Cuando dejas de estudiar unos días, ¿por qué suele ser?',
    options: [
      { value: 'cansancio', label: 'Cansancio' },
      { value: 'carga', label: 'El plan me pide demasiado' },
      { value: 'aburrido', label: 'Se me hace pesado el material' },
      { value: 'olvido', label: 'Se me olvida' },
    ],
  },
  {
    id: 'formato',
    block: 'preferencias',
    text: '¿Con qué se te hace más llevadero estudiar?',
    options: [
      { value: 'escribir', label: 'Escribiendo a mano' },
      { value: 'preguntas', label: 'Contestando preguntas' },
      { value: 'esquemas', label: 'Haciendo esquemas y flujogramas' },
      { value: 'leer', label: 'Leyendo y subrayando' },
      { value: 'escuchar', label: 'Escuchando' },
    ],
  },
  {
    id: 'sesion',
    block: 'preferencias',
    text: '¿Cómo prefieres repartir el tiempo?',
    options: [
      { value: 'corto', label: 'Ratos cortos y frecuentes' },
      { value: 'largo', label: 'Sesiones largas de corrido' },
      { value: 'depende', label: 'Depende del día' },
    ],
  },
  {
    id: 'compania',
    block: 'preferencias',
    text: '¿Estudias solo o acompañado?',
    options: [
      { value: 'solo', label: 'Solo' },
      { value: 'companeros', label: 'Con compañeros' },
      { value: 'ambos', label: 'Las dos cosas' },
    ],
  },
];

export const BLOCK_NOTE: Record<Q['block'], string> = {
  circunstancias: 'Esto ajusta tu plan: el planificador reparte el temario según el tiempo que de verdad tienes.',
  preferencias:
    'Esto no cambia qué estudiar ni cómo se programa. Solo decide qué herramientas de la app te sugiero, porque la que no te pesa es la que de verdad acabas usando.',
};
