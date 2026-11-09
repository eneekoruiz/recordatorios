import React, { useState, useEffect, useMemo } from 'react';
import { Scale, Plus, TrendingDown, TrendingUp, Minus, Trash2, Edit2, Activity } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import {
  type BodyMetricEntry,
  type BodyMetricField,
  METRIC_FIELDS,
  loadBodyMetrics,
  deleteBodyMetric,
} from './bodyData';
import { BodyMetricModal } from './BodyMetricModal';

export const BodyEvolution: React.FC = () => {
  const [metrics, setMetrics] = useState<BodyMetricEntry[]>([]);
  const [selectedField, setSelectedField] = useState<BodyMetricField>('weight');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BodyMetricEntry | null>(null);

  useEffect(() => {
    setMetrics(loadBodyMetrics());
  }, []);

  const sortedChronological = useMemo(() => {
    return [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  const latest = metrics[0] || null;
  const previous = metrics[1] || null;

  const currentFieldMeta = useMemo(() => {
    return METRIC_FIELDS.find((f) => f.key === selectedField) || METRIC_FIELDS[0];
  }, [selectedField]);

  // Delta calculation for current field
  const delta = useMemo(() => {
    if (!latest || !previous) return null;
    const currVal = latest[selectedField];
    const prevVal = previous[selectedField];
    if (typeof currVal === 'number' && typeof prevVal === 'number') {
      const diff = currVal - prevVal;
      return Math.round(diff * 10) / 10;
    }
    return null;
  }, [latest, previous, selectedField]);

  // Points for pure SVG sparkline / line chart
  const chartPoints = useMemo(() => {
    const valid = sortedChronological
      .filter((m) => typeof m[selectedField] === 'number')
      .map((m) => ({
        date: m.date,
        value: m[selectedField] as number,
      }));

    if (valid.length < 2) return null;

    const values = valid.map((v) => v.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal === minVal ? 1 : maxVal - minVal;

    const width = 500;
    const height = 180;
    const padding = 30;

    const points = valid.map((pt, idx) => {
      const x = padding + (idx / (valid.length - 1)) * (width - padding * 2);
      const y = height - padding - ((pt.value - minVal) / range) * (height - padding * 2);
      return { x, y, ...pt };
    });

    const pathD = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { points, pathD, areaD, minVal, maxVal, width, height };
  }, [sortedChronological, selectedField]);

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar esta medición?')) {
      HapticService.impact('light');
      const updated = deleteBodyMetric(id);
      setMetrics(updated);
    }
  };

  const handleEdit = (item: BodyMetricEntry) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleOpenNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto overflow-x-hidden">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Evolución Corporal
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Seguimiento de peso, grasa y perímetros
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Medición
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Último Peso</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {latest ? `${latest.weight}` : '--'}
            </span>
            <span className="text-xs font-bold text-slate-400">kg</span>
          </div>
          {delta !== null && selectedField === 'weight' && (
            <div className="mt-1 flex items-center gap-1 text-[11px] font-bold">
              {delta > 0 ? (
                <span className="text-rose-500 flex items-center gap-0.5">
                  <TrendingUp className="w-3.5 h-3.5" /> +{delta} kg
                </span>
              ) : delta < 0 ? (
                <span className="text-emerald-500 flex items-center gap-0.5">
                  <TrendingDown className="w-3.5 h-3.5" /> {delta} kg
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-0.5">
                  <Minus className="w-3.5 h-3.5" /> 0.0 kg
                </span>
              )}
              <span className="text-[10px] text-slate-400 font-normal">vs anterior</span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Grasa Corporal</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {latest?.bodyFat ? `${latest.bodyFat}` : '--'}
            </span>
            <span className="text-xs font-bold text-slate-400">%</span>
          </div>
          <span className="text-[10px] text-slate-400">Composición</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Masa Muscular</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {latest?.muscleMass ? `${latest.muscleMass}` : '--'}
            </span>
            <span className="text-xs font-bold text-slate-400">kg</span>
          </div>
          <span className="text-[10px] text-slate-400">Masa magra</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cintura</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {latest?.waist ? `${latest.waist}` : '--'}
            </span>
            <span className="text-xs font-bold text-slate-400">cm</span>
          </div>
          <span className="text-[10px] text-slate-400">Perímetro</span>
        </div>
      </div>

      {/* Chart & Metric Selector Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gráfico de Progreso</span>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{currentFieldMeta.icon}</span>
              <span>{currentFieldMeta.label} ({currentFieldMeta.unit})</span>
            </h3>
          </div>

          {/* Metric Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {METRIC_FIELDS.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedField(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedField === f.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full h-48 sm:h-56 relative flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 p-2">
          {chartPoints ? (
            <svg
              viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="metricGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area */}
              <path d={chartPoints.areaD} fill="url(#metricGradient)" />

              {/* Line */}
              <path
                d={chartPoints.pathD}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data circles */}
              {chartPoints.points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth="2.5"
                    className="transition-transform hover:scale-150"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 10}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-slate-700 dark:fill-slate-300"
                  >
                    {pt.value}
                  </text>
                  <text
                    x={pt.x}
                    y={chartPoints.height - 10}
                    textAnchor="middle"
                    className="text-[9px] font-medium fill-slate-400"
                  >
                    {pt.date.slice(5)}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="text-center p-6 text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">
                Registra al menos 2 mediciones de {currentFieldMeta.label.toLowerCase()} para ver la gráfica de tendencia.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">
            Historial de Mediciones ({metrics.length})
          </h3>
        </div>

        {metrics.length === 0 ? (
          <div className="text-center py-10 text-slate-400 space-y-2">
            <Scale className="w-10 h-10 mx-auto opacity-30" />
            <p className="text-sm font-medium">No hay registros corporales todavía.</p>
            <p className="text-xs text-slate-500">Pulsa en "Registrar Medición" para añadir el peso de hoy.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {metrics.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center text-slate-600 dark:text-slate-300">
                    <span className="text-[10px] font-bold uppercase">{item.date.slice(5, 7)}</span>
                    <span className="text-xs font-black">{item.date.slice(8, 10)}</span>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        {item.weight} kg
                      </span>
                      {item.bodyFat && (
                        <span className="text-xs font-semibold text-slate-500">
                          {item.bodyFat}% grasa
                        </span>
                      )}
                      {item.muscleMass && (
                        <span className="text-xs font-semibold text-slate-500">
                          {item.muscleMass} kg músculo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      {item.waist && <span>Cintura: {item.waist}cm</span>}
                      {item.chest && <span>Pecho: {item.chest}cm</span>}
                      {item.arm && <span>Brazo: {item.arm}cm</span>}
                      {item.notes && <span className="italic truncate max-w-[160px]">"{item.notes}"</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Editar"
                    aria-label="Editar medición"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Eliminar"
                    aria-label="Eliminar medición"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BodyMetricModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={(updated) => setMetrics(updated)}
        initialData={editingItem}
      />
    </div>
  );
};
