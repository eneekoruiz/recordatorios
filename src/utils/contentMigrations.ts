import { VITAL_HABITS_LIST_ID, VITAL_HABITS_LIST_NAME, VITAL_HABIT_TITLE_REGEX } from './vitalHabits';
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
  addListSection: (sec: any) => void;
  addTask: (task: Partial<TaskItem>) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  deleteTask?: (id: string) => void;
}

/**
 * Migración idempotente de contenidos y secciones críticas:
 * 1. Garantiza la lista aislada 'habitos_vitales' (sin duración) con 'Beber agua' y 'Comer'.
 * 2. Migra cualquier microhábito vital fuera de quehaceres/limpieza a 'habitos_vitales'.
 * 3. Garantiza 'Limpiar el horno a fondo' en frecuencia mensual.
 * 4. Modifica 'Regar las plantas' para incluir 'Añadir abono para que crezcan más rápido'.
 * 5. Reestructura 'Limpiar espejos' en frecuencia semanal con 3 subtareas y 10 min de duración máxima.
 * 6. Añade la tarea semanal 'Tirar el albornoz a la lavadora'.
 */
export function runContentMigrations(store: ContentMigrationStore): void {
  const tasks = store.tasks || {};
  const lists = store.lists || [];
  const sections = store.listSections || [];
  const EPOCH = new Date(0).toISOString();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LISTA AISLADA: 'Hábitos vitales' (Sin duración, tracker visual de cumplimiento)
  // ──────────────────────────────────────────────────────────────────────────
  let habitosList = lists.find(l => l.id === VITAL_HABITS_LIST_ID);
  if (!habitosList) {
    store.addList({
      id: VITAL_HABITS_LIST_ID,
      name: VITAL_HABITS_LIST_NAME,
      color: '#30d158',
      icon: 'heart',
      listType: 'simple',
      autoEstimateDuration: false,
      updated_at: EPOCH
    });
  }

  // Encontrar o crear secciones de referencia para rutinas
  const findOrCreateSection = (listId: string, periodicityName: string, fallbackId: string) => {
    let sec = sections.find(s => s.listId === listId && normalize(s.name).includes(normalize(periodicityName)));
    if (!sec) {
      sec = {
        id: fallbackId,
        listId,
        name: periodicityName,
        order: periodicityName === 'Diarias' ? 0 : periodicityName === 'Semanales' ? 1 : 2,
        updated_at: EPOCH
      };
      store.addListSection(sec);
    }
    return sec;
  };

  const limpiezaList = lists.find(l => l.id === 'limpieza') || { id: 'limpieza' };
  const quehaceresList = lists.find(l => l.id === 'quehaceres') || { id: 'quehaceres' };

  const targetListId = limpiezaList.id || quehaceresList.id || 'limpieza';
  const secSemanales = findOrCreateSection(targetListId, 'Semanales', `sec_${targetListId}_semanales`);
  const secMensuales = findOrCreateSection(targetListId, 'Mensuales', `sec_${targetListId}_mensuales`);

  const allActiveTasks = Object.values(tasks).filter(t => !t.deleted_at);

  // ──────────────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────
  // 2. INTEGRAR HÁBITOS VITALES COMO SUBSECCIÓN EN QUEHACERES Y LISTA AISLADA
  // ──────────────────────────────────────────────────────────────────────────
  const secHabitosVitales = findOrCreateSection(targetListId, 'Hábitos vitales', `sec_${targetListId}_habitos_vitales`);

  allActiveTasks.forEach(t => {
    const titleNorm = normalize(t.title);
    if (VITAL_HABIT_TITLE_REGEX.test(t.title || '') || titleNorm === 'beber agua' || titleNorm === 'comer') {
      store.updateTask(t.id, {
        categoryId: VITAL_HABITS_LIST_ID,
        sectionId: secHabitosVitales.id,
        duration: undefined,
        parallelDuration: undefined,
        disableDuration: true
      });
    }
  });

  // Asegurar que 'Beber agua' y 'Comer' existen con la subsección y lista
  const vitalTasks = Object.values(store.tasks || {}).filter(t => !t.deleted_at && (t.categoryId === VITAL_HABITS_LIST_ID || t.sectionId === secHabitosVitales.id));
  const hasAgua = vitalTasks.some(t => normalize(t.title).includes('beber agua'));
  const hasComer = vitalTasks.some(t => normalize(t.title).includes('comer'));

  if (!hasAgua) {
    store.addTask({
      title: 'Beber agua',
      categoryId: VITAL_HABITS_LIST_ID,
      sectionId: secHabitosVitales.id,
      priority: 'none',
      status: 'pending',
      disableDuration: true,
      duration: undefined
    });
  }

  if (!hasComer) {
    store.addTask({
      title: 'Comer',
      categoryId: VITAL_HABITS_LIST_ID,
      sectionId: secHabitosVitales.id,
      priority: 'none',
      status: 'pending',
      disableDuration: true,
      duration: undefined
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. 'Limpiar el horno a fondo' -> MENSUAL
  // ──────────────────────────────────────────────────────────────────────────
  let hornoTask = allActiveTasks.find(t => normalize(t.title).includes('horno'));
  if (hornoTask) {
    if (hornoTask.sectionId !== secMensuales.id || hornoTask.categoryId !== targetListId) {
      store.updateTask(hornoTask.id, {
        title: 'Limpiar el horno a fondo',
        categoryId: targetListId,
        sectionId: secMensuales.id
      });
    }
  } else {
    store.addTask({
      title: 'Limpiar el horno a fondo',
      categoryId: targetListId,
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
      categoryId: targetListId,
      sectionId: secSemanales.id,
      priority: 'medium',
      status: 'pending'
    });
    store.addTask({
      title: EXACT_ABONO_TEXT,
      parentId: newPlantasId,
      categoryId: targetListId,
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
      categoryId: targetListId,
      sectionId: secSemanales.id,
      duration: 10,
      disableDuration: false
    });
  } else {
    const newEspejosId = 'task_limpiar_espejos_' + Date.now();
    store.addTask({
      id: newEspejosId,
      title: 'Limpiar espejos',
      categoryId: targetListId,
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
        categoryId: targetListId,
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
      categoryId: targetListId,
      sectionId: secSemanales.id,
      priority: 'medium',
      status: 'pending',
      isParallel: true
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. 'Biblioteca de vida': unificar con 'Recuerda' si existe, o crearla con sus secciones
  // ──────────────────────────────────────────────────────────────────────────
  let libraryList = lists.find(l => 
    l.id === 'biblioteca_vida' || 
    l.id === 'biblioteca' || 
    normalize(l.name).includes('biblioteca de vida') ||
    normalize(l.name) === 'biblioteca' ||
    normalize(l.name) === 'recuerda'
  );

  if (libraryList) {
    if (store.updateList && (libraryList.listType !== 'library' || normalize(libraryList.name) === 'recuerda')) {
      store.updateList(libraryList.id, {
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
    libraryList = { id: newLibId, name: 'Biblioteca de vida' };
  }

  const libListId = libraryList.id;

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
  const libTasks = Object.values(store.tasks || {}).filter(t => !t.deleted_at && t.categoryId === libListId);

  libTasks.forEach(t => {
    const taskSec = updatedLibSections.find(s => s.id === t.sectionId);
    const secName = normalize(taskSec?.name);
    let inferredType: TaskItem['mediaType'] | undefined = t.mediaType;

    if (!inferredType) {
      if (secName.includes('pelicula')) inferredType = 'movie';
      else if (secName.includes('serie')) inferredType = 'series';
      else if (secName.includes('musica') || secName.includes('cancion')) inferredType = 'music';
      else if (secName.includes('libro')) inferredType = 'book';
      else inferredType = 'other';
    }

    const updates: Partial<TaskItem> = {};
    if (inferredType && t.mediaType !== inferredType) updates.mediaType = inferredType;
    if (!t.mediaStatus) updates.mediaStatus = 'want_to_watch';
    if (t.disableDuration === undefined) updates.disableDuration = true;

    if (Object.keys(updates).length > 0) {
      store.updateTask(t.id, updates);
    }
  });
}
