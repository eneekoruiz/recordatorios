/**
 * Task deduplication utilities.
 * Provides helpers to detect duplicate or near-duplicate tasks before insertion.
 */

import type { TaskItem } from '../models/Task';

/**
 * Normalizes a task title for fuzzy comparison:
 * - Lowercases
 * - Strips price-like patterns (e.g. "100€", "$50", "25 eur")
 * - Collapses extra whitespace
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\d,.]+\s*(€|\$|eur|usd|gbp|£)\s*/gi, '') // strip prices
    .replace(/[€$£]/g, '') // strip currency symbols
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true if newTitle is considered a duplicate of an existing task title.
 * Uses exact match after normalization.
 */
function isTitleDuplicate(newNorm: string, existingNorm: string): boolean {
  return newNorm.length > 0 && newNorm === existingNorm;
}

/**
 * Checks whether a candidate task would be a duplicate of any existing task.
 *
 * Duplicate conditions (ALL must match):
 *   1. Same normalized title
 *   2. Same `categoryId` (list)
 *   3. Same `sectionId` (may both be undefined/null)
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
    if (taskSec !== candSec) continue;

    return task;
  }
  return null;
}
