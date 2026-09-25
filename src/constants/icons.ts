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

/**
 * Sugerencia inteligente de icono y color al estilo Apple Reminders basado en el nombre de la lista.
 */
export function getSuggestedListIconAndColor(name?: string): { icon: string; color: string } | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();

  if (/compr|super|mercad|tienda|grocer|alcampo|lidl|carrefour/i.test(n)) {
    return { icon: 'cart', color: '#ff9500' };
  }
  if (/trabaj|oficin|labor|emple|curro|reuni|meet|proyect|work/i.test(n)) {
    return { icon: 'briefcase', color: '#0a84ff' };
  }
  if (/casa|hogar|piso|habitaci|apartament|dormitor|sal[oó]n/i.test(n)) {
    return { icon: 'home', color: '#30b0c7' };
  }
  if (/limpiez|orden|colad|lavador|aspir|freg|quehacer/i.test(n)) {
    return { icon: 'sparkles', color: '#5856d6' };
  }
  if (/estudi|universi|carrer|master|clase|examen|oposici|coleg|escuel|estudio/i.test(n)) {
    return { icon: 'cap', color: '#af52de' };
  }
  if (/viaj|vacacion|escapad|vuel|hotel|turism|malet|trip/i.test(n)) {
    return { icon: 'plane', color: '#00c7be' };
  }
  if (/gym|gimnasi|entren|fit|deport|pesa|crossfit|corr|run|ejercici/i.test(n)) {
    return { icon: 'dumbbell', color: '#ff2d55' };
  }
  if (/finanz|diner|gast|pag|banc|factur|ahorr|inversi|econom|bille/i.test(n)) {
    return { icon: 'wallet', color: '#34c759' };
  }
  if (/salud|m[eé]dic|doctor|farmac|hospital|medicament|saludable|bienestar/i.test(n)) {
    return { icon: 'health', color: '#ff3b30' };
  }
  if (/comid|recet|cocin|cen|men[uú]|diet|almuerz|desayun/i.test(n)) {
    return { icon: 'food', color: '#ff9500' };
  }
  if (/m[uú]sic|canci|guitar|piano|concert|band/i.test(n)) {
    return { icon: 'music', color: '#ff2d55' };
  }
  if (/libr|lectur|leer|novela|bibliotec|book/i.test(n)) {
    return { icon: 'book', color: '#a2845e' };
  }
  if (/pel[ií]cul|serie|cine|netflix|film|ver/i.test(n)) {
    return { icon: 'video', color: '#af52de' };
  }
  if (/coch|auto|coche|moto|taller|gasolin|itv|veh[ií]cul/i.test(n)) {
    return { icon: 'car', color: '#0a84ff' };
  }
  if (/bici|biciclet|ciclism/i.test(n)) {
    return { icon: 'bike', color: '#34c759' };
  }
  if (/mascot|perr|gat|veterinari|animal|dog|cat/i.test(n)) {
    return { icon: 'pet', color: '#a2845e' };
  }
  if (/regal|cumple|navidad|fiest|aniversari|gift/i.test(n)) {
    return { icon: 'gift', color: '#ff2d55' };
  }
  if (/jueg|game|gaming|videojueg|play|xbox|steam/i.test(n)) {
    return { icon: 'gamepad', color: '#5856d6' };
  }
  if (/idea|creativ|dibuj|arte|dise[nñ]/i.test(n)) {
    return { icon: 'palette', color: '#ff9500' };
  }
  if (/c[oó]dig|dev|program|softwar|app|web|git/i.test(n)) {
    return { icon: 'code', color: '#30b0c7' };
  }
  if (/ropa|moda|zapat|armari|outfit/i.test(n)) {
    return { icon: 'scissors', color: '#af52de' };
  }
  if (/foto|fotograf|c[aá]mar/i.test(n)) {
    return { icon: 'camera', color: '#0a84ff' };
  }
  if (/cuidado|skincare|bellez|peluquer|barber/i.test(n)) {
    return { icon: 'sparkles', color: '#ff2d55' };
  }
  if (/herramient|bricolaj|repar|obra|taller/i.test(n)) {
    return { icon: 'tools', color: '#ff9500' };
  }
  if (/meta|objetiv|prop[oó]sit|resoluci/i.test(n)) {
    return { icon: 'target', color: '#ff3b30' };
  }
  if (/agend|calendari|event|cita/i.test(n)) {
    return { icon: 'calendar', color: '#ff2d55' };
  }
  if (/caduc|vencimient|suscrip/i.test(n)) {
    return { icon: 'card', color: '#ff9500' };
  }
  return null;
}

export function getAutoListIcon(iconName?: string | null, listName?: string): ComponentType<any> {
  if (iconName && iconName !== 'list') {
    return getListIcon(iconName);
  }
  const suggested = getSuggestedListIconAndColor(listName);
  if (suggested) {
    return getListIcon(suggested.icon);
  }
  return getListIcon(iconName);
}

