import { create } from 'zustand';

export type ViewType = 'HOME' | 'UNIVERSAL_IMPORTER' | 'ANALYTICS';

export interface RoutineAnalyticsFocus {
  frequency: 'day' | 'week' | 'month' | 'year';
  reference: string;
  groupId: string;
}

interface NavigationState {
  routineAnalyticsFocus: RoutineAnalyticsFocus | null;
  setRoutineAnalyticsFocus: (focus: RoutineAnalyticsFocus | null) => void;
  stack: ViewType[];
  push: (view: ViewType) => void;
  pop: () => void;
  reset: (view: ViewType) => void;
  currentView: () => ViewType;
}

export const useNavigation = create<NavigationState>((set, get) => ({
  routineAnalyticsFocus: null,
  setRoutineAnalyticsFocus: (routineAnalyticsFocus) => set({ routineAnalyticsFocus }),
  stack: ['HOME'],
  push: (view) => set((state) => ({ stack: [...state.stack, view] })),
  pop: () => set((state) => {
    if (state.stack.length > 1) {
      return { stack: state.stack.slice(0, -1) };
    }
    const current = state.stack[state.stack.length - 1];
    if (current !== 'HOME') {
      return { stack: ['HOME'] };
    }
    return state;
  }),
  reset: (view) => set({ stack: [view] }),
  currentView: () => {
    const stack = get().stack;
    return stack[stack.length - 1];
  }
}));
