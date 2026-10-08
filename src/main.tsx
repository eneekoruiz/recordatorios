import { StrictMode } from 'react'
import { MotionConfig } from 'framer-motion'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import './styles/polish.css'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { PersistenceStatusBanner } from './components/ui/PersistenceStatusBanner.tsx'

// Sin maximum-scale: bloquear el zoom incumple WCAG 1.4.4. iOS solo amplía al enfocar campos con fuente < 16 px, y
// los campos ya usan 16 px en móvil (lo comprueba tests/mobile.spec.ts).

// Auto-recuperación de chunks desactualizados tras un despliegue en Vercel o PWA
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Preload error detected. Reloading page to fetch updated chunks...', event);
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistenceStatusBanner />
    <ErrorBoundary>
      {/* Respeta «Reducir movimiento» del sistema en todas las animaciones */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
