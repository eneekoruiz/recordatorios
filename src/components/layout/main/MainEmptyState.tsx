import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import type { CustomList, CustomCycle } from '../../../models/Task';

interface MainEmptyStateProps {
  currentView: string;
  currentList?: CustomList;
  currentCycle?: CustomCycle;
  onOpenNewTask: (sectionId?: string) => void;
}

export const MainEmptyState: React.FC<MainEmptyStateProps> = ({
  currentView,
  currentList,
  currentCycle,
  onOpenNewTask: _onOpenNewTask
}) => {
  const emptyStateProps = useMemo(() => {
    switch (currentView) {
      case 'smart_primeros_pasos':
        return {
          title: "¡Primeros Pasos completados!",
          subtitle: "Has completado todos los recordatorios guía. Puedes ocultar esta lista inteligente desde el botón Editar de la barra lateral.",
          iconName: "sparkles",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_today':
        return {
          title: "Todo al día para hoy",
          subtitle: "No tienes tareas programadas para el día de hoy. Disfruta tu tiempo o añade algo nuevo.",
          iconName: "today",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_scheduled':
        return {
          title: "Sin tareas programadas",
          subtitle: "Planifica tus próximos días añadiendo tareas con fecha límite.",
          iconName: "scheduled",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_all':
        return {
          title: "No hay tareas en absoluto",
          subtitle: "Tienes todo bajo control. Relájate o añade un nuevo recordatorio.",
          iconName: "sparkles",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_flagged':
        return {
          title: "Sin tareas destacadas",
          subtitle: "Marca tareas importantes con una bandera para tenerlas siempre a la mano.",
          iconName: "flagged",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_completed':
        return {
          title: "Sin tareas completadas",
          subtitle: "A medida que vayas marcando tareas como terminadas, se guardarán aquí.",
          iconName: "completed",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_overdue':
        return {
          title: "¡Todo al día!",
          subtitle: "Excelente trabajo, no tienes ninguna tarea atrasada o vencida.",
          iconName: "overdue",
          ctaText: undefined,
          onAction: undefined
        };
      case 'list_inbox':
        return {
          title: "Bandeja de entrada vacía",
          subtitle: "Todos tus pendientes rápidos están procesados. ¡Gran productividad!",
          iconName: "inbox",
          ctaText: undefined,
          onAction: undefined
        };
      case 'TRASH':
        return {
          title: "La papelera está vacía",
          subtitle: "Cuando elimines tareas o listas, aparecerán aquí antes de borrarse permanentemente.",
          iconName: "trash",
          ctaText: undefined,
          onAction: undefined
        };
      case 'cycle_day':
        return {
          title: "Día libre de ciclos",
          subtitle: "No hay tareas activas para tu ciclo diario actual.",
          iconName: "clock",
          ctaText: undefined,
          onAction: undefined
        };
      case 'cycle_week':
        return {
          title: "Semana despejada",
          subtitle: "No hay tareas asignadas para tu ciclo semanal actual.",
          iconName: "clock",
          ctaText: undefined,
          onAction: undefined
        };
      case 'cycle_month':
      case 'cycle_year':
        return {
          title: "Ciclo temporal despejado",
          subtitle: "No tienes objetivos o recordatorios para este ciclo temporal.",
          iconName: "clock",
          ctaText: undefined,
          onAction: undefined
        };
      default: {
        const isFolder = currentList?.isFolder;
        return {
          title: isFolder 
            ? `La carpeta "${currentList?.name || 'Carpeta'}" está vacía`
            : `Sin tareas en "${currentList?.name || (currentCycle ? currentCycle.name : 'la lista')}"`,
          subtitle: isFolder 
            ? "Esta carpeta no contiene sublistas ni tareas activas. Puedes añadir una nueva lista o crear un recordatorio dentro."
            : "Esta lista está vacía en este momento. Empieza añadiendo tu primer ítem.",
          iconName: isFolder ? "folder" : "list",
          ctaText: undefined,
          onAction: undefined
        };
      }
    }
  }, [currentView, currentList, currentCycle]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <EmptyState {...emptyStateProps} />
    </div>
  );
};
