/**
 * WeeklyStreakWidget.tsx
 * 
 * Dashboard inline semanal de productividad y rachas — estilo Apple Health.
 * Se renderiza en la vista "Hoy" justo debajo del briefing diario.
 * Muestra: tareas completadas esta semana, racha activa, heatmap semanal,
 * y el mejor hábito con racha más alta. Cero dependencias externas.
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { isCompletedInCurrentPeriod, calculateHabitStreak, getStartOfWeek } from '../../../services/TaskService';
import type { TaskItem } from '../../../models/Task';

function getDayLabel(date: Date): string {
  return ['D', 'L', 'M', 'X', 'J', 'V', 'S'][date.getDay()];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DayStats {
  date: Date;
  label: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
}

export function WeeklyStreakWidget() {
  const { tasks, cycles, listSections, lists, theme } = useAppStore();
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = useState(false);

  const weekStats = useMemo(() => {
    const now = new Date();
    const weekStart = getStartOfWeek(now);
    const allTasks = (Object.values(tasks || {}) as TaskItem[]).filter(t => !t.deleted_at);

    // Build 7-day heatmap
    const days: DayStats[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dayStr = formatDate(d);

      // Count tasks completed on this specific day
      const count = allTasks.filter(t => {
        if (!t.completionHistory?.length) return false;
        return t.completionHistory.some((ts: number | string) => {
          const tDate = new Date(ts);
          return formatDate(tDate) === dayStr;
        });
      }).length;

      return {
        date: d,
        label: getDayLabel(d),
        count,
        isToday: formatDate(d) === formatDate(now),
        isFuture: d > now
      };
    });

    // Total completed this week
    const totalThisWeek = days.reduce((sum, d) => sum + (!d.isFuture ? d.count : 0), 0);

    // Total completed last week
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
    const totalLastWeek = allTasks.reduce((sum, t) => {
      if (!t.completionHistory?.length) return sum;
      const completedLastWeek = t.completionHistory.filter((ts: number | string) => {
        const d = new Date(ts);
        return d >= prevWeekStart && d <= prevWeekEnd;
      }).length;
      return sum + Math.min(completedLastWeek, 1);
    }, 0);

    // Active days this week (days with at least 1 completion)
    const activeDays = days.filter(d => !d.isFuture && d.count > 0).length;

    // Current daily streak (consecutive days with at least 1 completion ending today or yesterday)
    let dailyStreak = 0;
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = formatDate(d);
      const hadCompletion = allTasks.some(t =>
        t.completionHistory?.some((ts: number | string) => formatDate(new Date(ts)) === dayStr)
      );
      if (hadCompletion) {
        dailyStreak++;
      } else {
        break;
      }
    }

    // Best habit streak
    const bestHabit = allTasks
      .filter(t => t.cycle_id || t.targetCount)
      .map(t => ({ task: t, streak: calculateHabitStreak(t, cycles) }))
      .filter(h => h.streak.count > 0)
      .sort((a, b) => b.streak.count - a.streak.count)[0];

    // Today's completions
    const todayStr = formatDate(now);
    const completedToday = allTasks.filter(t =>
      t.completionHistory?.some((ts: number | string) => formatDate(new Date(ts)) === todayStr) ||
      isCompletedInCurrentPeriod(t, cycles, listSections, lists)
    ).length;

    const maxCount = Math.max(1, ...days.map(d => d.count));
    const weekTrend = totalLastWeek > 0
      ? Math.round(((totalThisWeek - totalLastWeek) / totalLastWeek) * 100)
      : totalThisWeek > 0 ? 100 : 0;

    return { days, totalThisWeek, activeDays, dailyStreak, bestHabit, completedToday, maxCount, weekTrend };
  }, [tasks, cycles, listSections, lists]);

  const cardBg = isDark
    ? 'rgba(28, 30, 46, 0.65)'
    : 'rgba(255, 255, 255, 0.85)';
  const cardBorder = isDark
    ? '1px solid rgba(255,255,255,0.1)'
    : '1px solid rgba(0,0,0,0.07)';

  const { days, totalThisWeek, activeDays, dailyStreak, bestHabit, completedToday, maxCount, weekTrend } = weekStats;

  const hasMeaningfulData = totalThisWeek > 0 || completedToday > 0;
  if (!hasMeaningfulData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      style={{
        margin: '0 0 16px 0',
        borderRadius: 18,
        background: cardBg,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: cardBorder,
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.28)'
          : '0 2px 16px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Mini heatmap dots - compact view */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {days.map((d, i) => (
              <div
                key={i}
                title={`${d.label}: ${d.count} completadas`}
                style={{
                  width: d.isToday ? 8 : 6,
                  height: d.isToday ? 8 : 6,
                  borderRadius: '50%',
                  background: d.isFuture
                    ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
                    : d.count === 0
                      ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')
                      : `rgba(52, 199, 89, ${0.3 + (d.count / maxCount) * 0.7})`,
                  border: d.isToday ? '1.5px solid #34c759' : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <span style={{
              fontSize: '0.84rem',
              fontWeight: 700,
              color: isDark ? 'rgba(255,255,255,0.9)' : 'var(--text-primary, #1c1c1e)'
            }}>
              {totalThisWeek} completadas esta semana
            </span>
            {weekTrend !== 0 && (
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 500,
                color: weekTrend > 0 ? '#34c759' : '#ff453a',
                display: 'flex',
                alignItems: 'center',
                gap: 3
              }}>
                <TrendingUp size={11} />
                {weekTrend > 0 ? `+${weekTrend}%` : `${weekTrend}%`} vs semana pasada
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Streak badge */}
          {dailyStreak >= 2 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,149,0,0.15)',
              border: '1px solid rgba(255,149,0,0.25)',
              color: '#ff9500'
            }}>
              <Flame size={13} fill="#ff9500" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{dailyStreak}</span>
            </div>
          )}
          <div style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 16px' }}>
              {/* Full heatmap with labels */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {days.map((d, i) => {
                  const intensity = d.isFuture ? 0 : d.count === 0 ? 0 : d.count / maxCount;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <motion.div
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.04, type: 'spring', stiffness: 280, damping: 24 }}
                        style={{
                          width: '100%',
                          height: 32,
                          borderRadius: 8,
                          background: d.isFuture
                            ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)')
                            : intensity === 0
                              ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                              : `rgba(52,199,89,${0.2 + intensity * 0.8})`,
                          border: d.isToday ? '2px solid #34c759' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: intensity > 0.5 ? 'white' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
                          transformOrigin: 'bottom'
                        }}
                      >
                        {d.count > 0 && !d.isFuture ? d.count : ''}
                      </motion.div>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: d.isToday ? 700 : 500,
                        color: d.isToday ? '#34c759' : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)')
                      }}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Stats row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginBottom: bestHabit ? 12 : 0
              }}>
                {[
                  { label: 'Hoy', value: completedToday, icon: <CheckCircle2 size={14} color="#34c759" />, color: '#34c759' },
                  { label: 'Esta semana', value: `${activeDays}/7 días`, icon: <TrendingUp size={14} color="#007aff" />, color: '#007aff' },
                  { label: 'Racha', value: dailyStreak > 0 ? `${dailyStreak} días` : '—', icon: <Flame size={14} color="#ff9500" />, color: '#ff9500' }
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 10px',
                      borderRadius: 12,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {stat.icon}
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {stat.label}
                      </span>
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Best habit streak */}
              {bestHabit && bestHabit.streak.count >= 2 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,149,0,0.08)',
                  border: '1px solid rgba(255,149,0,0.18)'
                }}>
                  <Flame size={18} fill="#ff9500" color="#ff9500" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ff9500', marginBottom: 1 }}>
                      Mejor racha activa
                    </div>
                    <div style={{
                      fontSize: '0.84rem',
                      fontWeight: 500,
                      color: isDark ? 'rgba(255,255,255,0.75)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {bestHabit.task.title}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#ff9500',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0
                  }}>
                    {bestHabit.streak.count}
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, marginLeft: 2 }}>{bestHabit.streak.unit}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
