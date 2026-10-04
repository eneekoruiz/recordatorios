import { useEffect } from 'react';

export function useAppLayout(setIsMobile: React.Dispatch<React.SetStateAction<boolean>>) {
  // ── Resize / Orientation listener ────────────────────────────────
  useEffect(() => {
    const recalcLayout = () => {
      const isMobileNow = 
        window.innerWidth <= 768 ||
        (window.innerHeight <= 500 && window.innerWidth <= 1024) ||
        (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 900);

      setIsMobile(isMobileNow);

      // Reset window scroll offset to prevent iOS / Android browser bars from shifting headers off-screen
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    recalcLayout(); // Immediate sync on mount
    window.addEventListener('resize', recalcLayout);
    // orientationchange fires before resize completes on some mobile browsers;
    // use multiple short delays so inner dimensions and safe-areas settle.
    const handleOrientation = () => {
      recalcLayout();
      setTimeout(recalcLayout, 50);
      setTimeout(recalcLayout, 150);
      setTimeout(recalcLayout, 300);
    };
    window.addEventListener('orientationchange', handleOrientation);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientation);
    }
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', handleOrientation);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientation);
      }
    };
  }, [setIsMobile]);
}
