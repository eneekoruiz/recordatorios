import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import type { CustomList, CustomCycle } from '../../../models/Task';

interface MainEmptyStateProps {
  currentView: string;
  currentList?: CustomList;
  currentCycle?: CustomCycle;
  onOpenNewTask?: (sectionId?: string) => void;
}

import { FREQUENCY_RESERVED_COLORS } from '../../../constants/colors';

const SMART_ACCENTS: Record<string, string> = {
  'smart_today': '#007AFF',
  'smart_scheduled': '#FF3B30',
  'smart_all': '#5856D6',
  'smart_flagged': '#FF9500',
  'smart_completed': '#8E8E93',
  'smart_overdue': '#FF3B30',
  'smart_primeros_pasos': '#AF52DE',
  'list_inbox': '#007AFF',
  'cycle_day': FREQUENCY_RESERVED_COLORS.day,
  'cycle_week': FREQUENCY_RESERVED_COLORS.week,
  'cycle_month': FREQUENCY_RESERVED_COLORS.month,
  'cycle_year': FREQUENCY_RESERVED_COLORS.year
};

export const MainEmptyState: React.FC<MainEmptyStateProps> = ({
  currentView,
  currentList,
  currentCycle,
  onOpenNewTask
}) => {
  const accentColor = SMART_ACCENTS[currentView] || currentList?.color || '#007AFF';

  const emptyStateProps = useMemo(() => {
    switch (currentView) {
      case 'smart_primeros_pasos':
        return {
          title: "¡Primeros Pasos completados!",
          subtitle: "Has completado todos los recordatorios guía. Puedes ocultar esta lista inteligente desde el botón Editar de la barra lateral.",
          iconName: "sparkles",
          accentColor
        };
      case 'smart_today':
        return {
          title: "Todo al día para hoy",
          subtitle: "No tienes tareas programadas para el día de hoy. Disfruta tu tiempo o añade algo nuevo.",
          iconName: "today",
          accentColor
        };
      case 'smart_scheduled':
        return {
          title: "Sin tareas programadas",
          subtitle: "Planifica tus próximos días añadiendo tareas con fecha límite.",
          iconName: "scheduled",
          accentColor
        };
      case 'smart_all':
        return {
          title: "No hay tareas en absoluto",
          subtitle: "Tienes todo bajo control. Relájate o añade un nuevo recordatorio.",
          iconName: "sparkles",
          accentColor
        };
      case 'smart_flagged':
        return {
          title: "Sin tareas destacadas",
          subtitle: "Marca tareas importantes con una bandera para tenerlas siempre a la mano.",
          iconName: "flagged",
          accentColor
        };
      case 'smart_completed':
        return {
          title: "Sin tareas completadas",
          subtitle: "A medida que vayas marcando tareas como terminadas, se guardarán aquí.",
          iconName: "completed",
          accentColor
        };
      case 'smart_overdue':
        return {
          title: "¡Todo al día!",
          subtitle: "Excelente trabajo, no tienes ninguna tarea atrasada o vencida.",
          iconName: "overdue",
          accentColor
        };
      case 'list_inbox':
        return {
          title: "Bandeja de entrada vacía",
          subtitle: "Todos tus pendientes rápidos están procesados. ¡Gran productividad!",
          iconName: "inbox",
          accentColor
        };
      case 'TRASH':
        return {
          title: "La papelera está vacía",
          subtitle: "Cuando elimines tareas o listas, aparecerán aquí antes de borrarse permanentemente.",
          iconName: "trash",
          accentColor: '#8E8E93'
        };
      case 'cycle_day':
        return {
          title: "Día libre de ciclos",
          subtitle: "No hay tareas activas para tu ciclo diario actual.",
          iconName: "clock",
          accentColor
        };
      case 'cycle_week':
        return {
          title: "Semana despejada",
          subtitle: "No hay tareas asignadas para tu ciclo semanal actual.",
          iconName: "clock",
          accentColor
        };
      case 'cycle_month':
      case 'cycle_year':
        return {
          title: "Ciclo temporal despejado",
          subtitle: "No tienes objetivos o recordatorios para este ciclo temporal.",
          iconName: "clock",
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
          accentColor
        };
      }
    }
  }, [currentView, currentList, currentCycle, accentColor]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <EmptyState 
        {...emptyStateProps}
        onAction={currentView !== 'TRASH' && onOpenNewTask ? () => onOpenNewTask() : undefined}
        actionLabel={currentView !== 'TRASH' && onOpenNewTask ? "Nuevo recordatorio" : undefined}
      />
    </div>
  );
};
