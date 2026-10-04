import { useEffect } from 'react';

export function useGlobalShortcuts(
  setIsShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setIsDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>,
  setEditingTaskId: React.Dispatch<React.SetStateAction<string | null>>,
  setDefaultSectionId: React.Dispatch<React.SetStateAction<string | undefined>>,
  handleSelectView: (view: string) => void
) {
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape closes open modals, drawer, shortcuts and menus
      if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsDrawerOpen(false);
        window.dispatchEvent(new Event('close-list-menus'));
        return;
      }

      // Cmd+N or Ctrl+N opens new task drawer from anywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTaskId(null);
        setDefaultSectionId(undefined);
        setIsDrawerOpen(true);
        return;
      }

      // Cmd+K or Ctrl+K opens Spotlight
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('open-command-palette'));
        return;
      }

      const active = document.activeElement;
      const isInputActive = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.getAttribute('contenteditable') === 'true');
      if (isInputActive) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new Event('open-command-palette'));
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTaskId(null);
        setDefaultSectionId(undefined);
        setIsDrawerOpen(true);
        return;
      }
      if (e.key === '1') { e.preventDefault(); handleSelectView('cycle_day'); }
      else if (e.key === '2') { e.preventDefault(); handleSelectView('cycle_week'); }
      else if (e.key === '3') { e.preventDefault(); handleSelectView('all'); }
      else if (e.key === '4') { e.preventDefault(); handleSelectView('inbox'); }
      else if (e.key === '5') { e.preventDefault(); handleSelectView('ANALYTICS'); }
      else if (e.key === '6') { e.preventDefault(); handleSelectView('DATA'); }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
