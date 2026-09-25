/**
 * Task deduplication utilities.
 * Provides helpers to detect and eliminate duplicate or near-duplicate tasks
 * across insertion, state hydration, and UI rendering.
 */

import type { TaskItem } from '../models/Task';

/**
 * Normalizes a task title for robust comparison:
 * - Lowercases and trims
 * - Strips cyclic tags (e.g. "[D]", "[S]", "[M]", "[A]")
 * - Strips price-like patterns (e.g. "100€", "$50", "25 eur")
 * - Strips currency symbols
 * - Strips leading punctuation and exclamation marks (e.g. "!", "!!", "!!!", "*")
 * - Strips trailing punctuation (e.g. ".", ",", ";", ":", "!", "?")
 * - Collapses extra whitespace
 */
export function normalizeTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^\[[dsma]\]\s*/i, '') // strip cyclic tag [D], [S], etc.
    .replace(/^[!*#•\-\s]+/, '') // strip leading bullet/exclamation marks
    .replace(/(?:[$€£]\s*[\d,.]+|[\d,.]+\s*(?:€|\$|eur|usd|gbp|£))/gi, '') // strip prices (prefix or postfix currency)
    .replace(/[€$£]/g, '') // strip any leftover currency symbols
    .replace(/[.,;:!?\s]+$/, '') // strip trailing punctuation (. ! ? etc.)
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Computes a semantic signature for near-duplicate comparison:
 * - Normalizes accents (á -> a, etc.)
 * - Strips Spanish articles and common filler particles (el, la, los, las, un, una, de, del, al)
 * - Sorts words alphabetically so word-order variations match ("banda facial reafirmante" vs "banda reafirmante facial")
 */
export function semanticKey(title?: string | null): string {
  const norm = normalizeTitle(title);
  if (!norm) return '';
  const withoutAccents = norm
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const tokens = withoutAccents
    .split(/\s+/)
    .filter(w => !['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'y', 'o', 'por', 'para'].includes(w));
  return tokens.sort().join(' ');
}

/**
 * Checks if two titles are semantic duplicates or near-duplicates.
 */
export function isSemanticDuplicate(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (normA === normB) return true;

  const keyA = semanticKey(titleA);
  const keyB = semanticKey(titleB);
  if (keyA && keyB && keyA === keyB) return true;

  // Substring containment for near-duplicate variants (e.g. "Lavar rostro" in "Lavar el rostro")
  if (keyA.length >= 8 && keyB.length >= 8) {
    if (keyA.includes(keyB) || keyB.includes(keyA)) return true;
  }

  return false;
}

/**
 * Known cross-frequency or redundant cleaning/care tasks.
 * If higher frequency covers it, lower frequency task should be pruned.
 */
const RAW_REDUNDANT_TITLES = [
  // Limpieza: Aspirar is daily ("Aspirar la casa"), not repeated in mensual or anual duplicates
  'pasar aspiradora detras de muebles accesibles',
  'aspirar detras de muebles grandes',
  // Limpieza: Zócalos / ventanas duplicates in anual
  'limpiar zocalos y esquinas escondidas',
  'limpiar marcos y rieles de ventanas',
  'revisar utensilios y tirar los rotos o duplicados',
  'revisar y tirar cajas o aparatos antiguos',
  // Limpieza: Anti-humedades duplicate in semanal (belongs in mensual)
  'vaciar los anti-humedades si corresponde',
  // Limpieza: Papeleras (covered by daily "Vaciar papeleras si están llenas")
  'vaciar papeleras pequenas',
  // Limpieza: Tiradores (covered by weekly "Pasar trapo por tiradores y frentes accesibles")
  'pasar un pano por armarios y tiradores',
  // Limpieza: Balcón (covered by weekly)
  'limpiar barandilla y muebles a fondo',
  // Limpieza: Cortinas / mantas in mensual (covered by anual deep wash)
  'cada 3 meses las cortinas',
  'mantas y edredon de la cama',

  // Care duplicates
  'aplicar crema hidratante',
  'aplicar protector solar',
  'banda reafirmante facial',
  'desodorante',
  'lavar rostro',
  'piedra de alumbre',
  'poner morritos hacia la izquierda derecha izquierda derecha para hacer pomulos',
  'aplicar mascarilla facial casera',

  // Quehaceres duplicates
  'mirarse en el espejo',
  'hacer cama',
  'limpiar dientes',
  'duchar',
  'airpods',
  'auriculares inalambricos',
  'cascos',

  // Compras duplicates
  'nike tkno',
  'el oro verde, sobre todo incluido el mechero que se abre por abajo para meter la droga'
];

export const KNOWN_REDUNDANT_TITLES = new Set<string>();
for (const raw of RAW_REDUNDANT_TITLES) {
  const norm = normalizeTitle(raw).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm) KNOWN_REDUNDANT_TITLES.add(norm);
}

/**
 * Checks if a task title matches known redundant list items.
 */
export function isKnownRedundantTask(title?: string | null): boolean {
  if (!title) return false;
  const norm = normalizeTitle(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return KNOWN_REDUNDANT_TITLES.has(norm);
}

/**
 * Checks if two section IDs are equivalent, taking into account
 * legacy alias naming conventions (e.g. sec_limpieza_ vs sec_limp_, plural vs singular).
 */
export function areSectionsEquivalent(secA?: string | null, secB?: string | null): boolean {
  if (!secA && !secB) return true;
  if (!secA || !secB) return false;
  if (secA === secB) return true;

  const normalizeSec = (s: string) => s
    .replace(/^sec_limpieza_/, 'sec_limp_')
    .replace(/_diarias$/, '_diaria')
    .replace(/_semanales$/, '_semanal')
    .replace(/_mensuales$/, '_mensual')
    .replace(/_anuales$/, '_anual');

  return normalizeSec(secA) === normalizeSec(secB);
}

/**
 * Returns true if newTitle is considered a duplicate of an existing task title.
 * Uses semantic match after normalization.
 */
function isTitleDuplicate(newNorm: string, existingNorm: string): boolean {
  return isSemanticDuplicate(newNorm, existingNorm);
}

/**
 * Checks whether a candidate task would be a duplicate of any existing task.
 *
 * Duplicate conditions (ALL must match):
 *   1. Same normalized title (case-insensitive, trailing dot/punctuation stripped)
 *   2. Same `categoryId` (list)
 *   3. Same or equivalent `sectionId` (may both be undefined/null)
 *   4. Not soft-deleted
 *
 * @returns The existing duplicate task if found, or null.
 */
export function findDuplicateTask(
  candidate: Partial<TaskItem>,
  existingTasks: Record<string, TaskItem>
): TaskItem | null {
  const candTitle = normalizeTitle(candidate.title || '');
  if (!candTitle) return null;

  const candCat = candidate.categoryId || (candidate as any).category_id || null;
  const candSec = candidate.sectionId || (candidate as any).section_id || null;

  for (const task of Object.values(existingTasks)) {
    if (task.deleted_at) continue;
    const taskNorm = normalizeTitle(task.title || '');
    if (!isTitleDuplicate(candTitle, taskNorm)) continue;

    const taskCat = task.categoryId || (task as any).category_id || null;
    const taskSec = task.sectionId || (task as any).section_id || null;

    if (taskCat !== candCat) continue;
    if (!areSectionsEquivalent(candSec, taskSec)) continue;

    return task;
  }
  return null;
}

/**
 * Deduplicates an array of tasks for rendering or state consolidation.
 * If multiple active tasks share the same normalized title within the same section/scope:
 * - Selects the best candidate (prefers pending over completed, higher version, newer updated_at).
 * - Drops duplicate copies, guaranteeing the user never sees repeated tasks.
 */
export function deduplicateTaskList(tasks: TaskItem[]): TaskItem[] {
  if (!tasks || tasks.length <= 1) return tasks || [];

  const groups = new Map<string, TaskItem[]>();
  const order: string[] = [];

  for (const t of tasks) {
    if (!t) continue;
    const norm = normalizeTitle(t.title);
    const key = norm || t.id;

    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(t);
  }

  const result: TaskItem[] = [];

  for (const key of order) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Select the best candidate among duplicates:
    // 1. Pending tasks first
    // 2. Higher version
    // 3. Most recently updated
    const sorted = [...group].sort((a, b) => {
      const aDone = a.status === 'completed' || (a as any).completed;
      const bDone = b.status === 'completed' || (b as any).completed;
      if (!aDone && bDone) return -1;
      if (aDone && !bDone) return 1;

      const vA = a.version || 1;
      const vB = b.version || 1;
      if (vA !== vB) return vB - vA;

      const tA = new Date(a.updated_at || a.created_at || 0).getTime();
      const tB = new Date(b.updated_at || b.created_at || 0).getTime();
      return tB - tA;
    });

    result.push(sorted[0]);
  }

  return result;
}
