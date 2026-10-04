import type { TaskItem } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { isVitalHabitTask } from '../utils/vitalHabits';
import { calculateCompletedTasksDuration } from '../utils/taskDuration';

export interface WeeklyReviewReport {
  weekStartDate: Date;
  weekEndDate: Date;
  completedTasks: TaskItem[];
  completedCount: number;
  completedMinutes: number;
  staleTasks: TaskItem[];
  overdueTasks: TaskItem[];
  vitalHabitsCompliancePercent: number;
  topAchievements: string[];
  recommendations: string[];
}

export class ReviewAgentService {
  /**
   * Generates a complete Weekly Review audit report.
   */
  public static generateWeeklyAudit(
    allTasks: Record<string, TaskItem>,
    lists?: any[],
    listSections?: any[]
  ): WeeklyReviewReport {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const tasksList = Object.values(allTasks).filter(t => !t.deleted_at);

    // 1. Tareas completadas en los últimos 7 días
    const completedTasks = tasksList.filter(t => {
      if (!isTaskCompleted(t)) return false;
      if (!t.completed_at) return true; // Si no tiene fecha pero está completa, se cuenta
      const completedDate = new Date(t.completed_at);
      return completedDate >= sevenDaysAgo;
    });

    const completedDuration = calculateCompletedTasksDuration(completedTasks, listSections, lists);

    // 2. Tareas estancadas (pendientes con más de 7 días o postergadas)
    const staleTasks = tasksList.filter(t => {
      if (isTaskCompleted(t) || isVitalHabitTask(t)) return false;
      const createdDate = new Date(t.created_at || t.updated_at);
      const isOld = createdDate < sevenDaysAgo;
      const isPostponed = (t.postponeCount ?? 0) >= 2;
      return isOld || isPostponed;
    });

    // 3. Tareas vencidas
    const todayStr = now.toISOString().split('T')[0];
    const overdueTasks = tasksList.filter(t => {
      if (isTaskCompleted(t) || !t.dueDate) return false;
      return t.dueDate < todayStr;
    });

    // 4. Hábitos vitales
    const vitalTasks = tasksList.filter(t => isVitalHabitTask(t));
    const completedVital = vitalTasks.filter(t => isTaskCompleted(t));
    const compliancePercent = vitalTasks.length > 0
      ? Math.round((completedVital.length / vitalTasks.length) * 100)
      : 100;

    // 5. Logros destacados
    const topAchievements = completedTasks
      .slice(0, 5)
      .map(t => t.title);

    // 6. Recomendaciones del agente
    const recommendations: string[] = [];

    if (completedTasks.length >= 10) {
      recommendations.push(`¡Ritmo sobresaliente! Has completado ${completedTasks.length} recordatorios esta semana.`);
    } else if (completedTasks.length > 0) {
      recommendations.push(`Has avanzado en ${completedTasks.length} tareas importantes.`);
    } else {
      recommendations.push('Esta semana no registraste tareas completadas. Un buen momento para reiniciar el enfoque.');
    }

    if (overdueTasks.length > 0) {
      recommendations.push(`Tienes ${overdueTasks.length} ${overdueTasks.length === 1 ? 'tarea vencida' : 'tareas vencidas'} que conviene reprogramar o cerrar.`);
    }

    if (staleTasks.length > 3) {
      recommendations.push(`Detectamos ${staleTasks.length} tareas estancadas. Considera dividirlas en subtareas o descartarlas.`);
    }

    if (compliancePercent >= 80 && vitalTasks.length > 0) {
      recommendations.push('Gran constancia en tus hábitos vitales diarios.');
    }

    return {
      weekStartDate: sevenDaysAgo,
      weekEndDate: now,
      completedTasks,
      completedCount: completedTasks.length,
      completedMinutes: completedDuration.activeMinutes,
      staleTasks,
      overdueTasks,
      vitalHabitsCompliancePercent: compliancePercent,
      topAchievements,
      recommendations
    };
  }
}
