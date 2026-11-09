import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { HapticService } from '../../services/HapticService';

export interface MoodEntry {
  date: string;
  score: number;
  label: string;
  factors: string[];
  loggedAt: string;
}

const MOODS = [
  { score: 1, emoji: '😔', label: 'Bajo', color: '#f43f5e', bg: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300' },
  { score: 2, emoji: '😕', label: 'Regular', color: '#f97316', bg: 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300' },
  { score: 3, emoji: '😐', label: 'Neutral', color: '#10b981', bg: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300' },
  { score: 4, emoji: '😊', label: 'Bien', color: '#38bdf8', bg: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300' },
  { score: 5, emoji: '😄', label: 'Óptimo', color: '#8b5cf6', bg: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300' },
];

const FACTORS = [
  'Trabajo', 'Sueño', 'Ejercicio', 'Nutrición',
  'Familia', 'Dinero', 'Social', 'Salud'
];

export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function loadMoodEntries(): Record<string, MoodEntry> {
  try {
    const raw = localStorage.getItem('recordatorios_mood_entries');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMoodEntry(entry: MoodEntry): void {
  try {
    const all = loadMoodEntries();
    all[entry.date] = entry;
    localStorage.setItem('recordatorios_mood_entries', JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('mood-entry-saved', { detail: entry }));
  } catch {
    // storage not available
  }
}

interface MoodCheckinProps {
  onSaved?: (entry: MoodEntry) => void;
  compact?: boolean;
}

export const MoodCheckin: React.FC<MoodCheckinProps> = ({ onSaved, compact = false }) => {
  const todayKey = getTodayKey();
  const [selectedScore, setSelectedScore] = useState<number>(0);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const all = loadMoodEntries();
    const existing = all[todayKey];
    if (existing) {
      setSelectedScore(existing.score);
      setSelectedFactors(existing.factors || []);
      setIsSaved(true);
    }
  }, [todayKey]);

  const handleSelectMood = useCallback((score: number) => {
    HapticService.selection();
    setSelectedScore(score);
    const moodObj = MOODS.find((m) => m.score === score);
    const entry: MoodEntry = {
      date: todayKey,
      score,
      label: moodObj?.label || 'Neutral',
      factors: selectedFactors,
      loggedAt: new Date().toISOString(),
    };
    saveMoodEntry(entry);
    setIsSaved(true);
    onSaved?.(entry);
  }, [todayKey, selectedFactors, onSaved]);

  const toggleFactor = useCallback((factor: string) => {
    HapticService.selection();
    setSelectedFactors((prev) => {
      const next = prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor];
      if (selectedScore > 0) {
        const moodObj = MOODS.find((m) => m.score === selectedScore);
        const entry: MoodEntry = {
          date: todayKey,
          score: selectedScore,
          label: moodObj?.label || 'Neutral',
          factors: next,
          loggedAt: new Date().toISOString(),
        };
        saveMoodEntry(entry);
        onSaved?.(entry);
      }
      return next;
    });
  }, [todayKey, selectedScore, onSaved]);

  return (
    <div className={`w-full rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xs ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            ¿Cómo te sientes hoy?
          </span>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="w-3 h-3 stroke-[2.5]" /> Registrado
          </span>
        )}
      </div>

      {/* Mood Selector Buttons */}
      <div className="grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => {
          const isSelected = selectedScore === m.score;
          return (
            <motion.button
              key={m.score}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => handleSelectMood(m.score)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all ${
                isSelected
                  ? `${m.bg} shadow-xs scale-105 font-bold`
                  : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              <span className="text-xl sm:text-2xl select-none">{m.emoji}</span>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                {m.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Impact Factors (shown if a mood is chosen) */}
      <AnimatePresence>
        {selectedScore > 0 && !compact && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pt-1"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              ¿Qué influyó hoy?
            </span>
            <div className="flex flex-wrap gap-1">
              {FACTORS.map((f) => {
                const isSelected = selectedFactors.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFactor(f)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
