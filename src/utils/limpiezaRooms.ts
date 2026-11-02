import type { ListSection } from '../models/Task';
import type { PeriodicityType } from './sectionRoutine';

/**
 * Estancias de Limpieza («Para empezar», «Cocina»… «Para terminar») bajo cada frecuencia.
 *
 * Las cabeceras de estancia se pintan aunque la sección no exista guardada (la estancia se deduce
 * del título). Para que soltar una tarea sobre una de ellas la lleve a esa estancia, cada cabecera
 * apunta a la sección real o, si no existe, al identificador canónico (`sec_limp_semanal_cocina`),
 * que es el mismo esquema que crea `ensureLimpiezaSections` y que ya llevan las tareas. Ese
 * identificador conserva la frecuencia («semanal» → semanal) y la estancia.
 */
const ROOM_SLUG: Record<string, string> = {
  para_empezar: 'para_empezar', cocina: 'cocina', bano: 'bano', habitacion: 'hab',
  pasillo: 'pasillo', balcon: 'balcon', para_terminar: 'para_terminar', general: 'general',
};
const ROOM_NAME: Record<string, string> = {
  para_empezar: 'Para empezar', cocina: 'Cocina', bano: 'Baño', habitacion: 'Habitación',
  pasillo: 'Pasillo / Entrada', balcon: 'Balcón', para_terminar: 'Para terminar', general: 'General',
};
const FREQ_WORD: Record<PeriodicityType, string> = { day: 'diaria', week: 'semanal', month: 'mensual', year: 'anual' };
const FREQ_ROOT_WORD: Record<PeriodicityType, string> = { day: 'diari', week: 'seman', month: 'mensu', year: 'anual' };

/** Cabecera de estancia en la vista continua (sin frecuencia): se resuelve con la de cada tarea. */
export const ROOM_ANY_FREQUENCY_PREFIX = 'sec_limp_room_';

const normalize = (text: string) => (text || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Estancia de una sección (por su nombre o su identificador), o null si no es una estancia. */
export function roomKeyOf(nameOrId: string): string | null {
  const norm = normalize(nameOrId);
  if (!norm) return null;
  if (norm.startsWith(ROOM_ANY_FREQUENCY_PREFIX)) return norm.slice(ROOM_ANY_FREQUENCY_PREFIX.length) || null;
  if (norm.includes('empezar') || norm.includes('start')) return 'para_empezar';
  if (norm.includes('terminar') || norm.includes('acabar')) return 'para_terminar';
  if (norm.includes('cocin')) return 'cocina';
  if (norm.includes('bano') || norm.includes('duch') || norm.includes('aseo')) return 'bano';
  if (norm.includes('habitaci') || norm.includes('dormitori') || /(^|_)hab$/.test(norm)) return 'habitacion';
  if (norm.includes('pasill') || norm.includes('entrad') || norm.includes('recibid')) return 'pasillo';
  if (norm.includes('balcon') || norm.includes('terraz')) return 'balcon';
  return null;
}

/** Sección de una estancia bajo una frecuencia: la guardada si existe; si no, la canónica. */
export function roomSectionId(
  periodicity: PeriodicityType,
  roomKey: string,
  sections: ListSection[],
  listId: string
): string {
  const slug = ROOM_SLUG[roomKey] || roomKey;
  const candidates = [`sec_limp_${FREQ_WORD[periodicity]}_${slug}`, `sec_limp_${periodicity}_${roomKey}`, `sec_limpieza_${periodicity}_${roomKey}`];
  const live = sections.filter(s => s.listId === listId && !s.deleted_at);
  const byId = live.find(s => candidates.includes(s.id));
  if (byId) return byId.id;
  const root = live.find(s => !s.parentId && normalize(s.name).includes(FREQ_ROOT_WORD[periodicity]));
  const byName = root && live.find(s => s.parentId === root.id && roomKeyOf(s.name) === roomKey);
  return byName?.id || candidates[0];
}

export const roomDisplayName = (roomKey: string) => ROOM_NAME[roomKey] || roomKey;
