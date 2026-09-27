import React, { useMemo } from 'react';
import { EmptyState } from '../../ui/EmptyState';
import type { CustomList, CustomCycle } from '../../../models/Task';
import { isShoppingList } from '../../../utils/specialLists';

interface MainEmptyStateProps {
  currentView: string;
  currentList?: CustomList;
  currentCycle?: CustomCycle;
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
}) => {
  const accentColor = SMART_ACCENTS[currentView] || currentList?.color || '#007AFF';

  const emptyStateProps = useMemo(() => {
    // Textos cortos y en calma, como en Recordatorios: qué aparecerá aquí y cómo añadirlo.
    const s = (title: string, subtitle: string, iconName: string, color = accentColor) => ({ title, subtitle, iconName, accentColor: color });
    switch (currentView) {
      case 'smart_primeros_pasos':
        return s('Guía completada', 'Ya conoces lo básico. Puedes ocultar esta lista con «Editar».', 'sparkles');
      case 'smart_today':
        return s('Nada para hoy', 'Lo que tenga fecha de hoy aparecerá aquí.', 'today');
      case 'smart_scheduled':
        return s('Nada programado', 'Los recordatorios con fecha aparecerán aquí.', 'scheduled');
      case 'smart_all':
        return s('Sin recordatorios', 'Escribe abajo para añadir el primero.', 'sparkles');
      case 'smart_flagged':
        return s('Nada con marca', 'Marca lo importante para tenerlo siempre a mano.', 'flagged');
      case 'smart_completed':
        return s('Nada completado todavía', 'Lo que vayas terminando se guardará aquí.', 'completed');
      case 'smart_overdue':
        return s('Nada vencido', 'Todo está al día.', 'overdue');
      case 'list_inbox':
        return s('Bandeja vacía', 'Lo que añadas sin elegir lista llegará aquí.', 'inbox');
      case 'TRASH':
        return s('La papelera está vacía', 'Lo que elimines se guarda aquí 30 días.', 'trash', '#8E8E93');
      case 'cycle_day':
        return s('Nada diario', 'Las tareas de cada día aparecerán aquí.', 'clock');
      case 'cycle_week':
        return s('Nada semanal', 'Las tareas de cada semana aparecerán aquí.', 'clock');
      case 'cycle_month':
        return s('Nada mensual', 'Las tareas de cada mes aparecerán aquí.', 'clock');
      case 'cycle_year':
        return s('Nada anual', 'Las tareas de cada año aparecerán aquí.', 'clock');
      default: {
        if (currentList?.isFolder) {
          return s(`«${currentList.name || 'Carpeta'}» está vacía`, 'Añade una lista dentro o un recordatorio.', 'folder');
        }
        const name = currentList?.name || currentCycle?.name || 'La lista';
        return s(`«${name}» está vacía`, 'Escribe abajo para añadir el primer recordatorio.', isShoppingList(currentView, currentList) ? 'cart' : 'list');
      }
    }
  }, [currentView, currentList, currentCycle, accentColor]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      <EmptyState 
        {...emptyStateProps}

      />
    </div>
  );
};
