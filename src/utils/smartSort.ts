import type { CustomCycle, TaskItem } from '../models/Task';

/**
 * «A continuación»: pendientes ordenadas por lo que toca ya (avisos en las próximas horas;
 * por la tarde, las diarias) y, a igualdad, por antigüedad. Función pura: recibe las tareas
 * para que quien la use declare de qué depende (y no devuelva un array nuevo en cada
 * lectura del store, que en el widget provocaba un bucle de renderizado).
 */
export function smartSortTasks(
  tasks: Record<string, TaskItem>,
  cycles: CustomCycle[],
  temporarilyShowIds: string[] = [],
  now: Date = new Date()
): TaskItem[] {
  const tasksArray = Object.values(tasks).filter(
    (t) => !t.deleted_at && t.categoryId !== 'primeros_pasos' && (t.status === 'pending' || temporarilyShowIds.includes(t.id))
  );
  const currentHours = now.getHours();

  const scored = tasksArray.map((task) => {
    let score = 0;
    if (task.alerts && task.alerts.length > 0) {
      let closestDiff = 999;
      task.alerts.forEach((alert) => {
        if (alert.type === 'at_time' && alert.time) {
          const alertHour = parseInt(alert.time.split(':')[0], 10);
          const diff = alertHour - currentHours;
          if (diff >= 0 && diff < closestDiff) closestDiff = diff;
        }
      });
      if (closestDiff <= 2) score += 50;
      else if (closestDiff <= 5) score += 20;
    }
    // Por la tarde suben las diarias
    const taskCycle = cycles.find((c) => c.id === task.cycle_id);
    if (taskCycle && taskCycle.daysValue === 1 && currentHours > 18) score += 30;
    return { task, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || new Date(a.task.created_at).getTime() - new Date(b.task.created_at).getTime())
    .map(({ task, score }) => ({ ...task, _score: score }) as TaskItem);
}
