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
  const EPOCH = new Date(0).toISOString();

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
  // 7. 'Biblioteca de vida': unificar con 'Recuerda' si existe, o crearla con sus secciones
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
    { name: 'Recuerda', key: 'recuerda' }
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

  const updatedLibSections = (store.listSections || sections).filter(s => s.listId === libListId && !s.deleted_at);
  const getSectionForType = (key: string) => {
    return updatedLibSections.find(s => s.id === `sec_${libListId}_${key}` || normalize(s.name).includes(key))?.id;
  };

  // Mover tareas de listas redundantes (ej. lista independiente 'Recuerda') a la canónica
  const redundantLibLists = matchingLibLists.filter((l: any) => l.id !== libListId);
  redundantLibLists.forEach((redList: any) => {
    const redTasks = Object.values(store.tasks || {}).filter(t => t.categoryId === redList.id);
    redTasks.forEach(t => {
      const oldSec = sections.find(s => s.id === t.sectionId);
      const oldSecName = normalize(oldSec?.name);
      let targetSecId = t.sectionId;

      if (!oldSec || oldSec.listId !== libListId) {
        if (oldSecName.includes('pelicula')) targetSecId = getSectionForType('peliculas');
        else if (oldSecName.includes('serie')) targetSecId = getSectionForType('series');
        else if (oldSecName.includes('musica') || oldSecName.includes('cancion')) targetSecId = getSectionForType('musica');
        else if (oldSecName.includes('libro')) targetSecId = getSectionForType('libros');
        else if (oldSecName.includes('apellido')) targetSecId = getSectionForType('apellidos');
        else targetSecId = getSectionForType('recuerda');
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
      store.updateTask(t.id, {
        categoryId: libListId,
        sectionId: getSectionForType('recuerda'),
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

    if (!inferredType) {
      if (secName.includes('pelicula') || titleNorm.includes('pelicula') || notesNorm.includes('pelicula')) inferredType = 'movie';
      else if (secName.includes('serie') || titleNorm.includes('serie')) inferredType = 'series';
      else if (secName.includes('musica') || secName.includes('cancion') || titleNorm.includes('cancion') || titleNorm.includes('disco')) inferredType = 'music';
      else if (secName.includes('libro') || titleNorm.includes('libro')) inferredType = 'book';
      else if (secName.includes('apellido') || titleNorm.includes('apellido')) inferredType = 'other';
      else inferredType = 'other';
    }

    // Si la tarea no tiene sección, asignarle la mejor sección por tipo o contenido
    let newSectionId = t.sectionId;
    if (!newSectionId || !updatedLibSections.some(s => s.id === newSectionId)) {
      if (inferredType === 'movie' || titleNorm.includes('pelicula')) newSectionId = getSectionForType('peliculas');
      else if (inferredType === 'series' || titleNorm.includes('serie')) newSectionId = getSectionForType('series');
      else if (inferredType === 'music' || titleNorm.includes('cancion') || titleNorm.includes('musica')) newSectionId = getSectionForType('musica');
      else if (inferredType === 'book' || titleNorm.includes('libro')) newSectionId = getSectionForType('libros');
      else if (titleNorm.includes('apellido') || notesNorm.includes('apellido')) newSectionId = getSectionForType('apellidos');
      else newSectionId = getSectionForType('recuerda');
    }

    const updates: Partial<TaskItem> = {};
    if (inferredType && t.mediaType !== inferredType) updates.mediaType = inferredType;
    if (!t.mediaStatus) updates.mediaStatus = 'want_to_watch';
    if (newSectionId && t.sectionId !== newSectionId) updates.sectionId = newSectionId;
    if (t.disableDuration === undefined || !t.disableDuration) updates.disableDuration = true;
    if (t.duration !== undefined) updates.duration = undefined;

    if (Object.keys(updates).length > 0) {
      store.updateTask(t.id, updates);
    }
  });
}
