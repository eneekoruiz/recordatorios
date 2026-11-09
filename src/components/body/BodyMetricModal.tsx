import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Scale } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import { getTodayDateString, saveBodyMetric, type BodyMetricEntry } from './bodyData';

interface BodyMetricModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (metrics: BodyMetricEntry[]) => void;
  initialData?: BodyMetricEntry | null;
}

export const BodyMetricModal: React.FC<BodyMetricModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialData,
}) => {
  const [date, setDate] = useState(initialData?.date || getTodayDateString());
  const [weight, setWeight] = useState(initialData?.weight ? String(initialData.weight) : '');
  const [waist, setWaist] = useState(initialData?.waist ? String(initialData.waist) : '');
  const [chest, setChest] = useState(initialData?.chest ? String(initialData.chest) : '');
  const [arm, setArm] = useState(initialData?.arm ? String(initialData.arm) : '');
  const [hip, setHip] = useState(initialData?.hip ? String(initialData.hip) : '');
  const [thigh, setThigh] = useState(initialData?.thigh ? String(initialData.thigh) : '');
  const [bodyFat, setBodyFat] = useState(initialData?.bodyFat ? String(initialData.bodyFat) : '');
  const [muscleMass, setMuscleMass] = useState(initialData?.muscleMass ? String(initialData.muscleMass) : '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [showPerimeters, setShowPerimeters] = useState(false);

  if (!isOpen) return null;

  const parseNum = (val: string): number | null => {
    const n = parseFloat(val.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseNum(weight);
    if (!parsedWeight) return;

    HapticService.impact('medium');
    const updated = saveBodyMetric({
      id: initialData?.id,
      date,
      weight: parsedWeight,
      waist: parseNum(waist),
      chest: parseNum(chest),
      arm: parseNum(arm),
      hip: parseNum(hip),
      thigh: parseNum(thigh),
      bodyFat: parseNum(bodyFat),
      muscleMass: parseNum(muscleMass),
      notes: notes.trim() || null,
    });

    onSaved(updated);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {initialData ? 'Editar Medición' : 'Nueva Medición Corporal'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registra peso y perímetros corporales
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              aria-label="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Peso (kg) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="ej. 74.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Grasa Corporal (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="3"
                  max="60"
                  placeholder="ej. 14.8"
                  value={bodyFat}
                  onChange={(e) => setBodyFat(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Masa Muscular (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="10"
                  max="150"
                  placeholder="ej. 34.2"
                  value={muscleMass}
                  onChange={(e) => setMuscleMass(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Toggle perimeters */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowPerimeters(!showPerimeters)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {showPerimeters ? 'Ocultar perímetros (cm)' : '+ Añadir perímetros corporales (cm)'}
              </button>
            </div>

            {showPerimeters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1"
              >
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Cintura (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 81"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Pecho (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 98"
                    value={chest}
                    onChange={(e) => setChest(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Brazo (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 36"
                    value={arm}
                    onChange={(e) => setArm(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Cadera (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 95"
                    value={hip}
                    onChange={(e) => setHip(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Muslo (cm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 57"
                    value={thigh}
                    onChange={(e) => setThigh(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </motion.div>
            )}

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Notas / Contexto
              </label>
              <textarea
                rows={2}
                placeholder="Sensaciones, retención, ciclo, hora de pesaje..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!parseNum(weight)}
                className="flex-1 h-12 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-40 transition"
              >
                <Check className="w-4 h-4" />
                Guardar Métrica
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
