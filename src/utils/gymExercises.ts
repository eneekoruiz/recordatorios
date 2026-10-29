import { useAppStore } from '../store/useAppStore';
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
    defaultWorkMinutes: 1,
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
  },
// --- ESPALDA (ADICIONALES) ---
  {
    id: 'face_pull',
    name: 'Face pull con cuerda',
    synonyms: ['face pull', 'face pull con cuerda', 'cuerda a la cara', 'tiron a la cara', 'tiron facial', 'cuerda cara', 'espalda alta cuerda'],
    category: 'espalda',
    categoryLabel: 'Deltoides posterior / Espalda alta',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Pájaros con mancuernas en banco inclinado', equipment: 'Mancuernas', note: 'Aislamiento puro del deltoides posterior con apoyo pectoral' },
      { name: 'Rear delt fly en máquina (pec deck inversa)', equipment: 'Máquina', note: 'Trayectoria guiada y tensión constante en deltoides posterior' },
      { name: 'Band pull-apart con goma', equipment: 'Banda elástica', note: 'Excelente calentamiento y activación de rotadores externos' },
      { name: 'Remo al mentón con agarre amplio', equipment: 'Barra / Polea', note: 'Combinación de trapecio y deltoides posterior con menos estrés en hombro' }
    ]
  },
  {
    id: 'remo_horizontal',
    name: 'Remo horizontal en polea',
    synonyms: ['remo horizontal', 'remo en polea', 'seated row', 'remo sentado', 'remo polea baja', 'remo cable', 'horizontal row'],
    category: 'espalda',
    categoryLabel: 'Dorsal y Espalda media / Tracción horizontal',
    defaultSets: 4,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Remo con mancuerna a una mano', equipment: 'Mancuerna', note: 'Mayor rango unilateral y corrección de descompensaciones' },
      { name: 'Remo en máquina con pecho apoyado', equipment: 'Máquina', note: 'Cero fatiga lumbar con aislamiento estricto' },
      { name: 'Remo Gironda en polea baja', equipment: 'Polea', note: 'Retracción escapular máxima con torso erguido' },
      { name: 'Remo con barra T (T-Bar row)', equipment: 'Barra T', note: 'Gran densidad de espalda media con agarre neutro' }
    ]
  },
  {
    id: 'remo_elevado',
    name: 'Remo elevado',
    synonyms: ['remo elevado', 'remo al menton', 'remo al mentón', 'upright row', 'remo vertical', 'tiron vertical'],
    category: 'hombro',
    categoryLabel: 'Trapecio y Deltoides lateral',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Elevaciones laterales con mancuernas', equipment: 'Mancuernas', note: 'Menor estrés en la cápsula del hombro con mismo estímulo del deltoides lateral' },
      { name: 'Remo al mentón con agarre amplio en polea baja', equipment: 'Polea', note: 'Tensión continua con menor pinzamiento subacromial' },
      { name: 'Encogimientos de hombros (shrugs)', equipment: 'Mancuernas / Barra', note: 'Aislamiento puro de trapecio superior' }
    ]
  },
  {
    id: 'pullover',
    name: 'Pull-over',
    synonyms: ['pullover', 'pull over', 'pull-over', 'pullover polea', 'pullover mancuerna'],
    category: 'espalda',
    categoryLabel: 'Dorsal ancho / Serrato',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Pull-over en polea alta con barra recta', equipment: 'Polea', note: 'Tensión constante en el dorsal sin involucrar pecho' },
      { name: 'Pull-over con mancuerna en banco plano', equipment: 'Mancuerna', note: 'Estiramiento profundo del dorsal y serrato' },
      { name: 'Jalón con brazos rectos en polea alta', equipment: 'Polea', note: 'Mismo patrón motor con mayor aislamiento del dorsal' }
    ]
  },
  {
    id: 'remo_maquina',
    name: 'Remo en máquina',
    synonyms: ['remo en maquina', 'remo en máquina', 'remo maquina', 'remo máquina', 'chest supported row', 'remo con apoyo'],
    category: 'espalda',
    categoryLabel: 'Espalda media / Romboides',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Remo con mancuerna en banco inclinado', equipment: 'Mancuernas', note: 'Mismo apoyo pectoral con libertad de rotación' },
      { name: 'Remo horizontal en polea', equipment: 'Polea', note: 'Mayor rango con tensión variable' },
      { name: 'Remo con barra agarre supino (Yates)', equipment: 'Barra', note: 'Gran implicación del dorsal inferior' }
    ]
  },

  // --- PECHO (ADICIONALES) ---
  {
    id: 'press_mancuernas',
    name: 'Press con mancuernas',
    synonyms: ['press con mancuernas', 'press mancuernas', 'dumbbell press', 'press plano mancuernas'],
    category: 'pecho',
    categoryLabel: 'Pectoral / Empuje horizontal',
    defaultSets: 4,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Press de banca con barra', equipment: 'Barra', note: 'Permite mover más peso total con estabilidad bilateral' },
      { name: 'Press en máquina convergente', equipment: 'Máquina', note: 'Seguridad total para empujar al fallo' },
      { name: 'Aperturas con mancuernas en banco plano', equipment: 'Mancuernas', note: 'Aislamiento del pectoral con máximo estiramiento' }
    ]
  },
  {
    id: 'aperturas_pecho',
    name: 'Aperturas / Cruces de pecho',
    synonyms: ['aperturas', 'cruces', 'cruces de pecho', 'aperturas pecho', 'chest fly', 'pec fly', 'aperturas con mancuernas', 'cruces en polea'],
    category: 'pecho',
    categoryLabel: 'Pectoral / Aislamiento',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Cruces en polea alta (cable crossover)', equipment: 'Poleas', note: 'Tensión constante con gran contracción pico' },
      { name: 'Pec deck / Contractora de pecho', equipment: 'Máquina', note: 'Aislamiento guiado perfecto para pecho' },
      { name: 'Aperturas con mancuernas en banco inclinado', equipment: 'Mancuernas', note: 'Énfasis en porción clavicular del pectoral' }
    ]
  },

  // --- HOMBRO (ADICIONALES) ---
  {
    id: 'elevaciones_frontales',
    name: 'Elevaciones frontales',
    synonyms: ['elevaciones frontales', 'front raises', 'elevacion frontal', 'deltoides frontal'],
    category: 'hombro',
    categoryLabel: 'Deltoides anterior',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Elevaciones frontales en polea baja', equipment: 'Polea', note: 'Tensión constante desde el inicio del recorrido' },
      { name: 'Elevaciones frontales con disco', equipment: 'Disco', note: 'Agarre neutro cómodo y recorrido natural' },
      { name: 'Press Arnold con mancuernas', equipment: 'Mancuernas', note: 'Rotación que activa deltoides anterior y lateral simultáneamente' }
    ]
  },
  {
    id: 'pajaros',
    name: 'Pájaros (Rear delt fly)',
    synonyms: ['pajaros', 'pájaros', 'rear delt fly', 'rear delt', 'deltoides posterior', 'vuelos posteriores', 'pajaros mancuerna', 'reverse fly'],
    category: 'hombro',
    categoryLabel: 'Deltoides posterior',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Face pull con cuerda en polea alta', equipment: 'Polea', note: 'Combina rotación externa con retracción escapular' },
      { name: 'Pec deck inversa (reverse pec deck)', equipment: 'Máquina', note: 'Aislamiento guiado del deltoides posterior' },
      { name: 'Pájaros en banco inclinado boca abajo', equipment: 'Mancuernas', note: 'Elimina impulso del cuerpo para máximo aislamiento' }
    ]
  },
  {
    id: 'press_arnold',
    name: 'Press Arnold',
    synonyms: ['press arnold', 'arnold press', 'press de arnold'],
    category: 'hombro',
    categoryLabel: 'Deltoides anterior y lateral',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Press militar con barra', equipment: 'Barra', note: 'Mayor carga total con trayectoria vertical pura' },
      { name: 'Press de hombros con mancuernas sentado', equipment: 'Mancuernas', note: 'Apoyo lumbar con empuje bilateral' },
      { name: 'Landmine press a una mano', equipment: 'Barra', note: 'Vector diagonal suave con los hombros' }
    ]
  },

  // --- BRAZOS (ADICIONALES) ---
  {
    id: 'curl_martillo',
    name: 'Curl martillo',
    synonyms: ['curl martillo', 'hammer curl', 'martillo', 'curl neutro', 'curl agarre neutro'],
    category: 'biceps',
    categoryLabel: 'Braquiorradial / Bíceps',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Curl en polea baja con cuerda (agarre neutro)', equipment: 'Polea', note: 'Tensión continua en braquiorradial y braquial' },
      { name: 'Curl con mancuernas alterno', equipment: 'Mancuernas', note: 'Mayor concentración unilateral' },
      { name: 'Curl predicador con barra EZ', equipment: 'Barra EZ', note: 'Aislamiento estricto sin balanceo' }
    ]
  },
  {
    id: 'curl_predicador',
    name: 'Curl predicador (Scott)',
    synonyms: ['curl predicador', 'curl scott', 'preacher curl', 'banco scott', 'curl banco predicador'],
    category: 'biceps',
    categoryLabel: 'Bíceps / Aislamiento',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Curl con mancuerna concentrado', equipment: 'Mancuerna', note: 'Aislamiento total con apoyo del codo en la rodilla' },
      { name: 'Curl en máquina predicador', equipment: 'Máquina', note: 'Trayectoria fija para forzar al fallo con seguridad' },
      { name: 'Curl araña (spider curl) en banco inclinado', equipment: 'Mancuernas', note: 'Contracción pico brutal del bíceps' }
    ]
  },
  {
    id: 'press_frances',
    name: 'Press francés',
    synonyms: ['press frances', 'press francés', 'skull crusher', 'skull crushers', 'extension triceps tumbado', 'rompe craneos'],
    category: 'triceps',
    categoryLabel: 'Tríceps / Cabeza larga',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Extensión overhead con mancuerna', equipment: 'Mancuerna', note: 'Máximo estiramiento de la cabeza larga del tríceps' },
      { name: 'Extensión en polea alta con cuerda', equipment: 'Polea', note: 'Tensión constante y apertura al final para cabeza lateral' },
      { name: 'Press de banca agarre cerrado', equipment: 'Barra', note: 'Compuesto pesado para masa de tríceps' }
    ]
  },
  {
    id: 'extension_overhead_triceps',
    name: 'Extensión overhead de tríceps',
    synonyms: ['extension overhead', 'extensión overhead', 'overhead extension', 'extension por encima de la cabeza', 'triceps overhead', 'extension tras nuca'],
    category: 'triceps',
    categoryLabel: 'Tríceps / Cabeza larga',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 75,
    alternatives: [
      { name: 'Press francés con barra EZ', equipment: 'Barra EZ', note: 'Posición tumbada con estiramiento profundo' },
      { name: 'Extensión katana unilateral en polea alta', equipment: 'Polea', note: 'Máximo estiramiento con trayectoria natural del codo' },
      { name: 'Extensión con mancuerna tras nuca sentado', equipment: 'Mancuerna', note: 'Foco en cabeza larga con apoyo en banco vertical' }
    ]
  },

  // --- PIERNA (ADICIONALES) ---
  {
    id: 'hip_thrust',
    name: 'Hip thrust',
    synonyms: ['hip thrust', 'empuje de cadera', 'puente de gluteos', 'puente de glúteos', 'glute bridge', 'hip thrust barra'],
    category: 'pierna',
    categoryLabel: 'Glúteo mayor / Extensión de cadera',
    defaultSets: 4,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 120,
    alternatives: [
      { name: 'Hip thrust en máquina', equipment: 'Máquina', note: 'Carga directa sin montaje de barra' },
      { name: 'Puente de glúteo unilateral', equipment: 'Suelo', note: 'Corrección de descompensaciones bilaterales' },
      { name: 'Patada de glúteo en polea baja', equipment: 'Polea', note: 'Extensión de cadera pura con tensión constante' },
      { name: 'Máquina de glúteos (glute drive)', equipment: 'Máquina', note: 'Cómoda y directa sin montar/desmontar peso' }
    ]
  },
  {
    id: 'zancada',
    name: 'Zancada / Lunge',
    synonyms: ['zancada', 'lunge', 'lunges', 'zancadas', 'estocada', 'tijeras', 'zancada con mancuernas'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps y Glúteo / Unilateral',
    defaultSets: 3,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Sentadilla búlgara', equipment: 'Mancuernas / Banco', note: 'Mayor rango y estabilidad con pie trasero elevado' },
      { name: 'Zancada caminando con mancuernas', equipment: 'Mancuernas', note: 'Componente dinámico funcional' },
      { name: 'Step up en cajón', equipment: 'Cajón / Mancuerna', note: 'Unilateral con menor estrés en la rodilla' }
    ]
  },
  {
    id: 'sentadilla_bulgara',
    name: 'Sentadilla búlgara',
    synonyms: ['sentadilla bulgara', 'sentadilla búlgara', 'bulgarian split squat', 'split squat', 'bulgara'],
    category: 'pierna',
    categoryLabel: 'Cuádriceps y Glúteo / Unilateral',
    defaultSets: 3,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 90,
    alternatives: [
      { name: 'Zancada con mancuernas', equipment: 'Mancuernas', note: 'Menos demandante en equilibrio' },
      { name: 'Sentadilla búlgara en multipower', equipment: 'Multipower', note: 'Estabilidad asistida para cargar más peso' },
      { name: 'Prensa unilateral (una pierna)', equipment: 'Prensa', note: 'Unilateral sin requisito de equilibrio' }
    ]
  },
  {
    id: 'peso_muerto',
    name: 'Peso muerto convencional',
    synonyms: ['peso muerto', 'peso muerto convencional', 'deadlift', 'conventional deadlift', 'peso muerto suelo'],
    category: 'pierna',
    categoryLabel: 'Cadena posterior completa',
    defaultSets: 4,
    defaultWorkMinutes: 1.5,
    defaultRestSeconds: 150,
    alternatives: [
      { name: 'Peso muerto rumano', equipment: 'Barra', note: 'Mayor foco en isquiosurales con menos fatiga del SNC' },
      { name: 'Peso muerto sumo', equipment: 'Barra', note: 'Mayor participación de aductores y cuádriceps' },
      { name: 'Peso muerto con trap bar (hex bar)', equipment: 'Trap bar', note: 'Centro de gravedad más favorable para la espalda' }
    ]
  },

  // --- CORE (ADICIONALES) ---
  {
    id: 'crunch_polea',
    name: 'Crunch en polea',
    synonyms: ['crunch en polea', 'crunch polea', 'cable crunch', 'crunch con cuerda', 'abdominales polea'],
    category: 'core',
    categoryLabel: 'Recto abdominal',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Crunch en máquina abdominal', equipment: 'Máquina', note: 'Sobrecarga guiada y segura' },
      { name: 'Elevaciones de piernas colgado', equipment: 'Barra', note: 'Gran trabajo de porción inferior del recto abdominal' },
      { name: 'Rueda abdominal (ab wheel)', equipment: 'Rueda', note: 'Anti-extensión con activación neuromuscular altísima' }
    ]
  },
  {
    id: 'plancha',
    name: 'Plancha (Plank)',
    synonyms: ['plancha', 'plank', 'plancha isometrica', 'plancha isométrica', 'plancha frontal', 'front plank'],
    category: 'core',
    categoryLabel: 'Core / Anti-extensión',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 45,
    alternatives: [
      { name: 'Plancha lateral', equipment: 'Suelo', note: 'Anti-flexión lateral para oblicuos y cuadrado lumbar' },
      { name: 'Plancha con brazos extendidos', equipment: 'Suelo', note: 'Mayor demanda en hombros y core superior' },
      { name: 'Dead bug', equipment: 'Suelo', note: 'Anti-extensión dinámica con coordinación contralateral' }
    ]
  },
  {
    id: 'elevacion_piernas',
    name: 'Elevación de piernas colgando',
    synonyms: ['elevacion de piernas', 'elevación de piernas', 'leg raises', 'hanging leg raises', 'piernas colgando', 'elevacion piernas barra'],
    category: 'core',
    categoryLabel: 'Recto abdominal inferior / Flexores de cadera',
    defaultSets: 3,
    defaultWorkMinutes: 1,
    defaultRestSeconds: 60,
    alternatives: [
      { name: 'Elevación de rodillas colgando', equipment: 'Barra', note: 'Versión más accesible si no puedes las piernas rectas' },
      { name: 'Elevación de piernas en banco inclinado', equipment: 'Banco', note: 'Menor demanda de agarre con mismo estímulo abdominal' },
      { name: 'Dragon flag', equipment: 'Banco', note: 'Nivel avanzado de anti-extensión y control' }
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

  if (normTitle.includes('face pull') || (normTitle.includes('cuerda') && (normTitle.includes('cara') || normTitle.includes('espalda')))) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'face_pull')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('remo horizontal') || normTitle.includes('remo sentado') || normTitle.includes('seated row')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'remo_horizontal')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('remo elevado') || normTitle.includes('al menton') || normTitle.includes('al mentón')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'remo_elevado')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('pullover') || normTitle.includes('pull over')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'pullover')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('hip thrust') || (normTitle.includes('puente') && normTitle.includes('glute'))) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'hip_thrust')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('zancada') || normTitle.includes('lunge') || normTitle.includes('estocada')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'zancada')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('bulgara') || normTitle.includes('búlgara')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'sentadilla_bulgara')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('plancha') || normTitle.includes('plank')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'plancha')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('martillo')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'curl_martillo')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('frances') || normTitle.includes('francés') || normTitle.includes('skull crusher')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'press_frances')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('apertura') || normTitle.includes('cruce') || normTitle.includes('pec fly')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'aperturas_pecho')!;
    return { found: true, matchedTitle: item.name, categoryLabel: item.categoryLabel, category: item.category, alternatives: item.alternatives };
  }
  if (normTitle.includes('pajaro') || normTitle.includes('pájaro') || normTitle.includes('rear delt')) {
    const item = GYM_EXERCISE_CATALOG.find(e => e.id === 'pajaros')!;
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
      duration: 1,
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
      duration: 1, // 3 min por serie de trabajo estimado
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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

    {
      id: 'task_gym_rest_1_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_1_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_1_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_1_4',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 3.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_1_5',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 4.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_1_6',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_a',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar al cardio.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 5.5,
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
      duration: 1.5,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_0',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 1,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_press_banca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Press horizontal (Press de banca)',
      description: '4 series en banco plano. Trabajo horizontal de pecho junto al press inclinado (2 de pecho y 2 de espalda).',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_remo_horizontal',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Remo horizontal en polea',
      description: '4 series en polea sentado. Espalda erguida, tracción horizontal al ombligo y retracción escapular (en vez de remo gironda).',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
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
      description: '4 series. Agarre medio o ancho para variedad de fibras y amplitud dorsal.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 3.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_face_pull',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Face pull con cuerda',
      description: '3 series en polea alta con cuerda acercándola a la cara para espalda alta y deltoides posterior (30x8, 35x8, 45x3).',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      weightLogs: [
        { set: 1, weightKg: 30, reps: 8, date: EPOCH },
        { set: 2, weightKg: 35, reps: 8, date: EPOCH },
        { set: 3, weightKg: 45, reps: 3, date: EPOCH }
      ],
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_4',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 4.5,
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
      description: '4 series en polea o mancuerna para redondez del deltoides.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_5',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 5.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_extension_triceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Extensión de tríceps en polea',
      description: '3 series unilaterales con cable de polea estirándolo y con giro de muñeca al final para mayor presión (15x10, 20x5 en cada brazo).',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      weightLogs: [
        { set: 1, weightKg: 15, reps: 10, date: EPOCH },
        { set: 2, weightKg: 20, reps: 5, date: EPOCH }
      ],
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 6,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_6',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar a la siguiente máquina.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 6.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_3_curl_biceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Curl de bíceps',
      description: '3 series de curl con mancuernas, barra o polea para completar el trabajo de brazos.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 7,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_3_7',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_sup_b',
      title: 'Descanso entre ejercicios',
      description: 'Recuperar aire y pasar al cardio final.',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 7.5,
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
      order: 8,
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
      title: 'Intentar practicar dominadas',
      description: 'Práctica libre al final del todo sin presión. Colgarse, negativas o dominadas asistidas para ir cogiendo fuerza.',
      targetCount: 2,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 9,
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
      duration: 1.5,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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
      duration: 1,
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


export type GymRoutineSplit = 'torso_pierna_4d' | 'ppl_3d' | 'fullbody_3d';

export function createPplGymRoutine(userId: string = '') {
  const EPOCH = new Date(0).toISOString();
  const listId = 'gimnasio';

  const sections: ListSection[] = [
    { id: 'sec_gym_diaria', listId, name: 'Diaria: Core y Estiramientos', order: 0, updated_at: EPOCH },
    { id: 'sec_gym_ppl_push', listId, name: 'Día 1: Empuje (Pecho, Hombro, Tríceps)', order: 1, updated_at: EPOCH },
    { id: 'sec_gym_ppl_pull', listId, name: 'Día 2: Tirón (Espalda, Bíceps, Posterior)', order: 2, updated_at: EPOCH },
    { id: 'sec_gym_ppl_legs', listId, name: 'Día 3: Pierna y Glúteo', order: 3, updated_at: EPOCH },
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
      description: 'Movilidad dinámica articular antes de comenzar la sesión.',
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
      title: 'Curl de brazo',
      description: 'Bíceps y flexores de brazo diarios.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
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
      description: 'Estiramientos estáticos y relajación tras el entreno.',
      duration: 5,
      cycle_id: 'cycle_day',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 1: EMPUJE ---
    {
      id: 'task_gym_ppl_push_banca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Press de banca plano',
      description: '4 series pesadas en banco plano.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_push_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_push_militar',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Press militar',
      description: '3 series de empuje vertical para hombro anterior y medio.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_push_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_push_inclinado',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Press inclinado con mancuernas',
      description: '3 series con banco a 30º para pectoral superior.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_push_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_push_triceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Extensión de tríceps en polea (cuerda o barra)',
      description: '3 series de 10-12 reps abriendo al final.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_push_4',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 3.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_push_laterales',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_push',
      title: 'Elevaciones laterales en polea o mancuernas',
      description: '3 series de 12-15 reps para deltoides lateral.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 2: TIRÓN ---
    {
      id: 'task_gym_ppl_pull_remo',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Remo horizontal con barra o mancuerna',
      description: '4 series pesadas con recorrido completo.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_pull_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_pull_jalon',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Jalón al pecho',
      description: '4 series controladas de dorsal ancho.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_pull_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_pull_facepull',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Face pull con cuerda (espalda alta)',
      description: '3 series tirando hacia la cara, codos altos.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_pull_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_pull_biceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Curl de bíceps en polea o mancuerna',
      description: '3 series unilaterales o con barra.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_pull_4',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 3.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_pull_dominadas',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_pull',
      title: 'Dominadas (práctica y series técnicas)',
      description: 'Intentar practicar al final del tirón con buena forma.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // --- DÍA 3: PIERNA Y GLÚTEO ---
    {
      id: 'task_gym_ppl_legs_jaca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Jaca o Sentadilla en multipower',
      description: '4 series pesadas con profundidad controlada.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_legs_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_legs_prensa',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Prensa de piernas',
      description: '4 series de 8-10 repeticiones.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_legs_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_legs_legcurl',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Leg curl femoral en máquina',
      description: '4 series de 10-12 reps para isquios.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_legs_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_legs_extensiones',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Extensiones de cuádriceps',
      description: '3 series con contracción isométrica de 1s arriba.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_legs_4',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 3.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_legs_gluteo',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Máquina de glúteos / Elevación de pelvis',
      description: '3 series de 10-12 reps apretando arriba.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 4,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_ppl_legs_5',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 4.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_ppl_legs_gemelos',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_ppl_legs',
      title: 'Gemelos en máquina',
      description: '4 series de 15 reps con pausa abajo.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 60,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    }
  ];

  return { sections, tasks };
}

export function createFullBodyGymRoutine(userId: string = '') {
  const EPOCH = new Date(0).toISOString();
  const listId = 'gimnasio';

  const sections: ListSection[] = [
    { id: 'sec_gym_diaria', listId, name: 'Diaria: Core y Estiramientos', order: 0, updated_at: EPOCH },
    { id: 'sec_gym_fb_a', listId, name: 'Día 1: Full Body A', order: 1, updated_at: EPOCH },
    { id: 'sec_gym_fb_b', listId, name: 'Día 2: Full Body B', order: 2, updated_at: EPOCH },
    { id: 'sec_gym_fb_c', listId, name: 'Día 3: Full Body C', order: 3, updated_at: EPOCH },
  ];

  const tasks: TaskItem[] = [
    // Día 1 Full Body A
    {
      id: 'task_gym_fb_a_banca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Press de banca plano',
      description: '4 series pesadas en banco plano.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_a_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_a_jaca',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Jaca o Sentadilla en multipower',
      description: '4 series de piernas con profundidad controlada.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_a_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_a_remo',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Remo horizontal con barra o mancuerna',
      description: '4 series de espalda media y densidad dorsal.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_a_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_a_triceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_a',
      title: 'Extensión de tríceps en polea',
      description: '3 series para finalizar brazo.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // Día 2 Full Body B
    {
      id: 'task_gym_fb_b_prensa',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Prensa de piernas',
      description: '4 series pesadas para cuadríceps y glúteos.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_b_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_b_militar',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Press militar',
      description: '4 series de empuje vertical de hombros.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_b_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_b_jalon',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Jalón al pecho',
      description: '4 series de dorsal ancho.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 90,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_b_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_b_biceps',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_b',
      title: 'Curl de bíceps en polea',
      description: '3 series para rematar brazo.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },

    // Día 3 Full Body C
    {
      id: 'task_gym_fb_c_inclinado',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Press inclinado con mancuernas',
      description: '4 series para pectoral superior.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 0,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_c_1',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 0.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_c_rumano',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Peso muerto rumano o Leg curl',
      description: '4 series para isquiosurales y cadena posterior.',
      targetCount: 4,
      currentCount: 0,
      duration: 1,
      restDuration: 120,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 1,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_c_2',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 1.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_c_facepull',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Face pull con cuerda en polea',
      description: '3 series para deltoides posterior y espalda alta.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 2,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_rest_fb_c_3',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Descanso entre ejercicios',
      duration: 2,
      isRest: true,
      status: 'pending',
      order: 2.5,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    },
    {
      id: 'task_gym_fb_c_laterales',
      user_id: userId,
      type: 'task',
      categoryId: listId,
      sectionId: 'sec_gym_fb_c',
      title: 'Elevaciones laterales en polea',
      description: '3 series para deltoides lateral.',
      targetCount: 3,
      currentCount: 0,
      duration: 1,
      restDuration: 75,
      cycle_id: 'cycle_week',
      status: 'pending',
      order: 3,
      version: 1,
      created_at: EPOCH,
      updated_at: EPOCH
    }
  ];

  return { sections, tasks };
}

export function switchGymRoutineSplit(
  listId: string,
  split: GymRoutineSplit,
  userId: string = ''
) {
  const state = useAppStore.getState();
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;

  let newRoutine: { sections: ListSection[]; tasks: TaskItem[] };
  if (split === 'ppl_3d') {
    newRoutine = createPplGymRoutine(userId);
  } else if (split === 'fullbody_3d') {
    newRoutine = createFullBodyGymRoutine(userId);
  } else {
    newRoutine = createDefaultGymRoutine(userId);
  }

  const currentSections = state.listSections.filter(s => s.listId === listId);
  const currentTasks = Object.values(state.tasks).filter(t => !t.deleted_at && (t.categoryId === listId || (t as any).category_id === listId));

  const dailySecIds = new Set(currentSections.filter(s => /diaria|core/i.test(s.name)).map(s => s.id));

  // Eliminar secciones no diarias antiguas y sus tareas
  for (const s of currentSections) {
    if (!dailySecIds.has(s.id)) {
      state.deleteListSection(s.id);
    }
  }

  for (const t of currentTasks) {
    if (t.sectionId && !dailySecIds.has(t.sectionId)) {
      state.deleteTask(t.id);
    }
  }

  // Añadir nuevas secciones
  for (const sec of newRoutine.sections) {
    if (/diaria|core/i.test(sec.name) && dailySecIds.size > 0) {
      continue;
    }
    state.addListSection({ ...sec, listId });
  }

  // Añadir nuevas tareas
  const hasDailyTasks = currentTasks.some(t => t.sectionId && dailySecIds.has(t.sectionId));
  for (const t of newRoutine.tasks) {
    if (/diaria|core/i.test(t.sectionId || '') && hasDailyTasks) {
      continue;
    }
    state.addTask({ ...t, categoryId: listId });
  }

  // Actualizar metadatos de lista
  state.updateList(listId, {
    activeRoutineSplit: split,
    activeGymDaySectionId: undefined
  });
}
