import React, { useState } from 'react';
import { AppLogo } from './AppLogo';

// Opacidades de los radios del indicador: el más intenso encabeza el giro horario.
const SPOKE_OPACITIES = [1, 0.86, 0.72, 0.58, 0.44, 0.3, 0.22, 0.16];

/**
 * Pantalla de arranque mientras se hidrata el almacén.
 * Replica la de index.html (mismas clases, cuyos estilos viven allí) para que el
 * relevo HTML → React no se note: los retrasos se descuentan del tiempo ya
 * transcurrido desde la navegación, así el logo no vuelve a aparecer con fundido
 * y el indicador sigue saliendo a los 1,5 s de abrir la app, no al montar React.
 */
export const LaunchScreen: React.FC = () => {
  const [elapsed] = useState(() => Math.round(performance.now()));
  return (
    <div className="launch-screen" role="status" aria-label="Cargando">
      <AppLogo
        size={88}
        className="launch-logo"
        style={{ borderRadius: 20, boxShadow: 'none', animationDelay: `-${elapsed}ms` }}
      />
      <div className="launch-activity" aria-hidden="true" style={{ animationDelay: `${1500 - elapsed}ms` }}>
        <svg viewBox="0 0 20 20">
          {SPOKE_OPACITIES.map((opacity, i) => (
            <rect
              key={i}
              x="9" y="1" width="2" height="5.5" rx="1"
              fill="currentColor"
              opacity={opacity}
              transform={`rotate(${-i * 45} 10 10)`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};
