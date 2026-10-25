import { VITAL_HABITS_LIST_ID, VITAL_HABITS_SECTION_ID, VITAL_HABIT_TITLE_REGEX } from './vitalHabits';
import type { TaskItem } from '../models/Task';

const normalize = (s?: string | null): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export interface ContentMigrationStore {
  tasks: Record<string, TaskItem>;
  lists?: any[];
  listSections?: any[];
  addList: (list: any) => void;
  updateList?: (id: string, updates: any) => void;
  deleteList?: (id: string) => void;
  addListSection: (sec: any) => void;
  updateListSection?: (id: string, updates: any) => void;
  deleteListSection?: (id: string) => void;
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask?: (id: string) => void;
}

/**
 * Migración idempotente de contenidos y secciones críticas:
 * 1. Integra Hábitos vitales como subsección fija en Quehaceres diarios (sin duración).
 * 2. Migra cualquier microhábito vital a Quehaceres > Hábitos vitales, restaurando tareas si estaban soft-deleted.
 * 3. Retira la lista independiente de Hábitos vitales tras mover con seguridad todo su contenido.
 * 4. Garantiza 'Limpiar el horno a fondo' en frecuencia mensual.
 * 5. Modifica 'Regar las plantas' para incluir 'Añadir abono para que crezcan más rápido'.
 * 6. Reestructura 'Limpiar espejos' en frecuencia semanal con 3 subtareas y 10 min de duración máxima.
 * 7. Añade la tarea semanal 'Tirar el albornoz a la lavadora'.
 * 8. Configura la Biblioteca de vida unificada.
 */
export function runContentMigrations(store: ContentMigrationStore): void {
  const tasks = store.tasks || {};
  const lists = store.lists || [];
  const sections = store.listSections || [];
  const NOW = new Date().toISOString();
  const EPOCH = NOW;

  // Encontrar o crear secciones de referencia para rutinas
  const findOrCreateSection = (listId: string, periodicityName: string, fallbackId: string) => {
    let sec = sections.find(s => s.listId === listId && normalize(s.name).includes(normalize(periodicityName)));
    if (!sec) {
      sec = {
        id: fallbackId,
        listId,
        name: periodicityName,
        order: periodicityName === 'Hábitos vitales' ? 0 : periodicityName === 'Diarias' ? 1 : periodicityName === 'Semanales' ? 2 : 3,
        updated_at: EPOCH
      };
      store.addListSection(sec);
    }
    return sec;
  };

  const limpiezaList = lists.find(l => l.id === 'limpieza' || normalize(l.name).includes('limpieza'));
  const quehaceresList = lists.find(l => l.id === 'quehaceres' || normalize(l.name).includes('quehacer')) || { id: 'quehaceres' };

  // Hábitos vitales: viven SIEMPRE integrados dentro de Quehaceres diarios
  const vitalListId = quehaceresList.id || 'quehaceres';
  // Tareas de hogar/limpieza (horno, plantas, espejos, albornoz): en Limpieza si existe, o Quehaceres
  const routinesListId = limpiezaList?.id || quehaceresList.id || 'limpieza';

  const secHabitosVitales = findOrCreateSection(vitalListId, 'Hábitos vitales', VITAL_HABITS_SECTION_ID);
  const secSemanales = findOrCreateSection(routinesListId, 'Semanales', `sec_${routinesListId}_semanales`);
  const secMensuales = findOrCreateSection(routinesListId, 'Mensuales', `sec_${routinesListId}_mensuales`);

  const habitosList = lists.find(l => l.id === VITAL_HABITS_LIST_ID || normalize(l.name) === 'habitos vitales' || normalize(l.name) === 'habitos de vida');
  const habitosListId = habitosList?.id || VITAL_HABITS_LIST_ID;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. INTEGRAR Y TRASLADAR HÁBITOS VITALES COMO SUBSECCIÓN EN QUEHACERES
  // (Paso crítico: trasladar y desmarcar de borrado ANTES de eliminar el contenedor)
  // ──────────────────────────────────────────────────────────────────────────
  Object.values(tasks).forEach(t => {
    const titleNorm = normalize(t.title);
    const isVital =
      t.categoryId === habitosListId ||
      t.categoryId === VITAL_HABITS_LIST_ID ||
      VITAL_HABIT_TITLE_REGEX.test(t.title || '') ||
      titleNorm === 'beber agua' ||
      titleNorm === 'comer';

    if (isVital) {
      const updatePayload: any = {
        categoryId: vitalListId,
        sectionId: secHabitosVitales.id,
        duration: undefined,
        parallelDuration: undefined,
        disableDuration: true,
        deleted_at: undefined
      };
      if (titleNorm.includes('agua')) {
        updatePayload.title = 'Beber agua';
        updatePayload.targetCount = 10;
        if (t.currentCount === undefined) updatePayload.currentCount = 0;
        updatePayload.cycle_id = 'cycle_day';
      } else if (titleNorm === 'comer' || titleNorm === 'almorzar') {
        updatePayload.cycle_id = 'cycle_day';
        if (!t.timeOfDay) updatePayload.timeOfDay = 'afternoon';
      } else if (titleNorm === 'desayunar') {
        updatePayload.cycle_id = 'cycle_day';
        if (!t.timeOfDay) updatePayload.timeOfDay = 'morning';
      } else if (titleNorm === 'cenar') {
        updatePayload.cycle_id = 'cycle_day';
        if (!t.timeOfDay) updatePayload.timeOfDay = 'night';
      }
      store.updateTask(t.id, updatePayload);
    }
  });

  // Asegurar que 'Beber agua' (10 veces, diaria) y 'Comer' (diaria) existen con la subsección en la lista unificada
  const vitalTasks = Object.values(store.tasks || {}).filter(t => !t.deleted_at && (t.sectionId === secHabitosVitales.id || (t.categoryId === vitalListId && (normalize(t.title).includes('beber agua') || normalize(t.title).includes('comer')))));
  const hasAgua = vitalTasks.some(t => normalize(t.title).includes('beber agua'));
  const hasComer = vitalTasks.some(t => normalize(t.title).includes('comer'));

  if (!hasAgua) {
    store.addTask({
      title: 'Beber agua',
      categoryId: vitalListId,
      sectionId: secHabitosVitales.id,
      priority: 'none',
      status: 'pending',
      disableDuration: true,
      duration: undefined,
      cycle_id: 'cycle_day',
      targetCount: 10,
      currentCount: 0
    });
  } else {
    const aguaTask = vitalTasks.find(t => normalize(t.title).includes('beber agua'));
    if (aguaTask && (aguaTask.targetCount !== 10 || aguaTask.cycle_id !== 'cycle_day')) {
      store.updateTask(aguaTask.id, {
        targetCount: 10,
        currentCount: aguaTask.currentCount ?? 0,
        cycle_id: 'cycle_day',
        disableDuration: true,
        duration: undefined
      });
    }
  }

  if (!hasComer) {
    store.addTask({
      title: 'Comer',
      categoryId: vitalListId,
      sectionId: secHabitosVitales.id,
      priority: 'none',
      status: 'pending',
      disableDuration: true,
      duration: undefined,
      cycle_id: 'cycle_day',
      timeOfDay: 'afternoon'
    });
  } else {
    const comerTask = vitalTasks.find(t => normalize(t.title).includes('comer'));
    if (comerTask && comerTask.cycle_id !== 'cycle_day') {
      store.updateTask(comerTask.id, {
        cycle_id: 'cycle_day',
        timeOfDay: comerTask.timeOfDay || 'afternoon',
        disableDuration: true,
        duration: undefined
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ELIMINAR EL CONTENEDOR OBSOLETO TRAS ASEGURAR EL TRASLADO DE TODAS LAS TAREAS
  // ──────────────────────────────────────────────────────────────────────────
  if (habitosList) {
    if (store.deleteList) {
      store.deleteList(habitosList.id);
    } else if (store.updateList) {
      store.updateList(habitosList.id, { deleted_at: new Date().toISOString() });
    }
  }

  const allActiveTasks = Object.values(store.tasks || tasks).filter(t => !t.deleted_at);

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 'Limpiar el horno a fondo' -> MENSUAL
  // ──────────────────────────────────────────────────────────────────────────
  let hornoTask = allActiveTasks.find(t => normalize(t.title).includes('horno'));
  if (hornoTask) {
    if (hornoTask.sectionId !== secMensuales.id || hornoTask.categoryId !== routinesListId) {
      store.updateTask(hornoTask.id, {
        title: 'Limpiar el horno a fondo',
        categoryId: routinesListId,
        sectionId: secMensuales.id
      });
    }
  } else {
    store.addTask({
      title: 'Limpiar el horno a fondo',
      categoryId: routinesListId,
      sectionId: secMensuales.id,
      priority: 'medium',
      status: 'pending'
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. 'Regar las plantas' -> Incluir 'Añadir abono para que crezcan más rápido'
  // ──────────────────────────────────────────────────────────────────────────
  const EXACT_ABONO_TEXT = 'Añadir abono para que crezcan más rápido';
  const plantasTask = allActiveTasks.find(t => normalize(t.title).includes('regar') && normalize(t.title).includes('planta'));
  if (plantasTask) {
    // Comprobar si ya existe una subtarea con ese texto
    const existingSubtasks = allActiveTasks.filter(t => t.parentId === plantasTask.id);
    const hasAbonoSubtask = existingSubtasks.some(s => (s.title || '').trim() === EXACT_ABONO_TEXT);
    if (!hasAbonoSubtask) {
      store.addTask({
        title: EXACT_ABONO_TEXT,
        parentId: plantasTask.id,
        categoryId: plantasTask.categoryId,
        sectionId: plantasTask.sectionId,
        priority: 'none',
        status: 'pending'
      });
    }
  } else {
    // Si no existía, crear la tarea con su subtarea
    const newPlantasId = 'task_regar_plantas_' + Date.now();
    store.addTask({
      id: newPlantasId,
      title: 'Regar las plantas',
      categoryId: routinesListId,
      sectionId: secSemanales.id,
      priority: 'medium',
      status: 'pending'
    });
    store.addTask({
      title: EXACT_ABONO_TEXT,
      parentId: newPlantasId,
      categoryId: routinesListId,
      sectionId: secSemanales.id,
      priority: 'none',
      status: 'pending'
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. 'Limpiar espejos' -> SEMANAL general, 10 min máx, 3 subtareas exactas
  // ──────────────────────────────────────────────────────────────────────────
  const EXACT_ESPEJOS_SUBTASKS = [
    'Espejo de mi cuarto',
    'Espejo de la entrada',
    'Espejo del baño'
  ];

  let espejosTask = allActiveTasks.find(t => {
    const n = normalize(t.title);
    return n.includes('espejo') && !EXACT_ESPEJOS_SUBTASKS.map(normalize).includes(n) && !t.parentId;
  });

  if (espejosTask) {
    store.updateTask(espejosTask.id, {
      title: 'Limpiar espejos',
      categoryId: routinesListId,
      sectionId: secSemanales.id,
      duration: 10,
      disableDuration: false
    });
  } else {
    const newEspejosId = 'task_limpiar_espejos_' + Date.now();
    store.addTask({
      id: newEspejosId,
      title: 'Limpiar espejos',
      categoryId: routinesListId,
      sectionId: secSemanales.id,
      duration: 10,
      priority: 'medium',
      status: 'pending'
    });
    espejosTask = { id: newEspejosId, title: 'Limpiar espejos' } as any;
  }

  // Sincronizar las 3 subtareas exactas de espejos
  const currentEspejosSubtasks = allActiveTasks.filter(t => t.parentId === espejosTask!.id);
  const currentSubtaskTitles = new Set(currentEspejosSubtasks.map(s => (s.title || '').trim()));

  EXACT_ESPEJOS_SUBTASKS.forEach(subTitle => {
    if (!currentSubtaskTitles.has(subTitle)) {
      store.addTask({
        title: subTitle,
        parentId: espejosTask!.id,
        categoryId: routinesListId,
        sectionId: secSemanales.id,
        status: 'pending',
        priority: 'none',
        duration: undefined,
        disableDuration: true
      });
    }
  });

  // Limpiar subtareas huérfanas o redundantes de espejos fuera de las 3 oficiales
  currentEspejosSubtasks.forEach(s => {
    const trimmed = (s.title || '').trim();
    if (!EXACT_ESPEJOS_SUBTASKS.includes(trimmed)) {
      store.updateTask(s.id, { deleted_at: new Date().toISOString() });
    } else {
      // Las subtareas oficiales NO deben tener duración propia (el padre tiene 10 min)
      if (s.duration || !s.disableDuration) {
        store.updateTask(s.id, { duration: undefined, disableDuration: true });
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. 'Tirar el albornoz a la lavadora' -> SEMANAL
  // ──────────────────────────────────────────────────────────────────────────
  const EXACT_ALBORNOZ_TITLE = 'Tirar el albornoz a la lavadora';
  const hasAlbornoz = allActiveTasks.some(t => normalize(t.title).includes('albornoz'));
  if (!hasAlbornoz) {
    store.addTask({
      title: EXACT_ALBORNOZ_TITLE,
      categoryId: routinesListId,
      sectionId: secSemanales.id,
      priority: 'medium',
      status: 'pending',
      isParallel: true
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. 'Biblioteca de vida': unificar con 'Recuerda' si existe, crearla con sus secciones y clasificar medios
  // ──────────────────────────────────────────────────────────────────────────
  const isLibraryOrRecuerda = (l: any) => {
    if (!l) return false;
    const n = normalize(l.name);
    return l.id === 'biblioteca_vida' ||
      l.id === 'biblioteca' ||
      l.id === 'recuerda' ||
      n.includes('biblioteca de vida') ||
      n === 'biblioteca' ||
      n === 'recuerda';
  };

  const matchingLibLists = lists.filter((l: any) => !l.deleted_at && isLibraryOrRecuerda(l));
  let canonicalLibList = matchingLibLists.find((l: any) => l.id === 'biblioteca_vida') || matchingLibLists[0];

  if (canonicalLibList) {
    if (store.updateList && (canonicalLibList.listType !== 'library' || normalize(canonicalLibList.name) !== 'biblioteca de vida')) {
      store.updateList(canonicalLibList.id, {
        name: 'Biblioteca de vida',
        listType: 'library',
        color: '#ff2d55',
        icon: 'film'
      });
    }
  } else {
    const newLibId = 'biblioteca_vida';
    store.addList({
      id: newLibId,
      name: 'Biblioteca de vida',
      color: '#ff2d55',
      icon: 'film',
      listType: 'library',
      autoEstimateDuration: false,
      updated_at: EPOCH
    });
    canonicalLibList = { id: newLibId, name: 'Biblioteca de vida' };
  }

  const libListId = canonicalLibList.id;

  const defaultLibSections = [
    { name: 'Películas', key: 'peliculas' },
    { name: 'Series', key: 'series' },
    { name: 'Música', key: 'musica' },
    { name: 'Libros', key: 'libros' },
    { name: 'Apellidos', key: 'apellidos' },
    { name: 'Recursos y Web', key: 'recursos' }
  ];

  const currentLibSections = sections.filter(s => s.listId === libListId && !s.deleted_at);

  defaultLibSections.forEach((def, idx) => {
    const exists = currentLibSections.some(s => 
      s.id === `sec_${libListId}_${def.key}` || 
      normalize(s.name).includes(normalize(def.name))
    );
    if (!exists) {
      store.addListSection({
        id: `sec_${libListId}_${def.key}`,
        listId: libListId,
        name: def.name,
        order: idx,
        updated_at: EPOCH
      });
    }
  });

  // Soft-delete o eliminar secciones 'Recuerda' obsoletas en biblioteca_vida
  const obsoleteRecuerdaSecs = (store.listSections || sections).filter(
    s => s.listId === libListId && (normalize(s.name) === 'recuerda' || s.id.endsWith('_recuerda')) && !s.deleted_at
  );
  obsoleteRecuerdaSecs.forEach(s => {
    if (store.deleteListSection) {
      store.deleteListSection(s.id);
    } else if (store.updateListSection) {
      store.updateListSection(s.id, { deleted_at: NOW, updated_at: NOW });
    } else {
      s.deleted_at = NOW;
    }
  });

  const updatedLibSections = (store.listSections || sections).filter(s => s.listId === libListId && !s.deleted_at);
  const getSectionForType = (key: string) => {
    return updatedLibSections.find(s => s.id === `sec_${libListId}_${key}` || normalize(s.name).includes(key))?.id
      || updatedLibSections[0]?.id;
  };

  const CANONICAL_MEDIA_MAP: Record<string, { type: TaskItem['mediaType']; sectionKey: string; order?: number }> = {
    // 14 Apellidos familiares preservando su orden exacto (0 a 13)
    'ruiz': { type: 'other', sectionKey: 'apellidos', order: 0 },
    'mollon': { type: 'other', sectionKey: 'apellidos', order: 1 },
    'jaurena': { type: 'other', sectionKey: 'apellidos', order: 2 },
    'vega': { type: 'other', sectionKey: 'apellidos', order: 3 },
    'vela': { type: 'other', sectionKey: 'apellidos', order: 4 },
    'abril': { type: 'other', sectionKey: 'apellidos', order: 5 },
    'mujica': { type: 'other', sectionKey: 'apellidos', order: 6 },
    'iraola': { type: 'other', sectionKey: 'apellidos', order: 7 },
    'gonzalez': { type: 'other', sectionKey: 'apellidos', order: 8 },
    'colomo': { type: 'other', sectionKey: 'apellidos', order: 9 },
    'alberdi': { type: 'other', sectionKey: 'apellidos', order: 10 },
    'salaberria': { type: 'other', sectionKey: 'apellidos', order: 11 },
    'perez': { type: 'other', sectionKey: 'apellidos', order: 12 },
    'goikoetxea': { type: 'other', sectionKey: 'apellidos', order: 13 },

    // Películas y Documentales (incluyendo Titanes, Still Alice, Mommy be mine, Salvados, Generación porno, Maspalomas)
    'titanes': { type: 'movie', sectionKey: 'peliculas' },
    'siempre alice': { type: 'movie', sectionKey: 'peliculas' },
    'mommy be mine': { type: 'movie', sectionKey: 'peliculas' },
    'salvados - redes sociales': { type: 'movie', sectionKey: 'peliculas' },
    'salvados redes sociales': { type: 'movie', sectionKey: 'peliculas' },
    'generacion porno creo que era': { type: 'movie', sectionKey: 'peliculas' },
    'generacion porno': { type: 'movie', sectionKey: 'peliculas' },
    'maspalomas': { type: 'movie', sectionKey: 'peliculas' },

    // Series (Cómo defender a un asesino, Una serie de catastróficas desdichas, Los protegidos, etc.)
    'como defender a un asesino': { type: 'series', sectionKey: 'series' },
    'una serie de catastroficas desdichas': { type: 'series', sectionKey: 'series' },
    'los protegidos': { type: 'series', sectionKey: 'series' },
    'single parents': { type: 'series', sectionKey: 'series' },
    'new mexico': { type: 'series', sectionKey: 'series' },
    'clase letal': { type: 'series', sectionKey: 'series' },
    'matadero': { type: 'series', sectionKey: 'series' },
    'skam': { type: 'series', sectionKey: 'series' },
    'true detective': { type: 'series', sectionKey: 'series' },
    'derry girls': { type: 'series', sectionKey: 'series' },
    'legends of tomorrow': { type: 'series', sectionKey: 'series' },
    'mr. inbetween': { type: 'series', sectionKey: 'series' },
    'mr inbetween': { type: 'series', sectionKey: 'series' },
    'the looming tower': { type: 'series', sectionKey: 'series' },
    'stranger things': { type: 'series', sectionKey: 'series' },
    'the crown': { type: 'series', sectionKey: 'series' },
    'los originales': { type: 'series', sectionKey: 'series' },
    'the witcher': { type: 'series', sectionKey: 'series' },
    'succes': { type: 'series', sectionKey: 'series' },
    'succession': { type: 'series', sectionKey: 'series' },
    'erase una vez': { type: 'series', sectionKey: 'series' },
    'roswell': { type: 'series', sectionKey: 'series' },
    'el embarcadero': { type: 'series', sectionKey: 'series' },
    'the blacklist': { type: 'series', sectionKey: 'series' },
    'young justice': { type: 'series', sectionKey: 'series' },
    'dia a dia': { type: 'series', sectionKey: 'series' },
    'la otra mirada': { type: 'series', sectionKey: 'series' },
    'sorry for your loss': { type: 'series', sectionKey: 'series' },
    'call my agent': { type: 'series', sectionKey: 'series' },
    'vedex': { type: 'series', sectionKey: 'series' },
    '19-2': { type: 'series', sectionKey: 'series' },
    'hola': { type: 'series', sectionKey: 'series' },

    // Recursos y Web
    'koldokoak2005a': { type: 'other', sectionKey: 'recursos' },
    'coldocuak2005': { type: 'other', sectionKey: 'recursos' }
  };

  // Mover tareas de listas redundantes (ej. lista independiente 'Recuerda') a la canónica
  const redundantLibLists = matchingLibLists.filter((l: any) => l.id !== libListId);
  redundantLibLists.forEach((redList: any) => {
    const redTasks = Object.values(store.tasks || {}).filter(t => t.categoryId === redList.id);
    redTasks.forEach(t => {
      const oldSec = sections.find(s => s.id === t.sectionId);
      const oldSecName = normalize(oldSec?.name);
      const titleNorm = normalize(t.title);
      let targetSecId = t.sectionId;

      const mapped = CANONICAL_MEDIA_MAP[titleNorm];
      if (mapped) {
        targetSecId = getSectionForType(mapped.sectionKey);
      } else if (!oldSec || oldSec.listId !== libListId || oldSecName === 'recuerda') {
        if (oldSecName.includes('pelicula')) targetSecId = getSectionForType('peliculas');
        else if (oldSecName.includes('serie')) targetSecId = getSectionForType('series');
        else if (oldSecName.includes('musica') || oldSecName.includes('cancion')) targetSecId = getSectionForType('musica');
        else if (oldSecName.includes('libro')) targetSecId = getSectionForType('libros');
        else if (oldSecName.includes('apellido')) targetSecId = getSectionForType('apellidos');
        else targetSecId = getSectionForType('series');
      }

      store.updateTask(t.id, {
        categoryId: libListId,
        sectionId: targetSecId,
        deleted_at: undefined
      });
    });

    if (store.deleteList) {
      store.deleteList(redList.id);
    } else if (store.updateList) {
      store.updateList(redList.id, { deleted_at: new Date().toISOString() });
    }
  });

  // Reasignar también tareas huérfanas con categoryId 'recuerda' o 'biblioteca'
  Object.values(store.tasks || {}).forEach(t => {
    if ((t.categoryId === 'recuerda' || t.categoryId === 'biblioteca') && t.categoryId !== libListId) {
      const titleNorm = normalize(t.title);
      const mapped = CANONICAL_MEDIA_MAP[titleNorm];
      const targetSecId = mapped ? getSectionForType(mapped.sectionKey) : getSectionForType('series');
      store.updateTask(t.id, {
        categoryId: libListId,
        sectionId: targetSecId,
        deleted_at: undefined
      });
    }
  });

  // Procesar y enriquecer todas las tareas de la Biblioteca de vida
  const libTasks = Object.values(store.tasks || {}).filter(t => !t.deleted_at && t.categoryId === libListId);

  libTasks.forEach(t => {
    let taskSec = updatedLibSections.find(s => s.id === t.sectionId);
    let secName = normalize(taskSec?.name);
    let inferredType: TaskItem['mediaType'] | undefined = t.mediaType;

    const titleNorm = normalize(t.title);
    const notesNorm = normalize(t.notes || t.description);
    const mapped = CANONICAL_MEDIA_MAP[titleNorm];

    if (mapped) {
      inferredType = mapped.type;
    } else if (!inferredType) {
      if (secName.includes('pelicula') || titleNorm.includes('pelicula') || notesNorm.includes('pelicula')) inferredType = 'movie';
      else if (secName.includes('serie') || titleNorm.includes('serie')) inferredType = 'series';
      else if (secName.includes('musica') || secName.includes('cancion') || titleNorm.includes('cancion') || titleNorm.includes('disco')) inferredType = 'music';
      else if (secName.includes('libro') || titleNorm.includes('libro')) inferredType = 'book';
      else if (secName.includes('apellido') || titleNorm.includes('apellido')) inferredType = 'other';
      else inferredType = 'series';
    }

    // Si la tarea está en mapa o su sección es obsoleta (ej. Recuerda), reasignar a su sección precisa
    let newSectionId = t.sectionId;
    if (mapped) {
      newSectionId = getSectionForType(mapped.sectionKey);
    } else if (!newSectionId || !updatedLibSections.some(s => s.id === newSectionId) || secName === 'recuerda') {
      if (inferredType === 'movie' || titleNorm.includes('pelicula')) newSectionId = getSectionForType('peliculas');
      else if (inferredType === 'series' || titleNorm.includes('serie')) newSectionId = getSectionForType('series');
      else if (inferredType === 'music' || titleNorm.includes('cancion') || titleNorm.includes('musica')) newSectionId = getSectionForType('musica');
      else if (inferredType === 'book' || titleNorm.includes('libro')) newSectionId = getSectionForType('libros');
      else if (titleNorm.includes('apellido') || notesNorm.includes('apellido')) newSectionId = getSectionForType('apellidos');
      else newSectionId = getSectionForType('series');
    }

    const updates: Partial<TaskItem> = {};
    if (inferredType && t.mediaType !== inferredType) updates.mediaType = inferredType;
    if (!t.mediaStatus) updates.mediaStatus = 'want_to_watch';
    if (newSectionId && t.sectionId !== newSectionId) updates.sectionId = newSectionId;
    if (mapped?.order !== undefined && t.order !== mapped.order) updates.order = mapped.order;
    if (t.disableDuration === undefined || !t.disableDuration) updates.disableDuration = true;
    if (t.duration !== undefined) updates.duration = undefined;

    if (Object.keys(updates).length > 0) {
      store.updateTask(t.id, updates);
    }
  });

  // 9. Blindaje total de integridad: restaurar tareas legítimas y asegurar secciones completas
  const protectedTitles = new Set([
    'compra mensual', 'compra anual', 'limpieza mensual', 'limpieza anual',
    'skincare semanal', 'skin-care semanal', 'skin-care mensual', 'skin-care diaria'
  ]);
  Object.values(store.tasks || {}).forEach(t => {
    const normTitle = normalize(t.title);
    if (protectedTitles.has(normTitle) && t.deleted_at) {
      store.updateTask(t.id, { deleted_at: undefined });
    }
  });

  // Asegurar secciones completas de Compra
  const targetCompraList = lists.find((l: any) => l.id === 'compra' || l.id === 'compras' || normalize(l.name).includes('compra'));
  if (targetCompraList) {
    const cId = targetCompraList.id;
    const requiredCompraSecs = [
      { id: `sec_${cId}_cuanto_antes`, name: 'Cuanto antes', order: 0, root: 'cuanto' },
      { id: `sec_${cId}_diarias`, name: 'Diarias', order: 1, root: 'diari' },
      { id: `sec_${cId}_semanales`, name: 'Semanales', order: 2, root: 'seman' },
      { id: `sec_${cId}_mensuales`, name: 'Mensuales', order: 3, root: 'mensu' },
      { id: `sec_${cId}_anuales`, name: 'Anuales', order: 4, root: 'anual' },
      { id: `sec_${cId}_wish_list`, name: 'Wish list', order: 5, root: 'wish' },
    ];
    requiredCompraSecs.forEach(req => {
      const exists = sections.some((s: any) => s.listId === cId && (s.id === req.id || normalize(s.name).includes(req.root)));
      if (!exists) {
        store.addListSection({
          id: req.id,
          listId: cId,
          name: req.name,
          order: req.order,
          updated_at: EPOCH
        });
      }
    });

    // Remapear tareas de Compra huérfanas o con IDs de sección heredados
    Object.values(store.tasks || {}).forEach(t => {
      if ((t.categoryId === 'compra' || t.categoryId === 'compras' || t.categoryId === cId) && !t.deleted_at) {
        let targetSec = t.sectionId;
        if (t.sectionId === 'compra_cuanto_antes' || t.sectionId === 'sec_compra_cuanto_antes') {
          targetSec = `sec_${cId}_cuanto_antes`;
        } else if (t.sectionId === 'compra_wish_list' || t.sectionId === 'sec_compra_wish_list') {
          targetSec = `sec_${cId}_wish_list`;
        } else if (t.sectionId === 'compra_mensual' || t.sectionId === 'sec_compra_mensual' || t.sectionId === 'sec_compra_mensuales') {
          targetSec = `sec_${cId}_mensuales`;
        } else if (t.sectionId === 'compra_anual' || t.sectionId === 'sec_compra_anual' || t.sectionId === 'sec_compra_anuales') {
          targetSec = `sec_${cId}_anuales`;
        }
        if (targetSec && targetSec !== t.sectionId) {
          store.updateTask(t.id, { sectionId: targetSec, categoryId: cId });
        }
      }
    });
  }

  // Asegurar secciones completas de Quehaceres
  const targetQuehaceresList = lists.find((l: any) => l.id === 'quehaceres' || normalize(l.name).includes('quehacer'));
  if (targetQuehaceresList) {
    const qId = targetQuehaceresList.id;
    const requiredQSecs = [
      { id: `sec_${qId}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
      { id: `sec_${qId}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
      { id: `sec_${qId}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
      { id: `sec_${qId}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
    ];
    requiredQSecs.forEach(req => {
      const exists = sections.some((s: any) => s.listId === qId && (s.id === req.id || normalize(s.name).includes(req.root)));
      if (!exists) {
        store.addListSection({
          id: req.id,
          listId: qId,
          name: req.name,
          order: req.order,
          updated_at: EPOCH
        });
      }
    });

    // Remapear tareas de Quehaceres con sección antigua
    Object.values(store.tasks || {}).forEach(t => {
      if ((t.categoryId === 'quehaceres' || t.categoryId === qId) && !t.deleted_at) {
        let targetSec = t.sectionId;
        if (t.sectionId === 'quehaceres_diarias' || t.sectionId === 'sec_quehaceres_diaria') targetSec = `sec_${qId}_diarias`;
        else if (t.sectionId === 'quehaceres_semanales' || t.sectionId === 'sec_quehaceres_semanal') targetSec = `sec_${qId}_semanales`;
        else if (t.sectionId === 'quehaceres_mensuales' || t.sectionId === 'sec_quehaceres_mensual') targetSec = `sec_${qId}_mensuales`;
        else if (t.sectionId === 'quehaceres_anuales' || t.sectionId === 'sec_quehaceres_anual') targetSec = `sec_${qId}_anuales`;
        if (targetSec && targetSec !== t.sectionId) {
          store.updateTask(t.id, { sectionId: targetSec, categoryId: qId });
        }
      }
    });
  }

  // Asegurar secciones completas de Propósitos Anuales
  const targetGoalsList = lists.find((l: any) => l.id === 'prop_sitos_anuales' || normalize(l.name).includes('proposito'));
  if (targetGoalsList) {
    const gId = targetGoalsList.id;
    const requiredYears = [
      { id: 'sec_prop_2026', name: '2026', order: 0 },
      { id: 'sec_prop_2025', name: '2025', order: 1 },
      { id: 'sec_prop_2024', name: '2024', order: 2 },
      { id: 'sec_prop_2023', name: '2023', order: 3 },
      { id: 'sec_prop_2022', name: '2022', order: 4 },
      { id: 'sec_prop_2021', name: '2021', order: 5 },
      { id: 'sec_prop_2020', name: '2020', order: 6 },
    ];
    requiredYears.forEach(req => {
      const exists = sections.some((s: any) => s.listId === gId && (s.id === req.id || normalize(s.name) === req.name));
      if (!exists) {
        store.addListSection({
          id: req.id,
          listId: gId,
          name: req.name,
          order: req.order,
          updated_at: EPOCH
        });
      }
    });
    // Remapear tareas de Propósitos con IDs tipo section_year_2021
    Object.values(store.tasks || {}).forEach(t => {
      if ((t.categoryId === 'prop_sitos_anuales' || t.categoryId === gId) && !t.deleted_at) {
        if (t.sectionId?.startsWith('section_year_')) {
          const year = t.sectionId.replace('section_year_', '');
          store.updateTask(t.id, { sectionId: `sec_prop_${year}`, categoryId: gId });
        }
      }
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 11. 'Ejercicios con pajita' -> Rutina de gimnasia facial diaria con 3 ejercicios
  // ──────────────────────────────────────────────────────────────────────────
  const careList = lists.find((l: any) => l.id === 'care' || normalize(l.name) === 'care');
  if (careList) {
    const careId = careList.id;
    const careDiariaSec = sections.find((s: any) => s.listId === careId && (s.id === 'sec_care_diaria' || s.id === 'sec_care_diarias' || normalize(s.name).includes('diari')));
    const targetSectionId = careDiariaSec ? careDiariaSec.id : `sec_${careId}_diarias`;

    const pajitaParent = allActiveTasks.find(t => normalize(t.title).includes('pajita') && !t.parentId);
    if (pajitaParent) {
      if (pajitaParent.title !== 'Ejercicios con pajita' || pajitaParent.duration !== 3) {
        store.updateTask(pajitaParent.id, {
          title: 'Ejercicios con pajita',
          duration: 3,
          description: 'Rutina facial completa con pajita: papada y cuello, pómulos y mejillas, y contorno de labios (1 minuto por ejercicio).',
          notes: 'Rutina diaria de ejercicios faciales con pajita:\n1. Papada y cuello: Pajita entre los labios, cabeza levantada hacia el techo (1 min).\n2. Pómulos y mejillas: Pajita entre los labios, sonreír elevando comisuras (1 min).\n3. Labios y contorno: Pajita horizontal solo con fuerza de los labios (1 min).\n*Variante opcional: Succión profunda simulando líquido espeso para activar mandíbula y mejillas.',
          categoryId: careId,
          sectionId: targetSectionId,
          cycle_id: 'cycle_day'
        });
      }

      const existingSubtasks = allActiveTasks.filter(t => t.parentId === pajitaParent.id);
      const subtaskDefs = [
        {
          key: 'papada',
          title: '1. Papada y cuello: pajita en los labios, sube la cabeza y mantén 1 min',
          notes: 'Ponte la pajita entre los labios sin morderla con los dientes. Sube e inclina la cabeza mirando hacia el techo y mantén la tensión en el cuello y la papada durante 1 minuto.'
        },
        {
          key: 'pomulo',
          title: '2. Pómulos y mejillas: sonreír elevando comisuras con la pajita 1 min',
          notes: 'Sujeta la pajita en el centro de los labios y realiza una sonrisa exagerada elevando las comisuras hacia arriba para trabajar y marcar los pómulos durante 1 minuto.'
        },
        {
          key: 'labio',
          title: '3. Labios y contorno: apretar pajita solo con los labios hacia adentro 1 min',
          notes: 'Sostén la pajita horizontalmente solo con la fuerza de los labios (sin usar los dientes) y presiona los labios firmemente hacia adentro en contracción durante 1 minuto.'
        }
      ];

      subtaskDefs.forEach((def, idx) => {
        const found = existingSubtasks.find(s => normalize(s.title).includes(def.key));
        if (found) {
          if (found.title !== def.title || found.notes !== def.notes || found.duration !== 1) {
            store.updateTask(found.id, {
              title: def.title,
              notes: def.notes,
              duration: 1,
              order: idx
            });
          }
        } else {
          store.addTask({
            id: `task_sub_pajita_${def.key}`,
            title: def.title,
            notes: def.notes,
            duration: 1,
            order: idx,
            parentId: pajitaParent.id,
            categoryId: careId,
            sectionId: targetSectionId,
            status: 'pending',
            priority: 'none'
          });
        }
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 12. Autocuidado mensual: 'Hacerme las cejas', 'Manicura y pedicura', 'Ir al fisio'
  // ──────────────────────────────────────────────────────────────────────────
  if (careList) {
    const careId = careList.id;
    const careMensualSec = sections.find((s: any) => s.listId === careId && (s.id === 'sec_care_mensual' || s.id === 'sec_care_mensuales' || normalize(s.name).includes('mensu')));
    const mensualSectionId = careMensualSec ? careMensualSec.id : `sec_${careId}_mensuales`;

    // 1. Hacerme las cejas
    const hasCejas = allActiveTasks.some(t => normalize(t.title).includes('ceja'));
    if (!hasCejas) {
      store.addTask({
        id: 'task_hacerme_cejas_mensual',
        title: 'Hacerme las cejas',
        description: 'Depilar o repasar las cejas según necesidad (aprox. 1 vez al mes).',
        notes: 'Depilar o repasar las cejas según necesidad (aprox. 1 vez al mes).',
        categoryId: careId,
        sectionId: mensualSectionId,
        cycle_id: 'cycle_month',
        duration: 10,
        priority: 'medium',
        status: 'pending'
      });
    }

    // 2. Manicura y pedicura
    const hasManiPedi = allActiveTasks.some(t => (normalize(t.title).includes('manicura') || normalize(t.title).includes('pedicura')) && !t.parentId);
    if (!hasManiPedi) {
      const newManiPediId = 'task_manicura_pedicura_mensual';
      store.addTask({
        id: newManiPediId,
        title: 'Manicura y pedicura',
        description: 'Cuidado completo de uñas de manos y pies cuando se necesite.',
        notes: 'Cuidado completo de uñas de manos y pies cuando se necesite (limar, cutículas, exfoliación e hidratación aprox. 1 vez al mes).',
        categoryId: careId,
        sectionId: mensualSectionId,
        cycle_id: 'cycle_month',
        duration: 20,
        priority: 'medium',
        status: 'pending'
      });
      store.addTask({
        id: 'task_sub_manicura',
        title: 'Manicura (manos)',
        notes: 'Cortar/limar uñas de las manos, repasar cutículas e hidratar.',
        parentId: newManiPediId,
        categoryId: careId,
        sectionId: mensualSectionId,
        order: 0,
        duration: 10,
        status: 'pending',
        priority: 'none'
      });
      store.addTask({
        id: 'task_sub_pedicura',
        title: 'Pedicura (pies)',
        notes: 'Cortar/limar uñas de los pies, piedra pómez o exfoliación e hidratar.',
        parentId: newManiPediId,
        categoryId: careId,
        sectionId: mensualSectionId,
        order: 1,
        duration: 10,
        status: 'pending',
        priority: 'none'
      });
    }

    // 3. Ir al podólogo
    const hasPodologo = allActiveTasks.some(t => normalize(t.title).includes('podolog'));
    if (!hasPodologo) {
      store.addTask({
        id: 'task_ir_al_podologo',
        title: 'Ir al podólogo',
        description: 'Revisión podológica, quiropodia y cuidado de los pies/pisada cuando se necesite.',
        notes: 'Revisión de quiropodia, uñas, durezas y pisada cuando se necesite (o revisión periódica).',
        categoryId: careId,
        sectionId: mensualSectionId,
        cycle_id: 'cycle_month',
        duration: 30,
        priority: 'medium',
        status: 'pending'
      });
    }
  }

  // 4. Compra mensual: 'Ir al fisio (o masaje)'
  const compraList = lists.find((l: any) => l.id === 'compra' || l.id === 'compras' || normalize(l.name).includes('compra'));
  if (compraList) {
    const compraId = compraList.id;
    const compraMensualSec = sections.find((s: any) => s.listId === compraId && (s.id === 'sec_compra_mensuales' || s.id === 'sec_compras_mensuales' || normalize(s.name).includes('mensu')));
    const compraMensualSecId = compraMensualSec ? compraMensualSec.id : `sec_${compraId}_mensuales`;

    const fisioTask = allActiveTasks.find(t => (normalize(t.title).includes('fisio') || normalize(t.title).includes('masaje')) && (t.categoryId === compraId || t.categoryId === 'compra' || t.categoryId === 'compras'));
    if (fisioTask) {
      if (!normalize(fisioTask.title).includes('fisio')) {
        store.updateTask(fisioTask.id, {
          title: 'Ir al fisio (o masaje)',
          notes: fisioTask.notes || 'Sesión mensual de fisioterapia o masaje de descarga (50€ aprox.).'
        });
      }
    } else {
      store.addTask({
        id: 'task_ir_al_fisio_mensual',
        title: 'Ir al fisio (o masaje)',
        notes: 'Sesión mensual de fisioterapia o masaje de descarga (50€ aprox.).',
        price: 50,
        categoryId: compraId,
        sectionId: compraMensualSecId,
        cycle_id: 'cycle_month',
        priority: 'none',
        status: 'pending'
      });
    }
  }
}
