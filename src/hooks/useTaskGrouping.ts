import { useMemo } from 'react';
import type { TaskItem, CustomCycle as Cycle, ListSection, CustomList as List } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { getEffectiveCycleId } from '../utils/sectionRoutine';
// This is a stub for the hook
export function useTaskGrouping({
  currentView,
  isFolderView,
  isSmartView,
  isListView,
  getTasksForSmartView,
  getTasksByList,
  getTasksByCycle,
  tasks,
  resolvedShowCompleted,
  recentlyCompletedIds,
  lists,
  listSections,
  cycles,
  currentCycle,
  cycleViewMode,
  listSectionFilter,
  dailyTimeFilter,
  resolveTimeOfDay,
  currentList,
  sortTaskList,
  lifeLogViewMode,
  selectedPersonFilter,
  extractPeopleFromText,
  referenceDate
}: any) {
  return useMemo(() => {
    let rawGrouped: Record<string, TaskItem[]> = {};
    if (currentView === 'TRASH') {
      const allTrash = Object.values(tasks as Record<string, TaskItem>).filter((t: any) => !!t.deleted_at);
      rawGrouped = { 'Papelera': allTrash as TaskItem[] };
      return rawGrouped;
    }
    if (isFolderView) {
      const folderId = currentView.replace('folder_', '').replace('list_', '');
      const descendantListIds = new Set<string>();
      const findDescendants = (parentId: string) => {
        lists?.forEach((l: List) => {
          if (l.parentId === parentId) {
            descendantListIds.add(l.id);
            findDescendants(l.id);
          }
        });
      };
      findDescendants(folderId);

      const allTasks = Object.values(tasks).filter((t: any) => !t.deleted_at);
      const validTasks = resolvedShowCompleted 
        ? allTasks 
        : allTasks.filter((t: any) => !isTaskCompleted(t) || recentlyCompletedIds.includes(t.id));

      const filteredTasks = validTasks.filter((t: any) => {
        const catId = t.categoryId || (t as any).category_id;
        return catId && descendantListIds.has(catId);
      });

      const grouped: Record<string, TaskItem[]> = {};
      filteredTasks.forEach((task: any) => {
        const catId = task.categoryId || (task as any).category_id;
        const listName = lists?.find((l: List) => l.id === catId)?.name || 'Sin Lista';
        if (!grouped[listName]) grouped[listName] = [];
        grouped[listName].push(task);
      });
      rawGrouped = grouped;
    } else if (isSmartView) {
      rawGrouped = getTasksForSmartView(resolvedShowCompleted, recentlyCompletedIds);
    } else if (isListView) {
      if (currentView === 'list_que_he_hecho') {
        const allTasks = Object.values(tasks).filter((t: any) => !t.deleted_at && (t.categoryId === 'que_he_hecho' || (t as any).category_id === 'que_he_hecho'));
        // En «Qué he hecho» todas las vivencias y recuerdos están siempre visibles
        const validTasks = allTasks;

        const grouped: Record<string, TaskItem[]> = {};

        if (lifeLogViewMode === 'people') {
          const peopleSet = new Set<string>();
          validTasks.forEach((t: any) => {
            const tPeople = (t.people && t.people.length > 0) ? t.people : (extractPeopleFromText ? extractPeopleFromText(`${t.title || ''} ${t.description || ''}`) : []);
            tPeople.forEach((p: string) => peopleSet.add(p));
          });

          const sortedPeople = Array.from(peopleSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

          sortedPeople.forEach((p: string) => {
            grouped[`persona_${p}`] = [];
          });
          grouped['persona_solo'] = [];

          validTasks.forEach((t: any) => {
            const tPeople = (t.people && t.people.length > 0) ? t.people : (extractPeopleFromText ? extractPeopleFromText(`${t.title || ''} ${t.description || ''}`) : []);
            if (tPeople.length === 0) {
              grouped['persona_solo'].push(t);
            } else {
              tPeople.forEach((p: string) => {
                const key = `persona_${p}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(t);
              });
            }
          });

          if (grouped['persona_solo'].length === 0) {
            delete grouped['persona_solo'];
          }

          if (selectedPersonFilter) {
            const filterKey = `persona_${selectedPersonFilter}`;
            Object.keys(grouped).forEach(k => {
              if (k !== filterKey) delete grouped[k];
            });
          }
        } else {
          const sortedByDate = [...validTasks].sort((a: any, b: any) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : new Date(a.created_at).getTime();
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : new Date(b.created_at).getTime();
            return dateB - dateA;
          });

          sortedByDate.forEach((t: any) => {
            const d = t.dueDate ? new Date(t.dueDate) : new Date(t.created_at);
            const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
            const month = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
            const groupKey = `timeline_${year}_${String(month + 1).padStart(2, '0')}`;
            if (!grouped[groupKey]) grouped[groupKey] = [];
            grouped[groupKey].push(t);
          });
        }

        rawGrouped = grouped;
      } else {
        rawGrouped = getTasksByList(
          currentView.replace('list_', ''),
          resolvedShowCompleted,
          recentlyCompletedIds,
          referenceDate ? new Date(referenceDate) : undefined
        );
      }
    } else {
      rawGrouped = getTasksByCycle(currentView, resolvedShowCompleted, recentlyCompletedIds, referenceDate);
    }

    if (currentCycle) {
      const filteredGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        const mode = cycleViewMode;

        const allowedCyclesForSection = new Set<string>();
        if (currentCycle.id === 'cycle_day') {
          allowedCyclesForSection.add('cycle_day');
        } else if (mode === 'full_routine') {
          cycles.filter((c: Cycle) => c.daysValue <= currentCycle.daysValue).forEach((c: Cycle) => allowedCyclesForSection.add(c.id));
        } else {
          allowedCyclesForSection.add(currentCycle.id);
        }

        const matching = taskList.filter((t: any) => {
          const eff = getEffectiveCycleId(t, listSections, lists);
          if (!eff || !allowedCyclesForSection.has(eff)) return false;
          if (currentCycle.id === 'cycle_day' && dailyTimeFilter !== 'all') {
            return resolveTimeOfDay(t) === dailyTimeFilter;
          }
          return true;
        });
        
        const tasksToInclude = new Map<string, TaskItem>();
        matching.forEach((t: any) => {
          tasksToInclude.set(t.id, t);
          let current = t;
          while (current.parentId) {
            const parent = tasks[current.parentId];
            if (!parent || parent.deleted_at) break;
            const parentCat = parent.categoryId || (parent as any).category_id;
            const tCat = t.categoryId || (t as any).category_id;
            if (parentCat && tCat && parentCat !== tCat) break;
            const parentEff = getEffectiveCycleId(parent, listSections, lists);
            if (!parentEff || !allowedCyclesForSection.has(parentEff)) {
              break;
            }
            if (!tasksToInclude.has(parent.id)) {
              tasksToInclude.set(parent.id, parent);
            }
            current = parent;
          }
        });
        
        const finalTasks = Array.from(tasksToInclude.values());
        if (finalTasks.length > 0) filteredGrouped[key] = finalTasks;
      });
      rawGrouped = filteredGrouped;
    }

    if (isListView && listSectionFilter !== 'all') {
      const currentSections = (listSections || []).filter((s: ListSection) => s.listId === currentList?.id && !s.deleted_at);
      const filteredGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        const matching = taskList.filter((t: any) => {
          const taskSecId = t.sectionId || (t as any).section_id;
          const secObj = taskSecId ? currentSections.find((s: ListSection) => s.id === taskSecId) : null;
          const textToMatch = `${secObj?.name || ''} ${taskSecId || ''} ${t.cycle_id || ''}`.toLowerCase();
          const isDay = t.cycle_id === 'cycle_day' || !!t.targetCount || textToMatch.includes('diaria') || textToMatch.includes('diario') || textToMatch.includes('recurrent');
          const isWeek = t.cycle_id === 'cycle_week' || textToMatch.includes('semanal');
          const isMonth = t.cycle_id === 'cycle_month' || textToMatch.includes('mensual');
          const isYear = t.cycle_id === 'cycle_year' || textToMatch.includes('anual');

          if (listSectionFilter === 'only_diaria') return isDay;
          if (listSectionFilter === 'only_semanal') return isWeek;
          if (listSectionFilter === 'semanal_plus_diaria') return isWeek || isDay;
          if (listSectionFilter === 'only_mensual') return isMonth;
          if (listSectionFilter === 'mensual_plus_semanal') return isMonth || isWeek;
          if (listSectionFilter === 'mensual_all') return isMonth || isWeek || isDay;
          if (listSectionFilter === 'only_anual') return isYear;
          return true;
        });

        const tasksToInclude = new Map<string, TaskItem>();
        matching.forEach((t: any) => {
          tasksToInclude.set(t.id, t);
          let current = t;
          while (current.parentId) {
            const parent = tasks[current.parentId];
            if (!parent || parent.deleted_at) break;
            if (!matching.some(m => m.id === parent.id)) {
              break;
            }
            if (!tasksToInclude.has(parent.id)) {
              tasksToInclude.set(parent.id, parent);
            }
            current = parent;
          }
        });
        
        const finalTasks = Array.from(tasksToInclude.values());
        if (finalTasks.length > 0) filteredGrouped[key] = finalTasks;
      });
      rawGrouped = filteredGrouped;
    }

    const sortedGrouped: Record<string, TaskItem[]> = {};
    Object.entries(rawGrouped).forEach(([key, taskList]) => {
      sortedGrouped[key] = sortTaskList(taskList);
    });
    return sortedGrouped;
  }, [
    currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, 
    getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, listSections, cycles, 
    currentCycle, cycleViewMode, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, 
    sortTaskList, lifeLogViewMode, selectedPersonFilter, extractPeopleFromText, referenceDate
  ]);
}
