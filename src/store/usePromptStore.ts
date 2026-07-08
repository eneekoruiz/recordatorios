import { create } from 'zustand';

interface PromptState {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  resolve: ((value: string | null) => void) | null;
  openPrompt: (title: string, placeholder?: string) => Promise<string | null>;
  closePrompt: (value: string | null) => void;
}

export const usePromptStore = create<PromptState>((set) => ({
  isOpen: false,
  title: '',
  placeholder: '',
  resolve: null,
  openPrompt: (title, placeholder) => {
    return new Promise((resolve) => {
      set({ isOpen: true, title, placeholder, resolve });
    });
  },
  closePrompt: (value) => {
    set((state) => {
      if (state.resolve) state.resolve(value);
      return { isOpen: false, title: '', placeholder: '', resolve: null };
    });
  }
}));
