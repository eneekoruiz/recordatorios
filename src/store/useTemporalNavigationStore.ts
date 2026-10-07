import { create } from 'zustand';

export type TemporalGranularity = 'day' | 'week' | 'month' | 'year';

interface TemporalNavigationState {
  /**
   * Fecha de referencia temporal activa.
   * `null` representa el presente en tiempo real (Hoy).
   */
  temporalDate: Date | null;
  /** Granularidad seleccionada o activa ('day' | 'week' | 'month' | 'year') */
  granularity: TemporalGranularity | null;

  setTemporalDate: (date: Date | null) => void;
  setGranularity: (granularity: TemporalGranularity | null) => void;
  resetToNow: () => void;
  stepPeriod: (direction: -1 | 1, explicitGranularity?: TemporalGranularity) => void;
  isCurrentRealTime: (granularity?: TemporalGranularity) => boolean;
}

function isSameIsoWeek(d1: Date, d2: Date): boolean {
  const getMonday = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
    copy.setDate(diff);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };
  return getMonday(d1) === getMonday(d2);
}

export const useTemporalNavigationStore = create<TemporalNavigationState>((set, get) => ({
  temporalDate: null,
  granularity: null,

  setTemporalDate: (date) => set({ temporalDate: date }),
  
  setGranularity: (granularity) => set({ granularity }),

  resetToNow: () => set({ temporalDate: null, granularity: null }),

  stepPeriod: (direction: -1 | 1, explicitGranularity?: TemporalGranularity) => {
    const { temporalDate, granularity } = get();
    const g = explicitGranularity || granularity || 'month';
    const baseDate = temporalDate ? new Date(temporalDate) : new Date();

    const nextDate = new Date(baseDate);

    if (g === 'year') {
      nextDate.setFullYear(nextDate.getFullYear() + direction);
    } else if (g === 'month') {
      nextDate.setDate(1); // evitar desbordamiento de fin de mes
      nextDate.setMonth(nextDate.getMonth() + direction);
    } else if (g === 'week') {
      nextDate.setDate(nextDate.getDate() + direction * 7);
    } else {
      // 'day'
      nextDate.setDate(nextDate.getDate() + direction);
    }

    const now = new Date();
    // Si coincide exactamente con el período actual según granularidad, resetear a null para indicar presente
    let matchesNow = false;
    if (g === 'year') {
      matchesNow = nextDate.getFullYear() === now.getFullYear();
    } else if (g === 'month') {
      matchesNow = nextDate.getFullYear() === now.getFullYear() && nextDate.getMonth() === now.getMonth();
    } else if (g === 'week') {
      matchesNow = isSameIsoWeek(nextDate, now);
    } else if (g === 'day') {
      matchesNow = nextDate.toDateString() === now.toDateString();
    }

    // Permitimos conservar la fecha explícita o volver a null si coincide con el presente
    set({ temporalDate: matchesNow ? null : nextDate, granularity: g });
  },

  isCurrentRealTime: (explicitGranularity?: TemporalGranularity) => {
    const { temporalDate, granularity } = get();
    if (!temporalDate) return true;
    const now = new Date();
    const g = explicitGranularity || granularity || 'month';
    if (g === 'year') return temporalDate.getFullYear() === now.getFullYear();
    if (g === 'month') return temporalDate.getFullYear() === now.getFullYear() && temporalDate.getMonth() === now.getMonth();
    if (g === 'week') return isSameIsoWeek(temporalDate, now);
    if (g === 'day') return temporalDate.toDateString() === now.toDateString();
    return false;
  }
}));
