export interface BodyMetricEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number; // kg
  waist?: number | null; // cm
  chest?: number | null; // cm
  arm?: number | null; // cm
  hip?: number | null; // cm
  thigh?: number | null; // cm
  bodyFat?: number | null; // %
  muscleMass?: number | null; // kg
  notes?: string | null;
  createdAt: string;
}

export type BodyMetricField = 'weight' | 'waist' | 'chest' | 'arm' | 'hip' | 'thigh' | 'bodyFat' | 'muscleMass';

export const METRIC_FIELDS: { key: BodyMetricField; label: string; unit: string; icon: string }[] = [
  { key: 'weight', label: 'Peso', unit: 'kg', icon: '⚖️' },
  { key: 'waist', label: 'Cintura', unit: 'cm', icon: '📏' },
  { key: 'chest', label: 'Pecho', unit: 'cm', icon: '📐' },
  { key: 'arm', label: 'Brazo', unit: 'cm', icon: '💪' },
  { key: 'hip', label: 'Cadera', unit: 'cm', icon: '👖' },
  { key: 'thigh', label: 'Muslo', unit: 'cm', icon: '🦵' },
  { key: 'bodyFat', label: 'Grasa', unit: '%', icon: '💧' },
  { key: 'muscleMass', label: 'Masa Muscular', unit: 'kg', icon: '⚡' },
];

const STORAGE_KEY = 'recordatorios_body_metrics';

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadBodyMetrics(): BodyMetricEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.date.localeCompare(a.date));
    }
    return [];
  } catch {
    return [];
  }
}

export function saveBodyMetric(entry: Omit<BodyMetricEntry, 'id' | 'createdAt'> & { id?: string }): BodyMetricEntry[] {
  const existing = loadBodyMetrics();
  const id = entry.id || `body_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullEntry: BodyMetricEntry = {
    ...entry,
    id,
    createdAt: new Date().toISOString(),
  };

  const filtered = existing.filter((m) => m.id !== id && m.date !== entry.date);
  const updated = [fullEntry, ...filtered].sort((a, b) => b.date.localeCompare(a.date));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  return updated;
}

export function deleteBodyMetric(id: string): BodyMetricEntry[] {
  const existing = loadBodyMetrics();
  const updated = existing.filter((m) => m.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
  return updated;
}
