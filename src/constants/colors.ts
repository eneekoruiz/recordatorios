/**
 * Central color palette definitions for Recordatorios Élite.
 * 
 * Defines strictly reserved colors for frequency cycles (Diario, Semanal, Mensual, Anual)
 * and the curated palette available for regular user lists.
 */

/**
 * Special reserved colors for Frequency Smart Lists / Cycles.
 * These colors are strictly reserved and CANNOT be used by standard lists.
 */
export const FREQUENCY_RESERVED_COLORS = {
  day: '#FF6F00',    // Ámbar Solar Profundo / Deep Radiant Amber ☀️
  week: '#0052FF',   // Azul Cobalto Eléctrico / Electric Royal Blue 📅
  month: '#7928CA',  // Violeta Cósmico / Cosmic Purple 🌙
  year: '#00875A',   // Verde Bosque Esmeralda / Deep Emerald Forest 🌍
} as const;

export const FREQUENCY_COLORS_ARRAY = Object.values(FREQUENCY_RESERVED_COLORS);

/**
 * Checks whether a given hex color matches one of the reserved frequency colors.
 */
export function isReservedFrequencyColor(color?: string | null): boolean {
  if (!color) return false;
  const normalized = color.trim().toLowerCase();
  return FREQUENCY_COLORS_ARRAY.some(c => c.toLowerCase() === normalized) ||
    normalized === '#ff9500' || // legacy day
    normalized === '#007aff' || // legacy week
    normalized === '#af52de' || // legacy month
    normalized === '#34c759';   // legacy year
}

/**
 * Returns the reserved color for a given cycle ID or periodicity.
 */
export function getReservedFrequencyColor(cycleIdOrPeriod?: string | null): string {
  if (!cycleIdOrPeriod) return FREQUENCY_RESERVED_COLORS.day;
  const clean = cycleIdOrPeriod.replace(/^cycle_/, '').toLowerCase();
  if (clean === 'day' || clean === 'diario' || clean === 'diaria') return FREQUENCY_RESERVED_COLORS.day;
  if (clean === 'week' || clean === 'semanal') return FREQUENCY_RESERVED_COLORS.week;
  if (clean === 'month' || clean === 'mensual') return FREQUENCY_RESERVED_COLORS.month;
  if (clean === 'year' || clean === 'anual') return FREQUENCY_RESERVED_COLORS.year;
  return FREQUENCY_RESERVED_COLORS.day;
}

/**
 * Curated palette for regular custom lists.
 * Strictly excludes all reserved frequency colors to prevent any visual confusion.
 */
export const LIST_AVAILABLE_COLORS = [
  // Coral, Berry & Rose
  '#FF375F', '#E63946', '#D81B60', '#FF6584', '#B5838D', '#FFAFCC',
  // Cyan, Ocean & Teal
  '#008080', '#2A9D8F', '#0284C7', '#20B2AA', '#38BDF8', '#457B9D',
  // Gold, Ochre & Peach
  '#FFD60A', '#E9C46A', '#F59E0B', '#F4A261', '#E5989B', '#FFC8DD',
  // Indigo, Lavender & Slate
  '#5E5CE6', '#6366F1', '#4A4E69', '#1D3557', '#CDB4DB', '#6D6875',
  // Earth, Warm Bronze & Neutral
  '#8D6E63', '#A0522D', '#78716C', '#8E8E93', '#64748B', '#264653'
] as const;
