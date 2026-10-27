import type { CustomList, ListSection, TaskItem } from '../models/Task';

export interface ExerciseAlternative {
  name: string;
  equipment: string;
  note: string;
}

export interface GymExerciseInfo {
  id: string;
  name: string;
  synonyms: string[];
  category: 'pecho' | 'espalda' | 'hombro' | 'triceps' | 'biceps' | 'pierna' | 'femoral' | 'gemelos' | 'core' | 'cardio';
  categoryLabel: string;
  defaultSets: number;
  defaultWorkMinutes: number;
  defaultRestSeconds: number;
  alternatives: ExerciseAlternative[];
}

export const GYM_EXERCISE_CATALOG: GymExerciseInfo[] = [
  // --- PECHO ---
  {
    id: 'press_banca',
    name: 'Press de banca',
    synonyms: ['press de banca', 'press banca', 'bench press', 'banca plana', 'press plano'],
    category: 'pecho',
    categoryLabel: 'Pectoral / Empuje horizontal',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Press con mancuernas en banco plano', equipment: 'Mancuernas', note: 'Mayor rango de recorrido y libertad articular para hombros' },
      { name: 'Press en máquina convergente', equipment: 'Máquina', note: 'Excelente estabilidad para forzar al fallo con total seguridad' },
      { name: 'Press en multipower (Smith)', equipment: 'Multipower', note: 'Trayectoria guiada fija, ideal si entrenas sin compañero' },
      { name: 'Flexiones lastradas con disco/chaleco', equipment: 'Peso corporal', note: 'Trabajo escapular dinámico y sin presión excesiva en hombro' }
    ]
  },
  {
    id: 'press_inclinado',
    name: 'Press inclinado',
    synonyms: ['press inclinado', 'press banca inclinada', 'incline bench', 'incline press'],
    category: 'pecho',
    categoryLabel: 'Pectoral superior (clavicular)',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Press inclinado con mancuernas (30º)', equipment: 'Mancuernas', note: 'Trayectoria convergente óptima para el haz clavicular' },
      { name: 'Press inclinado en máquina', equipment: 'Máquina', note: 'Tensión constante durante todo el recorrido' },
      { name: 'Press inclinado en multipower', equipment: 'Multipower', note: 'Permite exprimir repeticiones parciales con seguridad' },
      { name: 'Cruces en polea baja hacia arriba', equipment: 'Poleas', note: 'Aislamiento puro de la porción superior del pecho' }
    ]
  },
  {
    id: 'fondos_paralelas',
    name: 'Fondos en paralelas',
    synonyms: ['fondos', 'fondos en paralelas', 'dips', 'paralelas', 'fondos de pecho'],
    category: 'pecho',
    categoryLabel: 'Pectoral inferior / Tríceps',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Fondos en máquina asistida', equipment: 'Máquina', note: 'Permite regular el peso exactamente para completar las series' },
      { name: 'Press declinado con mancuernas o barra', equipment: 'Mancuernas / Barra', note: 'Mismo ángulo de empuje sin tensión en la cápsula articular' },
      { name: 'Press de banca cerrado', equipment: 'Barra', note: 'Gran reclutamiento de tríceps y porción esternal' },
      { name: 'Extensión en polea alta con barra recta', equipment: 'Poleas', note: 'Aislamiento puro si sientes molestias en los hombros con fondos' }
    ]
  },

  // --- ESPALDA ---
  {
    id: 'remo_barra',
    name: 'Remo con barra',
    synonyms: ['remo con barra', 'barbell row', 'remo 90', 'remo pendlay', 'remo 45'],
    category: 'espalda',
    categoryLabel: 'Espalda / Tracción horizontal',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Remo Gironda en polea baja', equipment: 'Polea', note: 'Cero fatiga en lumbares y máxima contracción escapular' },
      { name: 'Remo con mancuerna a una mano', equipment: 'Mancuerna', note: 'Corrige descompensaciones bilaterales con rango muy amplio' },
      { name: 'Remo en máquina con pecho apoyado', equipment: 'Máquina', note: 'Aislamiento estricto de espalda media sin sobrecargar la espalda baja' },
      { name: 'Remo en barra T (T-Bar row)', equipment: 'Barra T', note: 'Excelente densidad y fuerza de tracción' }
    ]
  },
  {
    id: 'jalon_pecho',
    name: 'Jalón al pecho',
    synonyms: ['jalon al pecho', 'jalón al pecho', 'lat pulldown', 'polea al pecho', 'jalon'],
    category: 'espalda',
    categoryLabel: 'Dorsal ancho / Tracción vertical',
    defaultSets: 4,
    defaultWorkMinutes: 2.5,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Dominadas con peso corporal (o lastradas)', equipment: 'Barra de dominadas', note: 'Fuerza funcional y reclutamiento completo de core y dorsales' },
      { name: 'Jalón al pecho agarre neutro / V-Bar', equipment: 'Polea', note: 'Trayectoria muy ergonómica que protege muñecas y codos' },
      { name: 'Jalón unilateral en polea alta', equipment: 'Polea', note: 'Alineación perfecta con las fibras del dorsal ancho' },
      { name: 'Pull-over en polea alta con cuerda', equipment: 'Poleas', note: 'Aisla el dorsal sin involucrar el bíceps' }
    ]
  },
  {
    id: 'dominadas',
    name: 'Dominadas',
    synonyms: ['dominadas', 'pull ups', 'chin ups', 'dominada'],
    category: 'espalda',
    categoryLabel: 'Dorsal ancho / Tracción vertical',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Jalón al pecho en polea', equipment: 'Polea', note: 'Control de carga exacto si estás fatigado para llegar a 8-10 reps' },
      { name: 'Dominadas asistidas con máquina o elástico', equipment: 'Máquina / Goma', note: 'Permite clavar el rango completo y la pausa en contracción' },
      { name: 'Dominadas agarre neutro', equipment: 'Barra multiagarre', note: 'Menor tensión en el bíceps braquial y hombro' }
    ]
  },
  {
    id: 'remo_gironda',
    name: 'Remo gironda',
    synonyms: ['remo gironda', 'remo en polea baja', 'seated cable row', 'cable row', 'gironda'],
    category: 'espalda',
    categoryLabel: 'Dorsal y Espalda media',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Remo con mancuerna apoyado en banco inclinado', equipment: 'Mancuernas', note: 'Tensión constante con apoyo pectoral estricto' },
      { name: 'Remo en máquina unilateral', equipment: 'Máquina', note: 'Permite focalizar el recorrido en cada costado por separado' },
      { name: 'Remo con barra agarre supino (Yates)', equipment: 'Barra', note: 'Mayor implicación de la porción inferior del dorsal' }
    ]
  },

  // --- HOMBROS ---
  {
    id: 'press_militar',
    name: 'Press militar',
    synonyms: ['press militar', 'overhead press', 'ohp', 'press de hombros', 'press hombros'],
    category: 'hombro',
    categoryLabel: 'Deltoides anterior / Empuje vertical',
    defaultSets: 3,
    defaultWorkMinutes: 2.5,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Press de hombros con mancuernas sentado', equipment: 'Mancuernas', note: 'Apoyo lumbar y libertad de rotación en la muñeca' },
      { name: 'Press de hombro en máquina', equipment: 'Máquina', note: 'Seguridad absoluta para empujar con intensidad máxima' },
      { name: 'Press Arnold con mancuernas', equipment: 'Mancuernas', note: 'Rotación continua para activar deltoides anterior y lateral' },
      { name: 'Landmine press a una mano', equipment: 'Barra en esquina', note: 'Vector diagonal muy noble con personas propensas a pinzamiento' }
    ]
  },
  {
    id: 'elevaciones_laterales',
    name: 'Elevaciones laterales',
    synonyms: ['elevaciones laterales', 'lateral raises', 'pajaros laterales', 'vuelos laterales'],
    category: 'hombro',
    categoryLabel: 'Deltoides lateral',
    defaultSets: 4,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Elevaciones laterales en polea baja', equipment: 'Polea', note: 'Tensión mecánica desde el primer grado de abducción' },
      { name: 'Elevaciones laterales sentado con mancuernas', equipment: 'Mancuernas', note: 'Inhabilita el impulso de caderas y piernas' },
      { name: 'Elevaciones laterales en máquina', equipment: 'Máquina', note: 'Aislamiento guiado perfecto para agotar el deltoides lateral' },
      { name: 'Elevaciones en banco inclinado lateral (incline lateral)', equipment: 'Mancuerna', note: 'Sobrecarga el punto de máximo estiramiento' }
    ]
  },

  // --- BRAZOS / BÍCEPS ---
  {
    id: 'curl_biceps',
    name: 'Curl de bíceps',
    synonyms: ['curl de biceps', 'curl de bíceps', 'curl biceps', 'curl bíceps', 'curl barra', 'curl mancuernas', 'biceps', 'bíceps', 'curl mancuerna'],
    category: 'biceps',
    categoryLabel: 'Bíceps / Flexores de codo',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Curl con mancuernas en banco inclinado', equipment: 'Mancuernas', note: 'Máximo estiramiento de la cabeza larga del bíceps' },
      { name: 'Curl predicador en banco Scott', equipment: 'Barra Z / Máquina', note: 'Aislamiento estricto sin balanceo del cuerpo' },
      { name: 'Curl martillo con mancuernas', equipment: 'Mancuernas', note: 'Enfoque en braquiorradial y braquial anterior' },
      { name: 'Curl en polea baja con barra recta', equipment: 'Polea', note: 'Tensión constante en todo el recorrido' }
    ]
  },
  // --- BRAZOS / TRÍCEPS ---
  {
    id: 'extension_triceps',
    name: 'Extensión de tríceps',
    synonyms: ['extension de triceps', 'extensión de tríceps', 'triceps polea', 'triceps cuerda', 'extension triceps', 'triceps'],
    category: 'triceps',
    categoryLabel: 'Tríceps braquial',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Extensión de tríceps en polea con cuerda', equipment: 'Polea', note: 'Apertura al final para focalizar en la cabeza lateral' },
      { name: 'Extensión katana unilateral tras nuca en polea alta', equipment: 'Polea', note: 'Máximo estiramiento de la cabeza larga con trayectoria natural del codo' },
      { name: 'Fondos asistidos en máquina para tríceps', equipment: 'Máquina asistida', note: 'Sobrecarga de empuje compuesto con descarga articular' },
      { name: 'Extensión en polea con barra recta o V', equipment: 'Polea', note: 'Permite mover cargas más pesadas con trayectoria estable' },
      { name: 'Press francés con mancuernas en banco inclinado (30º)', equipment: 'Mancuernas', note: 'Estiramiento profundo sin forzar los codos en posición rígida' },
      { name: 'Press de banca con agarre cerrado', equipment: 'Barra / Multipower', note: 'Excelente constructor de masa y fuerza para tríceps' }
    ]
  },

  // --- PIERNA (CUÁDRICEPS / DOMINANTE RODILLA) ---
  {
    id: 'sentadilla_jaca',
    name: 'Sentadilla Jaca',
    synonyms: ['sentadilla jaca', 'jaca', 'hack squat', 'sentadilla hack', 'hack', 'maquina jaca', 'prensa jaca'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps / Dominante rodilla guiada',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 180,
    alternatives: [
      { name: 'Prensa de piernas a 45º', equipment: 'Prensa', note: 'Gran empuje de cuádriceps con cero compresión axial en columna' },
      { name: 'Sentadilla pendular (Pendulum squat)', equipment: 'Máquina pendular', note: 'Curva de resistencia biomecánica perfecta y máxima profundidad sin fatiga lumbar' },
      { name: 'Sentadilla en multipower con pies adelantados', equipment: 'Multipower', note: 'Trayectoria vertical guiada con foco total en cuádriceps' },
      { name: 'Extensiones pesadas de cuádriceps en máquina', equipment: 'Máquina', note: 'Aislamiento directo y seguro de cuádriceps sin fatiga general' },
      { name: 'Sentadilla búlgara guiada en multipower', equipment: 'Multipower', note: 'Aislamiento unilateral tremendo con estabilidad asistida' }
    ]
  },
  {
    id: 'maquina_aduccion',
    name: 'Máquina de aducción',
    synonyms: ['maquina de aduccion', 'maquina de aducción', 'aduccion', 'aducción', 'aductor', 'aductores', 'maquina aductores', 'inner thigh'],
    category: 'pierna',
    categoryLabel: 'Aductores / Cadera interna',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Aducción en polea baja con tobillera', equipment: 'Polea', note: 'Tensión continua en todo el rango de cierre' },
      { name: 'Sentadilla sumo con mancuerna pesada', equipment: 'Mancuerna', note: 'Apertura amplia con gran reclutamiento del aductor mayor' },
      { name: 'Copenhagen plank en banco', equipment: 'Suelo / Banco', note: 'Isometría de fuerza funcional para estabilizadores de cadera' },
      { name: 'Zancadas laterales controladas', equipment: 'Mancuerna', note: 'Movilidad frontal y fuerza activa del compartimento medial' }
    ]
  },
  {
    id: 'maquina_gluteos',
    name: 'Máquina de glúteos',
    synonyms: ['maquina de gluteos', 'maquina de glúteos', 'gluteos', 'glúteos', 'gluteo', 'glúteo', 'culo', 'patada de gluteo', 'patada de glúteos', 'glute drive', 'abduccion', 'abducción', 'abductores'],
    category: 'pierna',
    categoryLabel: 'Glúteo mayor y medio',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Patada de glúteo en polea baja', equipment: 'Polea', note: 'Extensión de cadera pura sin sobrecarga lumbar' },
      { name: 'Hip thrust en máquina o multipower', equipment: 'Máquina / Multipower', note: 'Carga directa y máxima activación del glúteo mayor' },
      { name: 'Máquina de abducción de cadera', equipment: 'Máquina', note: 'Aislamiento del glúteo medio para estabilidad pélvica' },
      { name: 'Puente de glúteo unilateral con mancuerna', equipment: 'Mancuerna / Suelo', note: 'Trabajo unilateral sin necesidad de máquinas' }
    ]
  },
  {
    id: 'curl_femoral',
    name: 'Curl femoral en máquina',
    synonyms: ['curl femoral', 'curl femoral en maquina', 'curl femoral en máquina', 'leg curl', 'curl femoral sentado', 'curl femoral tumbado', 'femoral maquina', 'femoral'],
    category: 'femoral',
    categoryLabel: 'Isquiosurales / Flexión de rodilla',
    defaultSets: 4,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Curl femoral sentado en máquina', equipment: 'Máquina', note: 'Máximo estiramiento del bíceps femoral con cadera a 90º' },
      { name: 'Curl femoral tumbado en máquina', equipment: 'Máquina', note: 'Tensión directa en la contracción pico de isquios' },
      { name: 'Peso muerto rumano con mancuernas', equipment: 'Mancuernas', note: 'Bisagra de cadera y estiramiento excéntrico profundo' },
      { name: 'Nordic curl / Curl con fitball', equipment: 'Peso corporal', note: 'Flexión de rodilla funcional sin máquinas' }
    ]
  },
  {
    id: 'sentadilla',
    name: 'Sentadilla',
    synonyms: ['sentadilla', 'squat', 'back squat', 'sentadilla con barra', 'sentadilla trasera'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps y Glúteo / Dominante rodilla',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 150,
    alternatives: [
      { name: 'Prensa de piernas a 45º', equipment: 'Prensa', note: 'Cero compresión en columna vertebral con alta carga en cuádriceps' },
      { name: 'Sentadilla Hack en máquina', equipment: 'Máquina Hack', note: 'Enfoque directo y brutal en vasto externo e interno' },
      { name: 'Sentadilla en multipower con pies adelantados', equipment: 'Multipower', note: 'Menor flexión de cadera y mayor flexión de rodilla' },
      { name: 'Sentadilla Goblet con mancuerna pesada', equipment: 'Mancuerna', note: 'Fácil colocación, torso vertical y trabajo seguro de movilidad' }
    ]
  },
  {
    id: 'prensa',
    name: 'Prensa',
    synonyms: ['prensa', 'leg press', 'prensa de piernas', 'prensa inclinada', 'prensa pesada'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps / Piernas',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Sentadilla Hack en máquina', equipment: 'Hack', note: 'Profundidad guiada y foco intenso en cuádriceps' },
      { name: 'Prensa horizontal sentado', equipment: 'Máquina', note: 'Menor presión intraocular y espinal' },
      { name: 'Sentadilla en multipower (Smith)', equipment: 'Multipower', note: 'Permite variar la posición de los pies libremente' },
      { name: 'Extensiones de cuádriceps pesadas', equipment: 'Máquina', note: 'Aislamiento analítico sin fatiga sistémica' }
    ]
  },
  {
    id: 'extensiones_cuadriceps',
    name: 'Extensiones de cuádriceps',
    synonyms: ['extensiones de cuadriceps', 'extensiones de piernas', 'leg extension', 'extension cuadriceps'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps analítico',
    defaultSets: 3,
    defaultWorkMinutes: 2,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Prensa con pies abajo en la plataforma', equipment: 'Prensa', note: 'Mayor flexión de rodilla para activar vastos' },
      { name: 'Sissy squat en banco guiado', equipment: 'Banco Sissy', note: 'Tensión extrema en el recto femoral en estiramiento' },
      { name: 'Sentadilla en multipower con talones elevados', equipment: 'Multipower', note: 'Máximo énfasis en cuádriceps' }
    ]
  },

  // --- PIERNA POSTERIOR / CADERA ---
  {
    id: 'peso_muerto_rumano',
    name: 'Peso muerto rumano',
    synonyms: ['peso muerto rumano', 'rdl', 'romanian deadlift', 'peso muerto piernas rigidas', 'rumano'],
    category: 'femoral',
    categoryLabel: 'Isquiosurales y Cadera posterior',
    defaultSets: 4,
    defaultWorkMinutes: 3,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Curl femoral tumbado en máquina', equipment: 'Máquina', note: 'Aislamiento directo de isquiosurales sin fatiga en la espalda baja' },
      { name: 'Curl femoral sentado en máquina', equipment: 'Máquina', note: 'Mayor estiramiento del bíceps femoral en posición flexionada' },
      { name: 'Peso muerto rumano con mancuernas', equipment: 'Mancuernas', note: 'Trayectoria natural pegada a las piernas, más cómodo en muñecas' },
      { name: 'Hiperextensiones a 45º enfocadas a isquios/glúteo', equipment: 'Banco 45º', note: 'Curvando ligeramente la espalda alta para aislar cadena posterior' }
    ]
  },

  // --- GEMELOS ---
  {
    id: 'gemelos_maquina',
    name: 'Gemelos en máquina',
    synonyms: ['gemelos', 'gemelos en máquina', 'calf raises', 'elevacion de talones', 'gemelo de pie'],
    category: 'gemelos',
    categoryLabel: 'Gastrocnemio / Sóleo',
    defaultSets: 4,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Elevación de talones en prensa', equipment: 'Prensa', note: 'Punta de los pies en el borde de la plataforma con parada abajo' },
      { name: 'Gemelos sentado en máquina', equipment: 'Máquina de sóleo', note: 'Enfoque directo en el músculo sóleo con rodillas a 90º' },
      { name: 'Elevación de talones unilateral con mancuerna', equipment: 'Mancuerna', note: 'Recorrido profundo en un escalón para cada pierna' }
    ]
  },

  // --- MOVILIDAD Y ESTIRAMIENTOS ---
  {
    id: 'estiramientos_movilidad',
    name: 'Estiramientos y movilidad',
    synonyms: ['estiramientos', 'movilidad', 'calentamiento', 'flexibilidad', 'stretching', 'estiramiento', 'estiramientos previos', 'estiramientos posteriores'],
    category: 'core',
    categoryLabel: 'Movilidad / Flexibilidad / Prevención',
    defaultSets: 1,
    defaultWorkMinutes: 5,
    defaultRestSeconds: 0,
    alternatives: [
      { name: 'Movilidad articular dinámica previa', equipment: 'Suelo', note: 'Círculos escapulares, rotaciones torácicas y apertura de cadera' },
      { name: 'Foam roller y automasaje miofascial', equipment: 'Rodillo', note: 'Descarga de puntos gatillo y tensión acumulada' },
      { name: 'Estiramientos estáticos de descarga', equipment: 'Colchoneta', note: 'Elongación suave de grupos musculares trabajados' },
      { name: 'Rutina de movilidad de cadera 90/90', equipment: 'Suelo', note: 'Descompresión y rotación articular de cadera' }
    ]
  },
  // --- CORE / ABDOMINALES ---
  {
    id: 'abdominales_core',
    name: 'Abdominales y Core',
    synonyms: ['abdominales', 'core', 'plancha', 'abs', 'crunch', 'abdominal'],
    category: 'core',
    categoryLabel: 'Core / Zona media',
    defaultSets: 3,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Rueda abdominal (Ab wheel rollout)', equipment: 'Rueda', note: 'Anti-extensión de columna, activación neuromuscular altísima' },
      { name: 'Elevaciones de piernas colgado en barra', equipment: 'Barra de dominadas', note: 'Gran trabajo de flexores y porción inferior del recto abdominal' },
      { name: 'Crunch en polea alta con cuerda (arrodillado)', equipment: 'Polea', note: 'Permite sobrecarga progresiva real con peso añadido' },
      { name: 'Plancha isométrica (Front plank)', equipment: 'Suelo', note: 'Resistencia estabilizadora sin impacto espinal' }
    ]
  },

  // --- CARDIO FINAL FLEXIBLE ---
  {
    id: 'cardio_final',
    name: 'Cardio final (Remo / Andar / Bici)',
    synonyms: ['cardio', 'cardio final', 'remo', 'andar', 'bici', 'bicicleta', 'cinta', 'caminar', 'eliptica'],
    category: 'cardio',
    categoryLabel: 'Acondicionamiento / Resistencia',
    defaultSets: 1,
    defaultWorkMinutes: 15,
    defaultRestSeconds: 0,
    alternatives: [
      { name: 'Remo indoor (Concept2)', equipment: 'Ergómetro', note: 'Trabajo global de espalda, piernas y core con bajo impacto' },
      { name: 'Andar en cinta con pendiente (10-12% a 4.5-5.5 km/h)', equipment: 'Cinta', note: 'Gasto calórico elevado protegiendo rodillas y articulaciones' },
      { name: 'Bicicleta estática / Spinning', equipment: 'Bici', note: 'Descarga muscular fluida con ritmo constante y cómodo' },
      { name: 'Elíptica', equipment: 'Elíptica', note: 'Movimiento sincronizado suave de tren superior e inferior' },
      { name: 'Escaleras mecánicas (Stairmaster)', equipment: 'Stairmaster', note: 'Intensidad cardiovascular alta con trabajo de glúteos y gemelos' }
    ]
  }
];

/**
 * Normaliza una cadena para comparar sin acentos ni puntuación.
 */
function normalizeString(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca alternativas inteligentes para cualquier ejercicio.
 */
export function getExerciseAlternatives(title: string): {
  found: boolean;
  matchedTitle: string;
  categoryLabel: string;
  category: string;
  alternatives: ExerciseAlternative[];
} {
  const normTitle = normalizeString(title);

  // 1. Búsqueda por catálogo exacto o sinónimos
  for (const item of GYM_EXERCISE_CATALOG) {
    if (normalizeString(item.name) === normTitle) {
      return {
        found: true,
        matchedTitle: item.name,
        categoryLabel: item.categoryLabel,
        category: item.category,
        alternatives: item.alternatives
      };
    }
    for (const syn of item.synonyms) {
      const normSyn = normalizeString(syn);
      if (normTitle.includes(normSyn) || normSyn.includes(normTitle)) {
        return {
          found: true,
          matchedTitle: item.name,
          categoryLabel: item.categoryLabel,
          category: item.category,
          alternatives: item.alternatives
        };
      }
    }
  }

  // 2. Búsqueda contextual por palabras clave (ej: "press", "remo", "sentadilla", "cardio", "bici", etc.)
  if (normTitle.includes('banca') || normTitle.includes('pecho') || normTitle.includes('chest')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'press_banca')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('remo') || normTitle.includes('espalda') || normTitle.includes('row')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'remo_barra')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('jalon') || normTitle.includes('dominad') || normTitle.includes('pulldown')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'jalon_pecho')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('militar') || normTitle.includes('hombro') || normTitle.includes('lateral')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'press_militar')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('jaca') || normTitle.includes('hack')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'sentadilla_jaca')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('aducc') || normTitle.includes('aductor')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'maquina_aduccion')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('glute') || normTitle.includes('culo') || normTitle.includes('patada')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'maquina_gluteos')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('curl femoral') || normTitle.includes('leg curl') || (normTitle.includes('femoral') && !normTitle.includes('rumano'))) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'curl_femoral')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('curl') || normTitle.includes('biceps')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'curl_biceps')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('estiramiento') || normTitle.includes('movilidad') || normTitle.includes('flexibilidad') || normTitle.includes('calentamiento')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'estiramientos_movilidad')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('sentadilla') || normTitle.includes('prensa') || normTitle.includes('squat')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'sentadilla')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('peso muerto') || normTitle.includes('rumano') || normTitle.includes('femoral') || normTitle.includes('isquio')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'peso_muerto_rumano')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('cardio') || normTitle.includes('andar') || normTitle.includes('bici') || normTitle.includes('cinta') || normTitle.includes('caminar')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'cardio_final')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }

  // 3. Fallback inteligente: opciones variadas de cardio / cuerpo completo
  return {
    found: false,
    matchedTitle: title,
    categoryLabel: 'Ejercicio / Alternativa general',
    category: 'general',
    alternatives: [
      { name: 'Variante con mancuernas', equipment: 'Mancuernas', note: 'Mayor libertad en las articulaciones' },
      { name: 'Variante en máquina guiada', equipment: 'Máquina', note: 'Mayor estabilidad y seguridad' },
      { name: 'Variante en polea', equipment: 'Polea', note: 'Tensión continua en todo el rango' },
      { name: 'Cardio suave de descarga', equipment: 'Cardio', note: 'Caminar o bicicleta estática 15 min' }
    ]
  };
}

/**
 * Determina si una tarea corresponde a un ejercicio de fuerza/gimnasio que se beneficia
 * de registrar peso al completarse de forma ágil y sin fricción.
 */
export function shouldPromptWeight(task?: TaskItem | null, listName?: string): boolean {
  if (!task || task.status === 'completed' || task.deleted_at) return false;

  // Si ya tiene historial de pesos registrado, claramente es un ejercicio con carga
  if (Array.isArray(task.weightLogs) && task.weightLogs.length > 0) return true;

  const title = (task.title || '').trim().toLowerCase();
  if (!title) return false;

  // Reconocimiento por catálogo de ejercicios de fuerza
  const exercise = getExerciseAlternatives(title);
  if (exercise.found && exercise.category) {
    const strengthCategories = ['pecho', 'espalda', 'hombro', 'triceps', 'biceps', 'pierna', 'femoral', 'gemelos'];
    if (strengthCategories.includes(exercise.category)) return true;
  }

  // Si pertenece a una lista de gimnasio o entrenamiento y coincide con patrones de fuerza
  const isGymList = Boolean(
    listName && (
      listName.toLowerCase().includes('gimnasio') ||
      listName.toLowerCase().includes('gym') ||
      listName.toLowerCase().includes('entreno') ||
      listName.toLowerCase().includes('rutina')
    )
  );

  if (isGymList) {
    const strengthTerms = [
      'press', 'jaca', 'remo', 'jalon', 'jalón', 'sentadilla', 'prensa',
      'curl', 'extension', 'extensión', 'fondos', 'peso muerto', 'polea',
      'mancuerna', 'multipower', 'gemelos', 'aduccion', 'aducción', 'gluteo', 'glúteo'
    ];
    if (strengthTerms.some(term => title.includes(term))) {
      // Excluir si es explícitamente cardio o estiramiento
      if (
        title.includes('cardio') ||
        title.includes('estiramiento') ||
        title.includes('andar') ||
        title.includes('correr') ||
        title.includes('movilidad')
      ) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Genera la estructura completa de la rutina de gimnasio de 4 días
 * ajustada a las especificaciones exactas del usuario.
 */
export function createDefaultGymRoutine(userId: string = '') {
  const EPOCH = new Date(0).toISOString();
  const listId = 'gimnasio';

  const list: CustomList = {
    id: listId,
    name: 'Gimnasio',
    color: '#ff3b30',
    icon: 'dumbbell',
    isPinned: true,
    isFolder: false,
    listType: 'routines',
    sortMode: 'manual',
    updated_at: EPOCH
  };

  const sections: ListSection[] = [
    { id: 'sec_gym_diaria', listId, name: 'Diaria: Core y Estiramientos', order: 0, updated_at: EPOCH },
    { id: 'sec_gym_sup_a', listId, name: 'Día 1: Tren Superior A', order: 1, updated_at: EPOCH },
    { id: 'sec_gym_inf_a', listId, name: 'Día 2: Tren Inferior A', order: 2, updated_at: EPOCH },
    { id: 'sec_gym_sup_b', listId, name: 'Día 3: Tren Superior B', order: 3, updated_at: EPOCH },
    { id: 'sec_gym_inf_b', listId, name: 'Día 4: Tren Inferior B', order: 4, updated_at: EPOCH },
  ];

  const tasks: TaskItem[] = [
    // --- DIARIA: CORE Y ESTIRAMIENTOS ---
    {
      id: 'task_gym_daily_estiramientos_previos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_diaria',
      title: 'Estiramientos previos y movilidad',
      description: 'Movilidad dinámica articular (hombros, caderas, tobillos) antes de comenzar la sesión.',
      duration: 5,
      cycle_id: 'cycle_day',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_daily_abs',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_diaria',
      title: 'Abs 50 (Abdominales)',
      description: '50 repeticiones diarias de core / abdominales.',
      targetCount: 50,
      currentCount: 0,
      duration: 5,
      cycle_id: 'cycle_day',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_daily_curl',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_diaria',
      title: 'Curl de bíceps',
      description: '3 series de curl con mancuernas, barra Z o polea.',
      targetCount: 3,
      currentCount: 0,
      duration: 3,
      restDuration: 60,
      cycle_id: 'cycle_day',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_daily_estiramientos_posteriores',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_diaria',
      title: 'Estiramientos posteriores y descarga',
      description: 'Estiramientos estáticos y relajación de los músculos trabajados tras el entrenamiento.',
      duration: 5,
      cycle_id: 'cycle_day',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 1: TREN SUPERIOR A ---
    {
      id: 'task_gym_1_press_banca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Press de banca',
      description: '4 series pesadas en banco plano. Calienta bien antes de las series efectivas.',
      targetCount: 4,
      currentCount: 0,
      duration: 3, // 3 min por serie de trabajo estimado
      restDuration: 120, // 2 min descanso
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_remo_barra',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Remo con barra',
      description: '4 series. Torso inclinado a 45-70º, codos pegados al cuerpo, tracción al ombligo.',
      targetCount: 4,
      currentCount: 0,
      duration: 3,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_press_militar',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Press militar',
      description: '3 series. Empuje vertical con barra o mancuernas. Glúteos y core bien activos.',
      targetCount: 3,
      currentCount: 0,
      duration: 2.5,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_jalon_pecho',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Jalón al pecho',
      description: '3 series. Agarre amplio o medio, llevando la barra a la parte superior del pecho.',
      targetCount: 3,
      currentCount: 0,
      duration: 2.5,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_elevaciones_laterales',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Elevaciones laterales',
      description: '4 series de 12-15 reps. Con mancuernas o polea. Controla la bajada excéntrica.',
      targetCount: 4,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_extension_triceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Extensión de tríceps',
      description: '3 series en polea con cuerda o barra. Codos fijos al costado del cuerpo.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_1_cardio',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Cardio final (Remo / Andar con pendiente / Bici)',
      description: '15 minutos continuos a intensidad moderada en la máquina que más te apetezca hoy.',
      targetCount: 1,
      currentCount: 0,
      duration: 15,
      restDuration: 0,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 6,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 2: TREN INFERIOR A ---
    {
      id: 'task_gym_2_sentadilla_jaca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Sentadilla Jaca',
      description: '4 series pesadas en máquina Jaca / Hack. Coloca los pies en ancho medio y desciende controlado. Descanso amplio.',
      targetCount: 4,
      currentCount: 0,
      duration: 3,
      restDuration: 180, // 3 min descanso
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_curl_femoral',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Curl femoral en máquina',
      description: '4 series de 10-12 reps. En máquina sentado o tumbado (leg curl). Controla la fase excéntrica y aprieta en contracción.',
      targetCount: 4,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_maquina_gluteos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Máquina de glúteos',
      description: '3 series de 12 reps (máquina de culo / glute drive). Extensión completa con glúteo bloqueado.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_extensiones_cuadriceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Extensiones de cuádriceps',
      description: '3 series de 12-15 reps (leg extension). Control en todo el recorrido con 1s de pausa en extensión.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_maquina_aduccion',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Máquina de aducción',
      description: '3 series de 12-15 reps. Cierra controlado con pausa de 1 segundo en el punto de máxima contracción.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_gemelos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Gemelos en máquina',
      description: '4 series de 15 reps. Pausa abajo en máximo estiramiento y arriba en contracción.',
      targetCount: 4,
      currentCount: 0,
      duration: 1.5,
      restDuration: 60,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_2_cardio',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_a',
      title: 'Cardio final (Remo / Andar con pendiente / Bici)',
      description: '15 minutos de recuperación activa en cinta con inclinación, máquina de remo o bicicleta.',
      targetCount: 1,
      currentCount: 0,
      duration: 15,
      restDuration: 0,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 6,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 3: TREN SUPERIOR B ---
    {
      id: 'task_gym_3_press_inclinado',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Press inclinado',
      description: '4 series. Con mancuernas o barra a unos 30º de inclinación.',
      targetCount: 4,
      currentCount: 0,
      duration: 3,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_dominadas',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Dominadas',
      description: '4 series con peso corporal (o asistidas en máquina si hace falta para clavar reps).',
      targetCount: 4,
      currentCount: 0,
      duration: 3,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_jalon_pecho',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Jalón al pecho',
      description: '3 series. Agarre neutro o cerrado para variedad de fibras y bombeo dorsal.',
      targetCount: 3,
      currentCount: 0,
      duration: 2.5,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_fondos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Fondos',
      description: '3 series en paralelas (o máquina asistida). Torso ligeramente inclinado.',
      targetCount: 3,
      currentCount: 0,
      duration: 2.5,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_remo_gironda',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Remo gironda',
      description: '3 series en polea baja. Espalda erguida, retracción escapular completa.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_elevaciones_laterales',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Elevaciones laterales',
      description: '3 series en polea o mancuerna para redondez del deltoides.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_cardio',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Cardio final (Bici / Remo / Cinta)',
      description: '15 minutos de cardio continuo para cerrar la sesión.',
      targetCount: 1,
      currentCount: 0,
      duration: 15,
      restDuration: 0,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 6,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 4: TREN INFERIOR B ---
    {
      id: 'task_gym_4_sentadilla_jaca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Sentadilla Jaca',
      description: '4 series pesadas en Jaca. Foco en empujar con fuerza desde los talones y controlar la bajada. Descanso amplio.',
      targetCount: 4,
      currentCount: 0,
      duration: 3,
      restDuration: 180, // 3 min descanso
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_curl_femoral',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Curl femoral en máquina',
      description: '4 series de 10-12 reps en leg curl.',
      targetCount: 4,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_maquina_gluteos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Máquina de glúteos',
      description: '3 series de 12 reps con contracción pico en cada repetición.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_extensiones_cuadriceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Extensiones de cuádriceps',
      description: '3 series de 12 reps (leg extension).',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_maquina_aduccion',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Máquina de aducción',
      description: '3 series de 12-15 reps para estabilidad de aductores y cadera.',
      targetCount: 3,
      currentCount: 0,
      duration: 2,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_gemelos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Gemelos en máquina',
      description: '4 series de 15 reps con parada abajo.',
      targetCount: 4,
      currentCount: 0,
      duration: 1.5,
      restDuration: 60,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_4_cardio',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_inf_b',
      title: 'Cardio final (Caminar con pendiente / Bici / Remo)',
      description: '15 minutos de cardio suave para finalizar la semana de entrenamiento.',
      targetCount: 1,
      currentCount: 0,
      duration: 15,
      restDuration: 0,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 6,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    }
  ];

  return { list, sections, tasks };
}
