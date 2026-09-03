import React from 'react';
import { Calendar, Inbox, Flag, CheckCircle, Rocket } from 'lucide-react';

export function TodayIcon({ size = 18 }: { size?: number; color?: string }) {
  const day = new Date().getDate();
  return React.createElement(
    'span',
    {
      style: {
        fontWeight: 800,
        fontSize: size >= 20 ? '15px' : '12px',
        fontFamily: 'inherit',
        lineHeight: 1,
        color: 'white',
        letterSpacing: '-0.5px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }
    },
    day
  );
}

export const SMART_LISTS = [
  { id: 'smart_primeros_pasos', name: 'Primeros Pasos', icon: Rocket, color: '#ff2d55' },
  { id: 'smart_today', name: 'Hoy', icon: TodayIcon, color: '#007aff' },
  { id: 'smart_scheduled', name: 'Programados', icon: Calendar, color: '#ff3b30' },
  { id: 'smart_all', name: 'Todos', icon: Inbox, color: '#48484a' },
  { id: 'smart_flagged', name: 'Con marca', icon: Flag, color: '#ff9500' },
  { id: 'smart_completed', name: 'Completados', icon: CheckCircle, color: '#8e8e93' },
  { id: 'smart_overdue', name: 'Vencidos', icon: Calendar, color: '#ff3b30' }
];
