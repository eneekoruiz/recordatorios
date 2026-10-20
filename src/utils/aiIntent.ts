// Comprensión de intenciones del asistente local (sin red): frecuencias dichas de forma natural,
// marcos de «quiero añadir…», respuestas de sí/no, cambios de lista con negaciones y a qué lista
// pertenece un recordatorio por su contenido. Funciones puras para poder probarlas con frases reales.
import type { CustomList, TaskItem } from '../models/Task';

export type AssistantCycle = 'cycle_day' | 'cycle_week' | 'cycle_month' | 'cycle_year';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── Frecuencia ──────────────────────────────────────────────────────────────────────────────

const UNIT_TO_CYCLE: Record<string, AssistantCycle> = { dia: 'cycle_day', semana: 'cycle_week', mes: 'cycle_month', ano: 'cycle_year' };
const NUMBER_WORDS: Record<string, number> = { una: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
/** «o así», «más o menos»… detrás de una frecuencia: no forman parte del título. */
const HEDGE = '(?:\\s*,?\\s*(?:o\\s+as[ií]|o\\s+algo\\s+as[ií]|m[aá]s\\s+o\\s+menos|aproximadamente|como\\s+mucho|m[aá]s\\s+o\\s+menos))?';

export interface FrequencyPhrase {
  cycle: AssistantCycle;
  /** Veces por periodo cuando son más de una («dos veces por semana» → 2). */
  targetCount?: number;
  /** Texto exacto a retirar del título. */
  matched: string;
}

/**
 * «una vez al mes o así», «1 vez por semana», «dos veces a la semana», «cada mes», «todos los días»,
 * «a diario», «mensualmente», «cada año». Devuelve la primera que aparezca.
 */
export function readFrequency(text: string): FrequencyPhrase | null {
  const patterns: { re: RegExp; read: (m: RegExpMatchArray) => FrequencyPhrase | null }[] = [
    {
      re: new RegExp(`\\b(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|\\d{1,2})\\s+(?:vez|veces)\\s+(?:al|a\\s+la|por|cada|en\\s+el|en\\s+la)\\s+(d[ií]a|semana|mes|a[ñn]o)${HEDGE}`, 'i'),
      read: (m) => {
        const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[fold(m[1])];
        const cycle = UNIT_TO_CYCLE[fold(m[2])];
        if (!cycle || !n) return null;
        return { cycle, targetCount: n > 1 ? n : undefined, matched: m[0] };
      },
    },
    {
      re: new RegExp(`\\b(?:todos\\s+los|todas\\s+las|cada)\\s+(d[ií]as?|semanas?|mes(?:es)?|a[ñn]os?)${HEDGE}`, 'i'),
      read: (m) => {
        const plural: Record<string, string> = { dias: 'dia', semanas: 'semana', meses: 'mes', anos: 'ano' };
        const word = fold(m[1]);
        const cycle = UNIT_TO_CYCLE[plural[word] ?? word];
        return cycle ? { cycle, matched: m[0] } : null;
      },
    },
    {
      re: new RegExp(`\\b(a\\s+diario|diariamente|semanalmente|mensualmente|anualmente)${HEDGE}`, 'i'),
      read: (m) => {
        const w = fold(m[1]);
        const cycle: AssistantCycle = w.includes('diari') ? 'cycle_day' : w.startsWith('seman') ? 'cycle_week' : w.startsWith('mens') ? 'cycle_month' : 'cycle_year';
        return { cycle, matched: m[0] };
      },
    },
  ];
  let best: { index: number; phrase: FrequencyPhrase } | null = null;
  for (const { re, read } of patterns) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    const phrase = read(m);
    if (phrase && (!best || m.index < best.index)) best = { index: m.index, phrase };
  }
  return best?.phrase ?? null;
}

/** «una sola vez», «solo una vez», «sin repetir», «que no se repita» → quitar la repetición. */
export function asksForNoRepeat(text: string): boolean {
  return /\b(?:una\s+sola\s+vez|s[oó]lo\s+una\s+vez|sin\s+repetir|que\s+no\s+se\s+repita|no\s+se\s+repite|puntual)\b/i.test(text);
}

// ── Marcos de petición ──────────────────────────────────────────────────────────────────────

const ADD_VERB = '(?:a[ñn]adir|apuntar|anotar|agregar|poner|meter|crear|guardar|programar|tener)';
const ADD_FRAME = new RegExp(
  '^(?:(?:yo\\s+)?(?:quiero|quisiera|querr[ií]a|me\\s+gustar[ií]a|voy\\s+a|necesito|podr[ií]as|puedes|hay\\s+que)\\s+)'
  + `(?:que\\s+(?:me\\s+)?)?${ADD_VERB}(?:me|lo|la|te)?\\s+`
  + '(?:(?:un|una|el|la)\\s+(?=(?:nuevo\\s+)?(?:recordatorio|tarea|nota|h[aá]bito)\\b))?(?:(?:nuevo\\s+)?(?:recordatorio|tarea|nota|h[aá]bito)\\s+)?(?:(?:de|para|que)\\s+)?',
  'i',
);
const IMPERATIVE_FRAME = /^(?:a[ñn][áa]de(?:me)?|ap[úu]nta(?:me)?|an[óo]ta(?:me)?|agr[ée]ga(?:me)?|pon(?:me)?|m[ée]te(?:me)?|cr[ée]a(?:me)?|gu[áa]rda(?:me)?)\s+(?:(?:un|una)\s+)?(?:recordatorio|tarea|nota|h[aá]bito)\s+(?:(?:de|para|que)\s+)?/i;

/** «Quiero añadir una vez al mes hacerme las cejas» → «una vez al mes hacerme las cejas». */
export function stripAddRequest(text: string): string {
  return text.trim().replace(ADD_FRAME, '').replace(IMPERATIVE_FRAME, '').trim();
}

// ── Sí / no ─────────────────────────────────────────────────────────────────────────────────

/** Respuesta corta a «¿Lo añado?». null si el mensaje dice algo más que sí o no. */
export function readConfirmation(text: string): 'yes' | 'no' | null {
  const s = fold(text).replace(/[¡!¿?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.split(' ').length > 6) return null;
  if (/^(?:si|vale|ok|okay|okey|perfecto|de acuerdo|correcto|adelante|hazlo|dale|venga|genial|eso es|exacto|claro|por supuesto|confirmo|confirmar)(?: (?:por favor|gracias|anadelo|anadelos|apuntalo|apuntalos|crealo|crealos|guardalo|guardalos|todos|todo|asi))*$/.test(s)) return 'yes';
  if (/^(?:anadelo|anadelos|apuntalo|apuntalos|crealo|crealos|guardalo|guardalos)(?: (?:por favor|ya))?$/.test(s)) return 'yes';
  if (/^(?:no|nada|cancela|cancelar|dejalo|olvidalo|mejor no|no gracias|no lo anadas|no hace falta)$/.test(s)) return 'no';
  return null;
}

// ── Listas mencionadas (con negación) ───────────────────────────────────────────────────────

export interface ListRef { id: string; name: string }
export const INBOX_REF: ListRef = { id: 'inbox', name: 'Bandeja de entrada' };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lista a la que se pide llevar el recordatorio, descartando las mencionadas en negativo:
 * «no quiero que lo metas en la bandeja de entrada, quiero que lo metas en la lista de Care» → Care.
 * La polaridad la decide el último marcador antes de cada mención («no quiero», «no en» → negativo;
 * «quiero», «mejor», «en la lista de», «pásalo a» → positivo).
 */
export function readListTarget(text: string, lists: CustomList[]): ListRef | null {
  const candidates: { ref: ListRef; names: string[] }[] = [
    { ref: INBOX_REF, names: ['bandeja de entrada', 'la bandeja', 'inbox'] },
    ...lists.filter(l => l.name && !l.isFolder).map(l => ({ ref: { id: l.id, name: l.name }, names: [l.name] })),
  ];
  const source = fold(text);
  const mentions: { ref: ListRef; index: number; length: number }[] = [];
  for (const { ref, names } of candidates) {
    for (const name of names) {
      const re = new RegExp(`(^|[^a-z0-9])(${escapeRe(fold(name))})(?=$|[^a-z0-9])`, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) mentions.push({ ref, index: m.index + m[1].length, length: m[2].length });
    }
  }
  // La mención más larga gana si se solapan («Compra semanal» frente a «Compra»).
  mentions.sort((a, b) => a.index - b.index || b.length - a.length);
  const kept = mentions.filter((m, i) => !mentions.slice(0, i).some(p => m.index < p.index + p.length && p !== m && p.length >= m.length));
  let positive: ListRef | null = null;
  for (const mention of kept) {
    // Solo cuenta la cláusula en la que está la mención (tras la última coma, «sino» o «pero»).
    const before = source.slice(0, mention.index).split(/[,.;:]|\bsino\b|\bpero\b/).at(-1) ?? '';
    const after = source.slice(mention.index + mention.length);
    const markers = [...before.matchAll(/\b(no\s+(?:quiero|quisiera|prefiero|me\s+gusta|lo|la|los|las|en|a|es)|no|quiero|quisiera|prefiero|mejor|si|pasalo|pasala|muevelo|muevela|metelo|metela|ponlo|ponla|cambialo|cambiala|llevalo|llevala)\b/g)];
    const last = markers.at(-1)?.[1] ?? '';
    // «en la bandeja no» también es negativo.
    const negative = /^no\b/.test(last) || /^\s*no\b/.test(after);
    if (!negative) positive = mention.ref;
  }
  return positive;
}

/** El mensaje habla de lo que se acaba de proponer («lo», «eso», «pero…», «no, mejor…»). */
export function referencesPending(text: string): boolean {
  const s = fold(text);
  return /\b(?:lo|la|los|las)\s+(?:(?:vas?|van)\s+a\s+)?(?:met|pon|guard|apunt|anad|agreg|cambi|mov|pas|cre|llev)\w*/.test(s)
    || /\b(?:eso|esto|ese|esa|este|esta|el\s+recordatorio|la\s+tarea|lo\s+de\s+antes)\b/.test(s)
    || /^(?:pero|no|mejor|y\s+si|que\s+tal\s+si|cambia|cambialo|cambiala|pasalo|pasala|muevelo|ponlo|metelo|en\s+(?:la\s+lista\s+)?(?:de\s+)?\w+$)/.test(s.replace(/^[^a-z]+/, ''));
}

// ── Lista adecuada por contenido ────────────────────────────────────────────────────────────

const STOPWORDS = new Set(('a al algo algun alguna ante con contra cual cuando de del desde donde el ella ellas ellos en entre era es esa ese eso esta este esto fue ha han hay la las le les lo los me mi mis muy nada ni no nos o os otra otro para pero por que quien se si sin sobre su sus te tu tus un una unas uno unos y ya yo hacer hacerme poner ponerme tener ir vez veces dia dias semana mes ano cada todos todas mucho poco algo bien mas').split(' '));

/** Palabras con su raíz aproximada (sin tildes, sin plural): «cejas» y «ceja» coinciden. */
export function contentTokens(text: string): string[] {
  // «uñas» sin tilde sería «unas» (un artículo): se conserva distinto.
  return fold(text.replace(/uñ/gi, 'unh')).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w)).map(w => w.replace(/(?:es|s)$/, ''));
}

/** Temas habituales: palabras que delatan el tema y cómo se suele llamar una lista de ese tema. */
const THEMES: { list: RegExp; words: string[] }[] = [
  { list: /\b(?:care|cuidado|cuidados|belleza|skin|skincare|estetica|autocuidado|beauty)\b/, words: ['ceja', 'pestana', 'unha', 'manicura', 'pedicura', 'pelo', 'cabello', 'peluqueria', 'tinte', 'mecha', 'depilar', 'depilacion', 'cera', 'laser', 'crema', 'serum', 'mascarilla', 'exfoliar', 'exfoliante', 'facial', 'cara', 'piel', 'rostro', 'maquillaje', 'afeitar', 'barba', 'contorno', 'protector', 'hidratar', 'hidratante', 'tonico', 'limpiador', 'cuticula', 'spa', 'masaje', 'labio', 'ojera', 'pomulo'] },
  { list: /\b(?:limpieza|limpiar|casa|hogar|quehacer|quehaceres|tareas\s+de\s+casa)\b/, words: ['limpiar', 'fregar', 'barrer', 'aspirar', 'polvo', 'bano', 'cocina', 'nevera', 'horno', 'cristal', 'ventana', 'lavadora', 'ropa', 'tender', 'planchar', 'sabana', 'basura', 'lavavajilla', 'friegaplato', 'suelo', 'fregona', 'microonda', 'vitro', 'colada'] },
  { list: /\b(?:compra|compras|super|supermercado|mercado|despensa)\b/, words: ['comprar', 'leche', 'pan', 'huevo', 'fruta', 'verdura', 'carne', 'pescado', 'arroz', 'pasta', 'aceite', 'cafe', 'yogur', 'queso', 'agua', 'papel', 'detergente', 'champu', 'gel'] },
  { list: /\b(?:trabajo|work|oficina|empresa|curro|proyecto)\b/, words: ['reunion', 'informe', 'cliente', 'email', 'correo', 'presentacion', 'proyecto', 'factura', 'oficina', 'llamada', 'propuesta', 'entrega', 'jefe'] },
  { list: /\b(?:salud|medico|medica|medicina)\b/, words: ['medico', 'cita', 'dentista', 'pastilla', 'medicacion', 'analisi', 'farmacia', 'fisio', 'vacuna', 'receta'] },
  { list: /\b(?:deporte|entreno|entrenamiento|gym|gimnasio|fitness|ejercicio)\b/, words: ['gimnasio', 'correr', 'entrenar', 'pesa', 'abdominal', 'ab', 'curl', 'flexion', 'sentadilla', 'yoga', 'estiramiento', 'plancha', 'cardio', 'nadar', 'bici'] },
];

export interface ListGuess { list: ListRef; score: number; runnerUp?: ListRef }

/**
 * Lista más probable para un recordatorio sin lista dicha: por tema (cejas → una lista de
 * cuidado como «Care») y por parecido con lo que ya hay en cada lista. Solo devuelve algo si hay
 * una ganadora clara; si no, mejor preguntar que adivinar.
 */
export function inferList(title: string, lists: CustomList[], tasks: TaskItem[] = []): ListGuess | null {
  const tokens = new Set(contentTokens(title));
  if (!tokens.size) return null;
  const scored = lists.filter(l => l.name && !l.isFolder).map((list) => {
    const name = fold(`${list.name} ${list.id}`);
    let score = 0;
    for (const theme of THEMES) {
      if (theme.list.test(name) && theme.words.some(w => tokens.has(w))) score += 3;
    }
    // Parecido con tareas existentes de la lista (palabras de contenido compartidas).
    let overlap = 0;
    for (const task of tasks) {
      if (task.deleted_at || task.categoryId !== list.id) continue;
      const shared = contentTokens(task.title || '').filter(w => tokens.has(w)).length;
      overlap = Math.max(overlap, shared);
    }
    score += Math.min(overlap, 3);
    // El propio nombre de la lista dentro del texto («la crema de Care») cuenta mucho.
    if (contentTokens(list.name).some(w => tokens.has(w))) score += 2;
    return { list: { id: list.id, name: list.name }, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < 2) return null;
  if (second && second.score >= best.score) return null;
  return { list: best.list, score: best.score, runnerUp: second?.list };
}

// ── Cómo se dice una propuesta ──────────────────────────────────────────────────────────────

const CYCLE_WORDS: Record<AssistantCycle, string> = { cycle_day: 'cada día', cycle_week: 'cada semana', cycle_month: 'cada mes', cycle_year: 'cada año' };
const TIMES_WORDS: Record<AssistantCycle, string> = { cycle_day: 'al día', cycle_week: 'a la semana', cycle_month: 'al mes', cycle_year: 'al año' };

export function describeRepeat(cycle?: AssistantCycle, targetCount?: number): string {
  if (!cycle) return '';
  if (targetCount && targetCount > 1) return `${targetCount} veces ${TIMES_WORDS[cycle]}`;
  return CYCLE_WORDS[cycle];
}

export interface DescribableTask { title: string; listName?: string; cycle?: AssistantCycle; targetCount?: number; dueDate?: string }

const dateWords = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const when = diff === 0 ? 'hoy' : diff === 1 ? 'mañana' : `el ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`;
  const hasTime = d.getHours() !== 12 || d.getMinutes() !== 0;
  return hasTime ? `${when} a las ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : when;
};

/**
 * Pregunta corta y explícita antes de crear nada: «¿Apunto «Hacerme las cejas» cada mes en Care?».
 * Con varias: «¿Apunto estos 3 en Compra?» (o en qué listas van, si son varias).
 */
export function describeProposal(tasks: DescribableTask[]): string {
  if (tasks.length === 0) return '';
  const listOf = (t: DescribableTask) => t.listName || INBOX_REF.name;
  if (tasks.length === 1) {
    const t = tasks[0];
    const parts = [`«${t.title}»`];
    const repeat = describeRepeat(t.cycle, t.targetCount);
    if (repeat) parts.push(repeat);
    if (t.dueDate && !repeat) parts.push(dateWords(t.dueDate));
    return `¿Apunto ${parts.join(' ')} en ${listOf(t)}?`;
  }
  const lists = [...new Set(tasks.map(listOf))];
  const where = lists.length === 1 ? `en ${lists[0]}` : `en ${lists.slice(0, -1).join(', ')} y ${lists.at(-1)}`;
  return `¿Apunto estos ${tasks.length} ${where}?`;
}
