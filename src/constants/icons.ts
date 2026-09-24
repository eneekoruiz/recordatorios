import {
  Sun, Calendar, Moon, Globe, Rocket, Flame, Sparkles, Star, Circle,
  ShoppingCart, Briefcase, Heart, Book, BookOpen, Coffee, CheckSquare, Plane, Music, Video, Zap, Home,
  Gamepad2, Dumbbell, Palette, GraduationCap, Code, Scissors, Camera, Utensils, Droplets, Trophy, Car, Bike,
  Train, Ticket, Glasses, Headphones, Watch, Shield, Key, Lock, Bell, Folder, FolderOpen, CreditCard, Inbox,
  List, Gift, PawPrint, Leaf, Stethoscope, Wallet, Baby, Wrench,
} from 'lucide-react';
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

/** Iconos seleccionables para listas (claves = lo que se guarda en `list.icon`). */
export const LIST_ICON_MAP: Record<string, ComponentType<any>> = {
  list: CheckSquare, folder: Folder, 'folder-open': FolderOpen, cart: ShoppingCart, briefcase: Briefcase,
  heart: Heart, book: Book, coffee: Coffee, plane: Plane, music: Music, video: Video, zap: Zap, home: Home,
  gamepad: Gamepad2, dumbbell: Dumbbell, palette: Palette, cap: GraduationCap, code: Code, scissors: Scissors,
  camera: Camera, food: Utensils, water: Droplets, fire: Flame, sun: Sun, moon: Moon, star: Star, trophy: Trophy,
  car: Car, bike: Bike, train: Train, ticket: Ticket, glasses: Glasses, headphones: Headphones, watch: Watch,
  shield: Shield, key: Key, lock: Lock, bell: Bell, card: CreditCard, gift: Gift, pet: PawPrint, leaf: Leaf,
  health: Stethoscope, wallet: Wallet, baby: Baby, tools: Wrench, rocket: Rocket, sparkles: Sparkles,
};

// Alias de nombres usados históricamente (kebab-case de Lucide, PascalCase de importaciones...).
const ICON_ALIASES: Record<string, string> = {
  shoppingcart: 'cart', checksquare: 'list', creditcard: 'card', bookopen: 'book', graduationcap: 'cap',
  utensils: 'food', droplets: 'water', flame: 'fire', gamepad2: 'gamepad', inbox: 'inbox', listchecks: 'list',
};

const normalize = (name?: string | null) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function getListIcon(iconName?: string | null): ComponentType<any> {
  if (!iconName) return List;
  if (LIST_ICON_MAP[iconName]) return LIST_ICON_MAP[iconName];
  const key = normalize(iconName);
  if (key === 'inbox') return Inbox;
  if (key === 'bookopen') return BookOpen;
  const alias = ICON_ALIASES[key];
  if (alias && LIST_ICON_MAP[alias]) return LIST_ICON_MAP[alias];
  const direct = Object.keys(LIST_ICON_MAP).find((k) => normalize(k) === key);
  return direct ? LIST_ICON_MAP[direct] : List;
}
