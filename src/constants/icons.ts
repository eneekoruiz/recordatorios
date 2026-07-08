import { Sun, Calendar, Moon, Globe, Rocket, Flame, Sparkles, Star, Circle } from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Mapa centralizado de nombres de icono a componentes Lucide.
 * Fuente única de verdad — elimina duplicaciones en Sidebar, MainContent, CycleModal.
 */
export const CYCLE_ICON_MAP: Record<string, ComponentType<any>> = {
  sun: Sun,
  calendar: Calendar,
  moon: Moon,
  globe: Globe,
  rocket: Rocket,
  flame: Flame,
  sparkles: Sparkles,
  star: Star,
  circle: Circle,
};

export const CYCLE_ICON_NAMES = Object.keys(CYCLE_ICON_MAP);

export function getCycleIcon(iconName: string): ComponentType<any> {
  return CYCLE_ICON_MAP[iconName] || Circle;
}
