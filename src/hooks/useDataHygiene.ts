import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { 
  formatSectionTitle, 
  getTaskPeriodicity, 
  getSectionPeriodicity,
  stripPeriodicityPrefix,
  getPeriodicityFromPrefix
} from '../utils/sectionRoutine';
import { normalizeTaskPrices } from '../utils/priceExtractor';
import { ensureLimpiezaSections, getRoomForCleaningTask } from '../utils/specialLists';
import { isKnownRedundantTask, semanticKey, normalizeTitle } from '../utils/taskDeduplication';
import { runContentMigrations } from '../utils/contentMigrations';
import type { TaskItem } from '../models/Task';

export function useDataHygiene(hasHydrated: boolean) {
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (!hasHydrated || initDoneRef.current) return;
    initDoneRef.current = true;
    const state = useAppStore.getState();
    const lists = state.lists;

    // Verificar si la guía ya fue ocultada o completada (localmente o en la nube)
    const isCloudHidden = false; // la preferencia de la nube llega vía User.preferences (hideOnboarding)
    const isLocalHidden = localStorage.getItem('hide_onboarding_guide') === 'true';

    // Comprobar si el usuario ya es un usuario con datos reales (tareas o listas personalizadas)
    const existingTasksList = Object.values(state.tasks || {});
    const hasRealTasks = existingTasksList.some(t => !t.deleted_at && t.categoryId !== 'primeros_pasos');
    const hasCustomLists = (lists || []).some(l => 
      l.id !== 'primeros_pasos' && 
      l.id !== 'inbox' && 
      !l.id.startsWith('user_preferences_') &&
      !['compras', 'personal', 'trabajo', 'care', 'quehaceres', 'limpieza', 'caducidades', 'que_he_hecho'].includes(l.id)
    );
    const isEstablishedUser = hasRealTasks || hasCustomLists;
    const isHidden = isLocalHidden || isCloudHidden || isEstablishedUser;

    if (isEstablishedUser && !isLocalHidden) {
      localStorage.setItem('hide_onboarding_guide', 'true');
    }

    if (isHidden) {
      if (state.pinnedSmartLists?.includes('smart_primeros_pasos')) {
        const cleaned = state.pinnedSmartLists.filter(id => id !== 'smart_primeros_pasos');
        useAppStore.setState({ pinnedSmartLists: cleaned });
      }
      if (lists?.some(l => l.id === 'primeros_pasos')) {
        state.removeList('primeros_pasos');
      }
      existingTasksList.forEach(t => {
        if (t.categoryId === 'primeros_pasos' || t.id.startsWith('task_onboarding_')) {
          state.deleteTask(t.id);
        }
      });
    }

    const activeTasks = Object.values(state.tasks || {}).filter((t: any) => !t.deleted_at);

    // Hygiene: remove dummy section header tasks imported from PDF
    const dummyHeaderTitles = new Set(['diarias', 'semanales', 'mensuales', 'anuales']);
    const dummySectionTasks = new Set([
      'skin-care diaria', 'limpieza diaria', 'skincare semanal', 'limpieza semanal',
      'skin-care mensual', 'limpieza mensual', 'compra mensual', 'compra anual', 'limpieza anual'
    ]);
    const cleaningRoomHeaders = new Set([
      'habitación', 'habitacion', 'cocina', 'pasillo / entrada', 'baño', 'bano', 'balcón', 'balcon', 'general'
    ]);
    const activeTasksMap = new Map(activeTasks.map((t: any) => [t.id, t]));
    const dummyIdsToPurge = new Set<string>();
    activeTasks.forEach((t: any) => {
      const clean = (t.title || '').trim().toLowerCase();
      const cat = t.categoryId || (t as any).category_id;
      const isCleaningRoom = cat === 'limpieza' && cleaningRoomHeaders.has(clean);
      if (dummyHeaderTitles.has(clean) || dummySectionTasks.has(clean) || isCleaningRoom) {
        dummyIdsToPurge.add(t.id);
        state.deleteTask(t.id);
      }
    });
    activeTasks.forEach((t: any) => {
      if (t.parentId && (dummyIdsToPurge.has(t.parentId) || !activeTasksMap.has(t.parentId))) {
        state.updateTask(t.id, { parentId: undefined });
      }
    });

    // Hygiene: remove known redundant or cross-frequency tasks
    activeTasks.forEach((t: any) => {
      if (isKnownRedundantTask(t.title)) {
        state.deleteTask(t.id);
      }
    });

    // Hygiene: eliminar duración por completo de "¿Te aburres?" y micro-hábitos recurrentes (agua, dientes, manos)
    activeTasks.forEach((t: any) => {
      const secId = t.sectionId || (t as any).section_id;
      const secObj = secId ? (state.listSections || []).find(s => s.id === secId) : null;
      const secName = (secObj?.name || '').toLowerCase();
      const clean = (t.title || '').toLowerCase();
      const isBoredom = clean.includes('aburr') || secName.includes('aburr');
      const isHabit = /\b(beber agua|vaso de agua|lavarse los dientes|lavar los dientes|cepillarse los dientes|lavarse las manos|lavar las manos)\b/i.test(clean) || secName.includes('recurrent');
      if ((isBoredom || isHabit) && (t.duration || t.parallelDuration)) {
        state.updateTask(t.id, { duration: undefined, parallelDuration: undefined });
      }
    });

    const targetCategories = ['care', 'limpieza', 'compra', 'quehaceres'];
    for (const cat of targetCategories) {
      // Re-filter active tasks after pruning known redundant items
      const catTasks = Object.values(state.tasks || {}).filter(
        (t: any) => !t.deleted_at && (t.categoryId || (t as any).category_id) === cat
      );
      const titleGroups = new Map<string, any[]>();
      for (const t of catTasks) {
        const key = semanticKey(t.title) || normalizeTitle(t.title);
        if (!key) continue;
        if (!titleGroups.has(key)) {
          titleGroups.set(key, []);
        }
        titleGroups.get(key)!.push(t);
      }
      for (const [, items] of titleGroups.entries()) {
        if (items.length > 1) {
          items.sort((a, b) => {
            const score = (p: any) => {
              let s = 0;
              // Higher frequency tasks take precedence over lower frequency tasks when cross-frequency duplicates occur
              const sec = (p.sectionId || '').toLowerCase();
              if (sec.includes('diari')) s += 80;
              else if (sec.includes('seman')) s += 60;
              else if (sec.includes('mensu')) s += 40;
              else if (sec.includes('anual')) s += 20;

              if (p.status === 'completed') s += 100;
              if (p.notes || (p.description && p.description.length > 15)) s += 50;
              if (p.parentId) s += 40;
              if (p.price && Number(p.price) > 0) s += 30;
              if (p.cycle_id) s += 20;
              if (p.alerts && p.alerts.length > 0) s += 10;
              if (p.completionHistory && p.completionHistory.length > 0) s += 10;
              s += (p.version || 1);
              return s;
            };
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            const tA = new Date(a.created_at || a.createdAt || 0).getTime();
            const tB = new Date(b.created_at || b.createdAt || 0).getTime();
            return tA - tB;
          });
          const duplicates = items.slice(1);
          duplicates.forEach(dup => {
            state.deleteTask(dup.id);
          });
        }
      }
    }

    // Las listas por defecto llevan fecha "epoch": si la cuenta ya tiene esas listas en la nube
    // (personalizadas), el Last-Write-Wins del servidor conserva las suyas en lugar de estas.
    const EPOCH = new Date(0).toISOString();
    if (!lists || lists.length === 0) {
      const initial = [
        ...(isHidden ? [] : [{ id: 'primeros_pasos', name: 'Primeros pasos', color: '#ff2d55', icon: 'rocket', isPinned: false }]),
        { id: 'compras', name: 'Compras', color: '#ff9500', icon: 'shopping-cart' },
        { id: 'personal', name: 'Personal', color: '#af52de', icon: 'heart' },
        { id: 'trabajo', name: 'Trabajo', color: '#0a84ff', icon: 'briefcase' },
        { id: 'caducidades', name: 'Caducidades', color: '#ff9500', icon: 'credit-card' },
        { id: 'que_he_hecho', name: 'Qué he hecho', color: '#5856d6', icon: 'book-open' },
        { id: 'limpieza', name: 'Limpieza', color: '#32ade6', icon: 'sparkles' },
        { id: 'quehaceres', name: 'Quehaceres', color: '#ff9500', icon: 'check-square' },
        { id: 'care', name: 'Care', color: '#af52de', icon: 'heart' },
      ];
      initial.forEach((l) => state.addList({ ...l, updated_at: EPOCH }));
      state.addListSection({ id: 'sec_tarjetas', listId: 'caducidades', name: 'Tarjetas y Documentos', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_suscripciones', listId: 'caducidades', name: 'Suscripciones', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_diaria', listId: 'limpieza', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_semanal', listId: 'limpieza', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_mensual', listId: 'limpieza', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_anual', listId: 'limpieza', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_diarias', listId: 'quehaceres', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_semanales', listId: 'quehaceres', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_mensuales', listId: 'quehaceres', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_anuales', listId: 'quehaceres', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_diarias', listId: 'care', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_semanales', listId: 'care', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_mensuales', listId: 'care', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_anuales', listId: 'care', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_diarias', listId: 'compras', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_semanales', listId: 'compras', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_mensuales', listId: 'compras', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_anuales', listId: 'compras', name: 'Anuales', order: 3, updated_at: EPOCH });
    } else {
      if (!lists.some(l => l.id === 'primeros_pasos') && !isHidden) {
        state.addList({ id: 'primeros_pasos', name: 'Primeros pasos', color: '#ff2d55', icon: 'rocket', isPinned: false, updated_at: EPOCH });
      }
      if (!lists.some(l => l.id === 'caducidades')) {
        state.addList({ id: 'caducidades', name: 'Caducidades', color: '#ff9500', icon: 'credit-card', updated_at: EPOCH });
      }
      if (!lists.some(l => l.id === 'que_he_hecho')) {
        state.addList({ id: 'que_he_hecho', name: 'Qué he hecho', color: '#5856d6', icon: 'book-open', updated_at: EPOCH });
      }

      // Secciones de Caducidades
      const sections = state.listSections || [];
      if (!sections.some(s => s.id === 'sec_tarjetas' || (s.listId === 'caducidades' && (s.name || '').toLowerCase().includes('tarjeta')))) {
        state.addListSection({
          id: 'sec_tarjetas',
          listId: 'caducidades',
          name: 'Tarjetas y Documentos',
          order: 0, updated_at: EPOCH
        });
      }
      if (!sections.some(s => s.id === 'sec_suscripciones' || (s.listId === 'caducidades' && (s.name || '').toLowerCase().includes('suscrip')))) {
        state.addListSection({
          id: 'sec_suscripciones',
          listId: 'caducidades',
          name: 'Suscripciones',
          order: 1, updated_at: EPOCH
        });
      }

      // Asegurar que Limpieza esté unificada como una lista única con sus 4 secciones
      const limpiezaList = lists.find(l => l.id === 'limpieza');
      if (limpiezaList) {
        if (limpiezaList.isFolder || limpiezaList.icon === 'folder' || limpiezaList.icon === 'list' || limpiezaList.parentId) {
          state.updateList('limpieza', { isFolder: false, icon: 'sparkles', color: limpiezaList.color || '#32ade6', parentId: undefined });
        }
      } else if (!isHidden) {
        state.addList({ id: 'limpieza', name: 'Limpieza', color: '#32ade6', icon: 'sparkles', isFolder: false, updated_at: EPOCH });
      }

      // Secciones de Limpieza (Diarias, Semanales, Mensuales, Anuales y subgrupos de estancia)
      ensureLimpiezaSections('limpieza', state.listSections || [], (sec) => {
        state.addListSection({ ...sec, updated_at: EPOCH });
      }, (id, updates) => {
        const sec = (state.listSections || []).find(s => s.id === id);
        if (sec) {
          state.addListSection({ ...sec, ...updates, updated_at: EPOCH });
        }
      });

      // Normalizar parentId en subsecciones de limpieza existentes
      const allAppSecs = state.listSections || [];
      const legacyRootMap: Record<string, string> = {
        'sec_limp_diaria': 'sec_limpieza_diaria',
        'sec_limp_semanal': 'sec_limpieza_semanal',
        'sec_limp_mensual': 'sec_limpieza_mensual',
        'sec_limp_anual': 'sec_limpieza_anual',
      };
      allAppSecs.forEach(sec => {
        if (sec.parentId && legacyRootMap[sec.parentId]) {
          const rootTarget = legacyRootMap[sec.parentId];
          if (allAppSecs.some(s => s.id === rootTarget)) {
            state.addListSection({ ...sec, parentId: rootTarget, updated_at: EPOCH });
          }
        }
      });

      // Secciones unificadas para Quehaceres si existe la lista
      const quehaceresList = lists.find(l => l.id === 'quehaceres' || (l.name || '').toLowerCase() === 'quehaceres');
      if (quehaceresList) {
        const qSections = [
          { id: `sec_${quehaceresList.id}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
          { id: `sec_${quehaceresList.id}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
          { id: `sec_${quehaceresList.id}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
          { id: `sec_${quehaceresList.id}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
        ];
        qSections.forEach(qSec => {
          if (!sections.some(s => s.listId === quehaceresList.id && (s.name || '').toLowerCase().includes(qSec.root))) {
            state.addListSection({
              id: qSec.id,
              listId: quehaceresList.id,
              name: qSec.name,
              order: qSec.order,
              updated_at: EPOCH
            });
          }
        });
      }

      // Asegurar que Care esté presente como lista de rutinas de cuidado personal (facial, corporal, higiene)
      const careList = lists.find(l => l.id === 'care' || (l.name || '').toLowerCase() === 'care' || (l.name || '').toLowerCase() === 'skincare' || (l.name || '').toLowerCase() === 'cuidado personal');
      const careListId = careList ? careList.id : 'care';
      if (!careList) {
        state.addList({
          id: 'care',
          name: 'Care',
          color: '#af52de',
          icon: 'heart',
          isFolder: false,
          updated_at: EPOCH
        });
      }

      // Secciones unificadas para Care
      const careSections = [
        { id: `sec_${careListId}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
        { id: `sec_${careListId}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
        { id: `sec_${careListId}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
        { id: `sec_${careListId}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
      ];
      careSections.forEach(cSec => {
        if (!sections.some(s => s.listId === careListId && (s.name || '').toLowerCase().includes(cSec.root))) {
          state.addListSection({
            id: cSec.id,
            listId: careListId,
            name: cSec.name,
            order: cSec.order,
            updated_at: EPOCH
          });
        }
      });

      // Secciones unificadas para Compra si existe la lista
      const compraList = lists.find(l => l.id === 'compra' || l.id === 'compras' || (l.name || '').toLowerCase().includes('compra'));
      const compraListId = compraList ? compraList.id : 'compra';
      if (compraList) {
        const compraSections = [
          { id: `sec_${compraListId}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
          { id: `sec_${compraListId}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
          { id: `sec_${compraListId}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
          { id: `sec_${compraListId}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
        ];
        compraSections.forEach(cSec => {
          if (!sections.some(s => s.listId === compraListId && (s.name || '').toLowerCase().includes(cSec.root))) {
            state.addListSection({
              id: cSec.id,
              listId: compraListId,
              name: cSec.name,
              order: cSec.order,
              updated_at: EPOCH
            });
          }
        });
      }

      // Unificación homogénea de nombres de secciones en todas las listas (Quehaceres, Limpieza, etc.)
      // Asegura estilo limpio y coherente estilo Apple (Diarias, Semanales, Mensuales, Anuales) sin mayúsculas agresivas
      const existingSections = state.listSections || [];
      existingSections.forEach(sec => {
        const unified = formatSectionTitle(sec.name);
        if (unified && unified !== sec.name) {
          state.updateListSection(sec.id, unified);
        }
      });

      // Migrar tareas de sublistas de limpieza a la lista unificada con su sección
      const allTasksList = Object.values(state.tasks || {});
      const sublistMapping: Record<string, { secId: string; cycleId: string }> = {
        'limpieza_diaria': { secId: 'sec_limpieza_diaria', cycleId: 'cycle_day' },
        'limpieza_semanal': { secId: 'sec_limpieza_semanal', cycleId: 'cycle_week' },
        'limpieza_mensual': { secId: 'sec_limpieza_mensual', cycleId: 'cycle_month' },
        'limpieza_anual': { secId: 'sec_limpieza_anual', cycleId: 'cycle_year' }
      };

      allTasksList.forEach(t => {
        const cat = t.categoryId || (t as any).category_id;
        const mapping = cat ? sublistMapping[cat] : undefined;
        if (mapping) {
          const room = getRoomForCleaningTask(t.title);
          const freq = mapping.cycleId === 'cycle_day' ? 'diaria' : mapping.cycleId === 'cycle_week' ? 'semanal' : mapping.cycleId === 'cycle_month' ? 'mensual' : 'anual';
          const roomSlug = room === 'Pasillo / Entrada' ? 'pasillo' :
                           room === 'Habitación' ? 'hab' :
                           room === 'Baño' ? 'bano' :
                           room === 'Balcón' ? 'balcon' :
                           room === 'Cocina' ? 'cocina' : 'general';
          state.updateTaskRaw({
            ...t,
            categoryId: 'limpieza',
            sectionId: `sec_limp_${freq}_${roomSlug}`,
            cycle_id: t.cycle_id || mapping.cycleId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        } else if (cat === 'limpieza') {
          const secNorm = `${t.sectionId || ''} ${t.cycle_id || ''}`.toLowerCase();
          let freq = 'diaria';
          if (secNorm.includes('anual') || t.cycle_id === 'cycle_year') freq = 'anual';
          else if (secNorm.includes('mensu') || t.cycle_id === 'cycle_month') freq = 'mensual';
          else if (secNorm.includes('seman') || t.cycle_id === 'cycle_week') freq = 'semanal';

          const isGenericSection = !t.sectionId ||
            t.sectionId === 'sec_limpieza_diaria' || t.sectionId === 'sec_limp_diaria' ||
            t.sectionId === 'sec_limpieza_semanal' || t.sectionId === 'sec_limp_semanal' ||
            t.sectionId === 'sec_limpieza_mensual' || t.sectionId === 'sec_limp_mensual' ||
            t.sectionId === 'sec_limpieza_anual' || t.sectionId === 'sec_limp_anual';

          if (isGenericSection) {
            const room = getRoomForCleaningTask(t.title);
            const roomSlug = room === 'Pasillo / Entrada' ? 'pasillo' :
                             room === 'Habitación' ? 'hab' :
                             room === 'Baño' ? 'bano' :
                             room === 'Balcón' ? 'balcon' :
                             room === 'Cocina' ? 'cocina' : 'general';
            const cycleId = freq === 'diaria' ? 'cycle_day' : freq === 'semanal' ? 'cycle_week' : freq === 'mensual' ? 'cycle_month' : 'cycle_year';
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_limp_${freq}_${roomSlug}`,
              cycle_id: t.cycle_id || cycleId,
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          }
        } else if (t.categoryId === 'compra' || t.categoryId === 'compras') {
          if (t.sectionId === 'sec_compra_mensual') {
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_${compraListId}_mensuales`,
              cycle_id: 'cycle_month',
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          } else if (t.sectionId === 'compra_anual' || t.sectionId === 'sec_compra_anual') {
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_${compraListId}_anuales`,
              cycle_id: 'cycle_year',
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          }
        }
      });

      // Migrar tareas de cuidado personal / facial que quedaron erróneamente en Quehaceres a la lista Care
      const careKeywords = [
        'aseo básico', 'aseo basico',
        'tónico facial', 'tonico facial',
        'serum', 'sérum',
        'contorno de ojos',
        'crema hidratante', 'crema facial',
        'protector solar',
        'banda facial',
        'lavar rostro', 'limpieza facial', 'doble limpieza',
        'cuidado labial', 'bálsamo labial', 'balsamo labial',
        'crema de noche', 'mascarilla nocturna',
        'piedra de alumbre', 'desodorante',
        'cepillado en seco',
        'exfoliar el rostro', 'exfoliar el cuerpo',
        'mascarilla facial', 'mascarilla capilar',
        'arreglar uñas', 'cortar y arreglar uñas',
        'piedra pómez', 'piedra pomez',
        'baño de pies',
        'crema en los pies', 'crema en las manos',
        'ejercicios faciales', 'gimnasia facial', 'pómulo', 'pomulo', 'poner morritos',
        'skin-care', 'skincare'
      ];

      allTasksList.forEach(t => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const url = (t.url || '').toLowerCase();
        const isQuehaceres = t.categoryId === 'quehaceres' || (quehaceresList && t.categoryId === quehaceresList.id);
        const isCareUrl = url.includes('care') || url.includes('skincare');
        const isCareContent = careKeywords.some(kw => title.includes(kw) || desc.includes(kw));

        if (isQuehaceres && (isCareUrl || isCareContent)) {
          const targetSection = t.cycle_id === 'cycle_week' ? `sec_${careListId}_semanales` :
                                t.cycle_id === 'cycle_month' ? `sec_${careListId}_mensuales` :
                                t.cycle_id === 'cycle_year' ? `sec_${careListId}_anuales` :
                                `sec_${careListId}_diarias`;
          state.updateTaskRaw({
            ...t,
            categoryId: careListId,
            sectionId: targetSection,
            cycle_id: t.cycle_id || (targetSection === `sec_${careListId}_diarias` ? 'cycle_day' : targetSection === `sec_${careListId}_semanales` ? 'cycle_week' : targetSection === `sec_${careListId}_mensuales` ? 'cycle_month' : 'cycle_year'),
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        } else if (t.categoryId === careListId && !t.sectionId) {
          const sec = t.cycle_id === 'cycle_week' ? `sec_${careListId}_semanales` :
                      t.cycle_id === 'cycle_month' ? `sec_${careListId}_mensuales` :
                      t.cycle_id === 'cycle_year' ? `sec_${careListId}_anuales` :
                      `sec_${careListId}_diarias`;
          state.updateTaskRaw({
            ...t,
            sectionId: sec,
            cycle_id: t.cycle_id || (sec === `sec_${careListId}_diarias` ? 'cycle_day' : sec === `sec_${careListId}_semanales` ? 'cycle_week' : sec === `sec_${careListId}_mensuales` ? 'cycle_month' : 'cycle_year'),
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Asegurar que las subtareas de cualquier tarea que se mueva a Care también se muevan a Care
      const careTaskIds = new Set(
        allTasksList
          .filter(t => t.categoryId === careListId)
          .map(t => t.id)
      );

      allTasksList.forEach(t => {
        if (t.parentId && careTaskIds.has(t.parentId) && t.categoryId !== careListId) {
          state.updateTaskRaw({
            ...t,
            categoryId: careListId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Normalización y migración automática de precios en tareas existentes (ej. "Ropa interior 100 e", "Zapatillas 200 e", notas "50 e")
      allTasksList.forEach(t => {
        const { task: normalized, modified } = normalizeTaskPrices(t);
        if (modified) {
          state.updateTaskRaw(normalized);
        }
      });

      // Asegurar que cualquier tarea con prefijo explícito [D], [S], [M], [A] tenga su cycle_id
      // y sección correcta en listas de rutina (Care, Limpieza, Quehaceres), y eliminar el prefijo del título
      allTasksList.forEach(t => {
        const title = (t.title || '').trim();
        const p = getTaskPeriodicity(t, state.listSections, state.lists);
        const prefixP = getPeriodicityFromPrefix(title);
        const hasPrefix = Boolean(prefixP);

        const effectiveP = prefixP || p;
        if (!effectiveP && !hasPrefix) return;

        const expectedCycleId = effectiveP === 'day' ? 'cycle_day' :
                                effectiveP === 'week' ? 'cycle_week' :
                                effectiveP === 'month' ? 'cycle_month' :
                                effectiveP === 'year' ? 'cycle_year' : undefined;

        let needsUpdate = false;
        let newTitle = t.title;
        let newCycleId = t.cycle_id;
        let newSectionId = t.sectionId;

        // Si tiene prefijo en el título, limpiarlo para dejar el título natural
        if (hasPrefix) {
          const stripped = stripPeriodicityPrefix(t.title);
          if (stripped && stripped !== t.title) {
            newTitle = stripped;
            needsUpdate = true;
          }
          if (expectedCycleId && t.cycle_id !== expectedCycleId) {
            newCycleId = expectedCycleId;
            needsUpdate = true;
          }
        }

        // Si pertenece a una lista de rutinas periódicas (Care, Limpieza, Quehaceres)
        const isRoutineList = t.categoryId === careListId ||
                              t.categoryId === 'limpieza' ||
                              t.categoryId === 'quehaceres' ||
                              (quehaceresList && t.categoryId === quehaceresList.id);

        if (isRoutineList && effectiveP) {
          const currentSecPeriodicity = t.sectionId
            ? getSectionPeriodicity(t.sectionId, undefined, state.listSections, state.lists)
            : null;

          // Si no tiene sección o está en una sección de periodicidad distinta (ej. tarea diaria en sección Semanal)
          if (!t.sectionId || (hasPrefix && currentSecPeriodicity && currentSecPeriodicity !== effectiveP)) {
            const listSectionsForThisList = (state.listSections || []).filter(s => s.listId === t.categoryId);
            const targetSec = listSectionsForThisList.find(s => {
              const secP = getSectionPeriodicity(s.id, s.name, state.listSections, state.lists);
              return secP === effectiveP;
            });

            if (targetSec && targetSec.id !== t.sectionId) {
              newSectionId = targetSec.id;
              newCycleId = expectedCycleId;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          state.updateTaskRaw({
            ...t,
            title: newTitle,
            cycle_id: newCycleId,
            sectionId: newSectionId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Eliminar sublistas obsoletas ahora que sus tareas están en Limpieza
      const obsoleteSublistIds = ['limpieza_diaria', 'limpieza_semanal', 'limpieza_mensual', 'limpieza_anual'];
      obsoleteSublistIds.forEach(id => {
        if (lists.some(l => l.id === id)) {
          state.removeList(id);
        }
      });
    }

    // Inicializar tareas de Primeros Pasos si no se ha ocultado la guía
    if (!isHidden) {
      const existingTasks = Object.values(state.tasks);
      
      // Limpiar tareas de primeros pasos existentes que tuvieran cycle_day accidentalmente asignado
      existingTasks.forEach(t => {
        if (t.categoryId === 'primeros_pasos' && t.cycle_id) {
          const updated = { ...t };
          delete updated.cycle_id;
          state.updateTaskRaw(updated);
        }
      });

      const hasOnboardingTasks = existingTasks.some(t => t.categoryId === 'primeros_pasos');
      if (!hasOnboardingTasks) {
        const defaultTasks: Partial<TaskItem>[] = [
          {
            id: 'task_onboarding_1',
            categoryId: 'primeros_pasos',
            title: 'Escribe tu primer recordatorio',
            description: 'Prueba abajo con «Reunión mañana a las 10:00 !alta @Trabajo»: la fecha, la hora y la lista se rellenan solas.',
            priority: 'high',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_2',
            categoryId: 'primeros_pasos',
            title: 'Encuentra cualquier cosa al instante',
            description: 'Pulsa Ctrl+K (⌘K en Mac) para buscar entre tus recordatorios, listas y ciclos.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_3',
            categoryId: 'primeros_pasos',
            title: 'Concéntrate con el Modo Zen',
            description: 'Abre las opciones de un recordatorio (clic derecho o pulsación larga) y elige «Modo Enfoque Zen».',
            priority: 'low',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_4',
            categoryId: 'primeros_pasos',
            title: 'Ordena con listas y prioridades',
            description: 'Crea listas desde la barra lateral y marca lo importante escribiendo !alta, !media o !baja.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_5',
            categoryId: 'primeros_pasos',
            title: 'Llévalos a todos tus dispositivos',
            description: 'Todo se guarda en este dispositivo. Al crear una cuenta, se sincroniza solo con tu móvil y tu ordenador.',
            priority: 'none',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
        ];
        defaultTasks.forEach((t) => state.addTask(t));
      }
    }

    runContentMigrations(state);
    state.cleanupDataHygiene();
  }, [hasHydrated]);
}
