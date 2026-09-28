import React from 'react';

interface AppLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Official Apple Reminders Squircle Icon (matching /favicon.svg)
 * Features the signature squircle, 3 colored reminder dots (orange, blue, red) and grey rounded text lines.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 26, className, style }) => {
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
        <linearGradient id="appLogoBgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#F7F7F8" />
        </linearGradient>
        <linearGradient id="appLogoOrangeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF9F0A" />
          <stop offset="100%" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id="appLogoBlueGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0062D2" />
        </linearGradient>
        <linearGradient id="appLogoRedGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF453A" />
          <stop offset="100%" stopColor="#D7261E" />
        </linearGradient>
        <filter id="appLogoSubtleShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* Background Squircle */}
      <rect width="512" height="512" rx="114" fill="url(#appLogoBgGrad)" />
      <rect width="512" height="512" rx="114" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2" />

      {/* Row 1: Orange Reminder */}
      <circle cx="144" cy="160" r="26" fill="url(#appLogoOrangeGrad)" filter="url(#appLogoSubtleShadow)" />
      <rect x="196" y="147" width="200" height="26" rx="13" fill="#D1D1D6" />

      {/* Row 2: Blue Reminder */}
      <circle cx="144" cy="256" r="26" fill="url(#appLogoBlueGrad)" filter="url(#appLogoSubtleShadow)" />
      <rect x="196" y="243" width="160" height="26" rx="13" fill="#D1D1D6" />

      {/* Row 3: Red Reminder */}
      <circle cx="144" cy="352" r="26" fill="url(#appLogoRedGrad)" filter="url(#appLogoSubtleShadow)" />
      <rect x="196" y="339" width="120" height="26" rx="13" fill="#D1D1D6" />
    </svg>
  );
};
