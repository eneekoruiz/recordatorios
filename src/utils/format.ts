// Utilidades de redacción en español: evitan textos robóticos del tipo "1 tarea(s)".

const UNITS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** "1 tarea" · "3 tareas" */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** "una" · "tres" · "14" — número en palabra hasta diez. */
export function numberWord(count: number): string {
  return count >= 0 && count <= 10 ? UNITS[count] : String(count);
}

/** "una tarea" · "tres tareas" · "14 tareas" (los números pequeños se leen mejor en palabra). */
export function pluralWord(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${numberWord(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Une con comas y una "y" final: "pan, leche y café". */
export function joinNatural(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "Domingo, 20 de septiembre" */
export function formatLongDate(date: Date): string {
  return capitalize(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** "Hoy", "Mañana", "Vie 26" o "26 sept" según la distancia. */
export function formatRelativeDay(date: Date, now = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days > 1 && days < 7) return capitalize(date.toLocaleDateString('es-ES', { weekday: 'long' }));
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** "9:30" en formato local de 24 h, sin ceros innecesarios. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
