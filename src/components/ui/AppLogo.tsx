import React, { useId } from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Logo de la app (igual que /favicon.svg): lista de tareas con la primera completada, sobre degradado índigo-azul.
 * Los ids de los gradientes llevan un sufijo único para que varias instancias no choquen en el DOM.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 26, className, style }) => {
  const uid = useId().replace(/:/g, '');
  const id = (name: string) => `${name}-${uid}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      style={{
        borderRadius: Math.round(size * 0.22),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
        flexShrink: 0,
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style
      }}
      aria-label="Logo Recordatorios"
    >
      <defs>
        <linearGradient id={id('appLogoBg')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6E6BF2" />
          <stop offset="100%" stopColor="#0A84FF" />
        </linearGradient>
        <filter id={id('appLogoSoft')} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0B2A6B" floodOpacity="0.28" />
        </filter>
      </defs>

      <rect width="512" height="512" rx="114" fill={`url(#${id('appLogoBg')})`} />
      <g filter={`url(#${id('appLogoSoft')})`}>
        <circle cx="140" cy="164" r="34" fill="#FFFFFF" />
        <path d="M124 165 l11 11 l21 -23" fill="none" stroke="#3F7CF6" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="204" y="148" width="212" height="32" rx="16" fill="#FFFFFF" />
        <circle cx="140" cy="256" r="30" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="9" />
        <rect x="204" y="240" width="164" height="32" rx="16" fill="#FFFFFF" fillOpacity="0.78" />
        <circle cx="140" cy="348" r="30" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="9" />
        <rect x="204" y="332" width="112" height="32" rx="16" fill="#FFFFFF" fillOpacity="0.6" />
      </g>
    </svg>
  );
};
