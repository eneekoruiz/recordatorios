import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import type { CustomList, CustomCycle } from '../../../models/Task';
import { HapticService } from '../../../services/HapticService';

interface MainEmptyStateProps {
  currentView: string;
  currentList?: CustomList;
  currentCycle?: CustomCycle;
  onOpenNewTask: (sectionId?: string) => void;
}

const SMART_ACCENTS: Record<string, string> = {
  'smart_today': '#007AFF',
  'smart_scheduled': '#FF3B30',
  'smart_all': '#5856D6',
  'smart_flagged': '#FF9500',
  'smart_completed': '#8E8E93',
  'smart_overdue': '#FF3B30',
  'smart_primeros_pasos': '#AF52DE',
  'list_inbox': '#007AFF',
  'cycle_day': '#007AFF',
  'cycle_week': '#34C759',
  'cycle_month': '#AF52DE',
  'cycle_year': '#FF9500'
};

export const MainEmptyState: React.FC<MainEmptyStateProps> = ({
  currentView,
  currentList,
  currentCycle,
  onOpenNewTask
}) => {
  const accentColor = SMART_ACCENTS[currentView] || currentList?.color || '#007AFF';

  const handleAddNew = () => {
    HapticService.selection();
    onOpenNewTask();
  };

  const emptyStateProps = useMemo(() => {
    switch (currentView) {
      case 'smart_primeros_pasos':
        return {
          title: "¡Primeros Pasos completados!",
          subtitle: "Has completado todos los recordatorios guía. Puedes ocultar esta lista inteligente desde el botón Editar de la barra lateral.",
          iconName: "sparkles",
          ctaText: "Nuevo recordatorio",
          onAction: handleAddNew,
          accentColor
        };
      case 'smart_today':
        return {
          title: "Todo al día para hoy",
          subtitle: "No tienes tareas programadas para el día de hoy. Disfruta tu tiempo o añade algo nuevo.",
          iconName: "today",
          ctaText: "Nuevo recordatorio para hoy",
          onAction: handleAddNew,
          accentColor
        };
      case 'smart_scheduled':
        return {
          title: "Sin tareas programadas",
          subtitle: "Planifica tus próximos días añadiendo tareas con fecha límite.",
          iconName: "scheduled",
          ctaText: "Programar recordatorio",
          onAction: handleAddNew,
          accentColor
        };
      case 'smart_all':
        return {
          title: "No hay tareas en absoluto",
          subtitle: "Tienes todo bajo control. Relájate o añade un nuevo recordatorio.",
          iconName: "sparkles",
          ctaText: "Nuevo recordatorio",
          onAction: handleAddNew,
          accentColor
        };
      case 'smart_flagged':
        return {
          title: "Sin tareas destacadas",
          subtitle: "Marca tareas importantes con una bandera para tenerlas siempre a la mano.",
          iconName: "flagged",
          ctaText: "Nuevo recordatorio",
          onAction: handleAddNew,
          accentColor
        };
      case 'smart_completed':
        return {
          title: "Sin tareas completadas",
          subtitle: "A medida que vayas marcando tareas como terminadas, se guardarán aquí.",
          iconName: "completed",
          ctaText: undefined,
          onAction: undefined,
          accentColor
        };
      case 'smart_overdue':
        return {
          title: "¡Todo al día!",
          subtitle: "Excelente trabajo, no tienes ninguna tarea atrasada o vencida.",
          iconName: "overdue",
          ctaText: "Nuevo recordatorio",
          onAction: handleAddNew,
          accentColor
        };
      case 'list_inbox':
        return {
          title: "Bandeja de entrada vacía",
          subtitle: "Todos tus pendientes rápidos están procesados. ¡Gran productividad!",
          iconName: "inbox",
          ctaText: "Añadir a la bandeja",
          onAction: handleAddNew,
          accentColor
        };
      case 'TRASH':
        return {
          title: "La papelera está vacía",
          subtitle: "Cuando elimines tareas o listas, aparecerán aquí antes de borrarse permanentemente.",
          iconName: "trash",
          ctaText: undefined,
          onAction: undefined,
          accentColor: '#8E8E93'
        };
      case 'cycle_day':
        return {
          title: "Día libre de ciclos",
          subtitle: "No hay tareas activas para tu ciclo diario actual.",
          iconName: "clock",
          ctaText: "Añadir tarea diaria",
          onAction: handleAddNew,
          accentColor
        };
      case 'cycle_week':
        return {
          title: "Semana despejada",
          subtitle: "No hay tareas asignadas para tu ciclo semanal actual.",
          iconName: "clock",
          ctaText: "Añadir tarea semanal",
          onAction: handleAddNew,
          accentColor
        };
      case 'cycle_month':
      case 'cycle_year':
        return {
          title: "Ciclo temporal despejado",
          subtitle: "No tienes objetivos o recordatorios para este ciclo temporal.",
          iconName: "clock",
          ctaText: "Añadir tarea",
          onAction: handleAddNew,
          accentColor
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
          ctaText: isFolder ? undefined : "Nuevo recordatorio",
          onAction: isFolder ? undefined : handleAddNew,
          accentColor
        };
      }
    }
  }, [currentView, currentList, currentCycle, accentColor]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <EmptyState {...emptyStateProps} />
    </div>
  );
};
