import { create } from 'zustand';

// Día elegido en el calendario (no se guarda: al volver, el calendario abre en hoy).
// Lo comparten la vista y la barra rápida, que crea los recordatorios en ese día.
interface CalendarState {
  /** "2026-09-26" o null para hoy. */
  selectedDay: string | null;
  setSelectedDay: (day: string | null) => void;
}

export const useCalendarStore = create<CalendarState>((set) => ({
  selectedDay: null,
  setSelectedDay: (selectedDay) => set({ selectedDay }),
}));
