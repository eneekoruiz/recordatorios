import { StrictMode } from 'react'
import { MotionConfig } from 'framer-motion'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import './styles/polish.css'

import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// En iOS, maximum-scale evita el zoom automático al enfocar un campo y el
// usuario conserva el zoom con los dedos. En Android bloquearía el zoom, así que solo se aplica en iOS.
if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Respeta «Reducir movimiento» del sistema en todas las animaciones */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
