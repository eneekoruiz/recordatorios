import { Calendar, Clock, Inbox, Flag, CheckCircle, Rocket } from 'lucide-react';

export const SMART_LISTS = [
  { id: 'smart_primeros_pasos', name: 'Primeros Pasos', icon: Rocket, color: '#ff2d55' },
  { id: 'smart_today', name: 'Hoy', icon: Clock, color: 'var(--accent-blue)' },
  { id: 'smart_scheduled', name: 'Programados', icon: Calendar, color: 'var(--accent-red)' },
  { id: 'smart_all', name: 'Todos', icon: Inbox, color: 'var(--text-secondary)' },
  { id: 'smart_flagged', name: 'Con Bandera', icon: Flag, color: 'var(--accent-orange)' },
  { id: 'smart_completed', name: 'Completados', icon: CheckCircle, color: 'var(--text-tertiary)' },
  { id: 'smart_overdue', name: 'Retrasados', icon: Calendar, color: 'var(--accent-red)' }
];
