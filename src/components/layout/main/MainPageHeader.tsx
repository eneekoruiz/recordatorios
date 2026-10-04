import React from 'react';
import {
  ArrowUpDown,
  X,
  Users,
  User,
  Clock,
  CreditCard,
  ShieldAlert,
  Wand2,
  Star,
  Trash2,
  Play,
  ChevronDown
} from 'lucide-react';
import { DurationInfoCard } from '../../ui/DurationInfoCard';
import { HapticService } from '../../../services/HapticService';
import { isCaducidadesList, isQueHeHechoList, getListBadgeInfo, isShoppingList, isLifeLibraryList } from '../../../utils/specialLists';
import { confirmDialog } from '../../ui/confirmDialog';
import { useAppStore } from '../../../store/useAppStore';
import { deleteCycleWithUndo } from '../../../utils/undoToast';
import type { TaskItem, CustomCycle, CustomList } from '../../../models/Task';
import type { TasksDurationSummary } from '../../../utils/taskDuration';
import { formatEuro } from '../../../utils/format';
import { MetaSplit, MONEY_COLOR } from '../../ui/MetaSplit';
import type { RoutinePart } from '../../../utils/routineBreakdown';
import { getReservedFrequencyColor } from '../../../constants/colors';

export interface CycleBreakdownInfo {
  ownCount: number;
  accumulatedCount: number;
  ownDurationMinutes: number;
  accumulatedDurationMinutes: number;
  details?: { cycleId: string; cycleName: string; count: number; durationMinutes: number; color?: string }[];
}

interface MainPageHeaderProps {
  scrollTop?: number;
  isMobile?: boolean;
  onBackToSidebar?: () => void;
  currentList?: CustomList;
  setIsListConfigOpen: (open: boolean) => void;
  viewColor: string;
  CycleIcon: any;
  SmartIcon: any;
  smartListInfo: any;
  isEditingCycle: boolean;
  currentCycle: CustomCycle | null | undefined;
  cycleEditName: string;
  setCycleEditName: (name: string) => void;
  updateCycle: (id: string, updates: any) => void;
  setIsEditingCycle: (editing: boolean) => void;
  getTitle: () => string;
  currentView: string;
  totalCost: number;
  completedCost?: number;
  totalDuration?: TasksDurationSummary;
  completedDuration?: TasksDurationSummary;
  activeVisibleCount: number;
  completedVisibleCount: number;
  cycleBreakdown?: CycleBreakdownInfo;
  /** Sin desglose por frecuencia: lo pendiente repartido en puntuales y frecuencias. */
  mixParts?: RoutinePart[] | null;
  setConfirmProps: (props: any) => void;
  setIsConfirmOpen: (open: boolean) => void;
  deleteCycle: (id: string) => void;
  sortBy: string;
  setSortBy: (sortBy: any) => void;
  lifeLogViewMode: 'people' | 'timeline';
  setLifeLogViewMode: (mode: 'people' | 'timeline') => void;
  handleOpenMonthlySummary: () => void;
  allTasksArray: TaskItem[];
  extractPeopleFromText: (text: string) => string[];
  selectedPersonFilter: string | null;
  setSelectedPersonFilter: (person: string | null) => void;
  flashbackMemories: TaskItem[];
  onEditTask?: (id: string) => void;
  caducidadesStats: any;
  onStartSequence?: () => void;
  cycleRoutineMode?: 'only_section' | 'full_routine';
  onToggleCycleRoutineMode?: (mode: 'only_section' | 'full_routine') => void;
  onNavigateView?: (view: string) => void;
}

export const MainPageHeader: React.FC<MainPageHeaderProps> = ({
  scrollTop,
  isMobile: _isMobile,
  onBackToSidebar: _onBackToSidebar,
  onNavigateView,
  currentList,
  setIsListConfigOpen: _setIsListConfigOpen,
  viewColor,
  CycleIcon,
  SmartIcon,
  smartListInfo,
  isEditingCycle,
  currentCycle,
  cycleEditName,
  setCycleEditName,
  updateCycle,
  setIsEditingCycle,
  getTitle,
  currentView,
  totalCost,
  completedCost,
  totalDuration,
  completedDuration,
  activeVisibleCount,
  completedVisibleCount: _completedVisibleCount,
  cycleBreakdown,
  mixParts,
  setConfirmProps,
  setIsConfirmOpen,
  deleteCycle,
  sortBy,
  setSortBy,
  lifeLogViewMode,
  setLifeLogViewMode,
  handleOpenMonthlySummary,
  allTasksArray,
  extractPeopleFromText,
  selectedPersonFilter,
  setSelectedPersonFilter,
  flashbackMemories,
  onEditTask,
  caducidadesStats,
  onStartSequence: _onStartSequence,
  cycleRoutineMode = 'only_section',
  onToggleCycleRoutineMode
}) => {
  const updateList = useAppStore((state) => state.updateList);
  const [isEditingListName, setIsEditingListName] = React.useState(false);
  const [listEditName, setListEditName] = React.useState('');
  const [isDurationCardOpen, setIsDurationCardOpen] = React.useState(false);

  const includeSwitchId = React.useId();
  const scrollOffset = Math.min(60, Math.max(0, scrollTop || 0));
  const titleProgress = Math.min(1, Math.max(0, (scrollOffset - 24) / 32));
  const titleOpacity = Math.max(0, 1 - titleProgress);
  const titleTranslateY = -titleProgress * 6;
  const titleScale = 1 - titleProgress * 0.03;
  const titleBlur = titleProgress * 1.5;

  return (
    <>
      <header 
        className="content-header" 
        style={{ padding: '4px 16px 6px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, margin: '0', borderBottom: 'none', boxSizing: 'border-box', background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        {/* Línea 1: Título, Badge, Botón Empezar y Gran Contador - Máximo 1 línea */}
        <div style={{ 
          width: '100%', 
          boxSizing: 'border-box', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '10px', 
          flexWrap: 'nowrap',
          minWidth: 0,
          opacity: titleOpacity,
          transform: `translateY(${titleTranslateY}px) scale(${titleScale})`,
          filter: titleBlur > 0.1 ? `blur(${titleBlur}px)` : 'none',
          transformOrigin: 'left center',
          willChange: 'opacity, transform, filter',
          transition: 'opacity 0.08s ease-out, transform 0.08s ease-out, filter 0.08s ease-out'
        }}>
          {/* Izquierda: Icono + Título + Badge de tipo (en una sola línea) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto', overflow: 'hidden' }}>
            {CycleIcon && <CycleIcon size={_isMobile ? 24 : 30} color={viewColor} style={{ marginRight: 2, flexShrink: 0 }} />}
            {SmartIcon && smartListInfo && (
              <div style={{
                marginRight: 4,
                width: _isMobile ? 30 : 36, height: _isMobile ? 30 : 36, borderRadius: '50%',
                backgroundColor: smartListInfo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 3px 10px ${smartListInfo.color}40`,
                flexShrink: 0
              }}>
                <SmartIcon size={_isMobile ? 17 : 20} color="white" />
              </div>
            )}
            {currentView === 'TRASH' && (
              <div style={{
                marginRight: 4,
                width: _isMobile ? 30 : 36, height: _isMobile ? 30 : 36, borderRadius: '50%',
                backgroundColor: '#8e8e93',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(142, 142, 147, 0.4)',
                flexShrink: 0
              }}>
                <Trash2 size={_isMobile ? 17 : 20} color="white" />
              </div>
            )}
            
            <h1 className="text-display view-title" style={{ 
              fontSize: _isMobile ? (getTitle().length > 20 ? '22px' : '26px') : (getTitle().length > 24 ? '28px' : '32px'), 
              fontWeight: 700,
              lineHeight: '1.15',
              letterSpacing: '-0.4px',
              ['--title-color' as string]: viewColor,
              display: 'inline-flex', 
              alignItems: 'center', 
              margin: 0,
              padding: 0,
              boxSizing: 'border-box',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {isEditingCycle && currentCycle ? (
                <input 
                  type="text" 
                  value={cycleEditName}
                  onChange={e => setCycleEditName(e.target.value)}
                  onBlur={() => {
                    if (cycleEditName.trim()) {
                      updateCycle(currentCycle.id, { name: cycleEditName.trim() });
                    }
                    setIsEditingCycle(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  autoFocus
                  style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-primary)', color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none', width: 'auto' }}
                />
              ) : isEditingListName && currentList && !currentList.isFolder ? (
                <input 
                  type="text" 
                  value={listEditName}
                  onChange={e => setListEditName(e.target.value)}
                  onBlur={() => {
                    if (listEditName.trim() && listEditName.trim() !== currentList.name) {
                      updateList(currentList.id, { name: listEditName.trim() });
                    }
                    setIsEditingListName(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') setIsEditingListName(false);
                  }}
                  autoFocus
                  style={{ background: 'transparent', border: 'none', borderBottom: `2px solid ${viewColor}`, color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 'inherit', outline: 'none', width: 'auto', minWidth: 120 }}
                />
              ) : (
                <span 
                  onClick={() => {
                    if (currentList && !currentList.isFolder) {
                      HapticService.selection();
                      setListEditName(currentList.name);
                      setIsEditingListName(true);
                    }
                  }}
                  onDoubleClick={() => {
                    if (currentCycle) {
                      setCycleEditName(currentCycle.name);
                      setIsEditingCycle(true);
                    } else if (currentList && !currentList.isFolder) {
                      HapticService.selection();
                      setListEditName(currentList.name);
                      setIsEditingListName(true);
                    }
                  }}
                  style={{ cursor: (currentCycle || (currentList && !currentList.isFolder)) ? 'text' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                  title={currentCycle ? "Doble click para editar nombre" : (currentList && !currentList.isFolder) ? "Toca para cambiar nombre" : undefined}
                >
                  {getTitle()}
                </span>
              )}
            </h1>

            {currentList && !currentList.isFolder && (() => {
              const badge = getListBadgeInfo(currentList, currentView);
              if (badge.generic) return null;
              return (
                <span 
                  className="apple-list-type-pill" 
                  style={{ 
                    fontSize: '0.70rem', 
                    fontWeight: 600, 
                    color: badge.color, 
                    background: `color-mix(in srgb, ${badge.color} 9%, transparent)`, 
                    border: `1px solid color-mix(in srgb, ${badge.color} 20%, transparent)`, 
                    padding: '1px 7px', 
                    borderRadius: 999,
                    letterSpacing: '-0.01em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                >
                  {badge.label}
                </span>
              );
            })()}
          </div>

          {/* Derecha: Botón Empezar + Gran Contador (en la misma fila) */}
          {currentView !== 'TRASH' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {_onStartSequence && !isLifeLibraryList(currentView, currentList) && currentList?.listType !== 'library' && (activeVisibleCount > 0 || currentView.startsWith('cycle_')) && currentView !== 'compras' && currentView !== 'habitos_vitales' && (
                <button
                  type="button"
                  onClick={() => {
                    HapticService.selection();
                    _onStartSequence();
                  }}
                  title="Empezar lista en modo ejecución"
                  aria-label="Empezar lista"
                  className="apple-header-start-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    height: 30,
                    padding: _isMobile ? '0 9px' : '0 12px',
                    borderRadius: 999,
                    background: `color-mix(in srgb, ${viewColor} 14%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${viewColor} 28%, transparent)`,
                    color: viewColor,
                    fontWeight: 700,
                    fontSize: '0.80rem',
                    cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  <Play size={11} fill="currentColor" />
                  {!_isMobile && <span>Empezar</span>}
                </button>
              )}
              {currentView !== 'smart_calendar' && (activeVisibleCount > 0 || currentView.startsWith('cycle_')) && (
                <span className="apple-large-counter" style={{ color: viewColor, fontSize: _isMobile ? '28px' : '34px', lineHeight: 1 }}>
                  {activeVisibleCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Línea 2: Metadatos (Duración, Presupuesto y Desglose de Frecuencias) - Máximo 1 línea */}
        {(() => {
          const hasValidDuration = Boolean(totalDuration && totalDuration.activeMinutes > 0 && !isShoppingList(currentView, currentList) && !isCaducidadesList(currentView, currentList));
          const hasValidPrice = Boolean((totalCost > 0 || (completedCost !== undefined && completedCost > 0)) && !currentCycle && !isCaducidadesList(currentView, currentList));
          const hasBreakdown = Boolean(cycleBreakdown && cycleBreakdown.details && cycleBreakdown.details.length > 1);

          if (!hasValidDuration && !hasValidPrice && !hasBreakdown) return null;

          return (
            <div 
              className="list-duration-meta"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                minWidth: 0,
                opacity: titleOpacity,
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                marginTop: 2
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                {hasValidDuration && (
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      setIsDurationCardOpen(true);
                    }}
                    className="apple-duration-chip"
                    title="Toca para ver el desglose detallado de tiempo"
                    aria-label="Ver desglose de tiempo"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      height: 24,
                      padding: '0 8px',
                      borderRadius: 999,
                      background: 'var(--bg-secondary, rgba(0,0,0,0.04))',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: 650,
                      fontVariantNumeric: 'tabular-nums',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}
                  >
                    <Clock size={11} color={viewColor} />
                    <span>~{totalDuration!.formattedActive}</span>
                    <ChevronDown size={10} style={{ opacity: 0.5, marginLeft: 1 }} />
                  </button>
                )}

                {hasValidDuration && hasValidPrice && (
                  <span className="meta-dot" style={{ opacity: 0.4 }}>·</span>
                )}

                {hasValidPrice && (
                  <MetaSplit
                    label={<span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatEuro(totalCost)}</span>}
                    parts={completedCost && completedCost > 0 ? [
                      { id: 'pending', value: totalCost, text: `${formatEuro(totalCost)} pendientes`, color: MONEY_COLOR, tone: 'solid' },
                      { id: 'paid', value: completedCost, text: `${formatEuro(completedCost)} pagados`, color: MONEY_COLOR, tone: 'done' },
                    ] : []}
                    description={`Pendiente: ${formatEuro(totalCost)}${completedCost && completedCost > 0 ? ` · Ya pagado: ${formatEuro(completedCost)} · Total original: ${formatEuro(totalCost + completedCost)}` : ''}`}
                  />
                )}
              </div>

              {/* Desglose de frecuencias situado en la línea 2, alineado a la derecha */}
              {hasBreakdown && (
                <div
                  className="cycle-counter-breakdown"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    letterSpacing: '-0.1px',
                    flexShrink: 0
                  }}
                  title={`${activeVisibleCount} recordatorios en total: ${cycleBreakdown!.details!.map(d => `${d.count} ${d.cycleName.toLowerCase()}`).join(' + ')}`}
                >
                  {cycleBreakdown!.details!.map((d, i) => {
                    const freqColor = d.color || getReservedFrequencyColor(d.cycleId);
                    return (
                      <span key={d.cycleId || d.cycleName} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: freqColor }}>
                        {i > 0 && <span style={{ opacity: 0.35, color: 'var(--text-tertiary)', margin: '0 1px' }}>+</span>}
                        <span>{d.count}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Resumen de Caducidades: una línea propia bajo el título (antes iba en una cápsula
            que en el móvil se partía en tres líneas y empujaba el contador abajo). */}
        {isCaducidadesList(currentView, currentList) && caducidadesStats && (
          <div className="cad-summary" style={{ opacity: titleOpacity }}>
            <span className="cad-summary-item">
              <CreditCard size={14} color="#ff9500" aria-hidden="true" />
              <strong>{caducidadesStats.cards}</strong> {caducidadesStats.cards === 1 ? 'tarjeta' : 'tarjetas'}
            </span>
            <span className="cad-summary-item">
              <Clock size={14} color="#0a84ff" aria-hidden="true" />
              <strong>{caducidadesStats.subs}</strong> {caducidadesStats.subs === 1 ? 'suscripción' : 'suscripciones'}
            </span>
            {caducidadesStats.subCosts && caducidadesStats.subCosts.count > 0 && (
              <span className="cad-summary-item cad-summary-cost">
                <strong>{caducidadesStats.subCosts.formattedMonthly}</strong> al mes
              </span>
            )}
            {caducidadesStats.critical > 0 && (
              <span className="cad-summary-item cad-summary-critical">
                <ShieldAlert size={13} aria-hidden="true" />
                <strong>{caducidadesStats.critical}</strong> por vencer
              </span>
            )}
          </div>
        )}

        {/* Incluir las frecuencias anteriores en esta vista: una fila con interruptor, como en Ajustes */}
        {currentCycle && currentCycle.id !== 'cycle_day' && onToggleCycleRoutineMode && (
          <div className="routine-include-row" style={{ opacity: titleOpacity }}>
            <label htmlFor={includeSwitchId} className="routine-include-text">
              {currentCycle.id === 'cycle_week' ? 'Incluir diarias' : 'Incluir acumuladas'}
              {currentCycle.id !== 'cycle_week' && (
                <span className="routine-include-sub">
                  {currentCycle.id === 'cycle_month' ? 'Semanales y diarias' : currentCycle.id === 'cycle_year' ? 'Mensuales, semanales y diarias' : 'Las de frecuencia más corta'}
                </span>
              )}
            </label>
            <label className="switch">
              <input
                id={includeSwitchId}
                type="checkbox"
                role="switch"
                checked={cycleRoutineMode === 'full_routine'}
                onChange={(e) => {
                  HapticService.selection();
                  onToggleCycleRoutineMode(e.target.checked ? 'full_routine' : 'only_section');
                }}
              />
              <span className="slider round" />
            </label>
          </div>
        )}

        {currentCycle && !['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(currentCycle.id) && (
          <div>
            <button 
              type="button"
              onClick={async () => {
                const cycleName = currentCycle.name;
                const cycleId = currentCycle.id;
                setConfirmProps({ 
                  title: 'Eliminar Frecuencia', 
                  message: `¿Estás seguro de eliminar la frecuencia "${cycleName}"? Esta acción no se puede deshacer.`, 
                  onConfirm: () => {
                    deleteCycleWithUndo({
                      getCycleName: () => cycleName,
                      getTaskIds: () => Object.values(useAppStore.getState().tasks).filter((t) => t.cycle_id === cycleId && !t.deleted_at).map((t) => t.id),
                      remove: () => deleteCycle(cycleId),
                      restore: () => useAppStore.getState().restoreCycle(cycleId),
                      relink: (id) => useAppStore.getState().updateTask(id, { cycle_id: cycleId }),
                    });
                    if (onNavigateView) {
                      onNavigateView('smart_today');
                    }
                    if (_onBackToSidebar) {
                      _onBackToSidebar();
                    }
                  }
                }); 
                setIsConfirmOpen(true);
              }}
              className="time-pill"
              style={{ cursor: 'pointer', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--accent-red)', border: 'none' }}
            >
              Eliminar Frecuencia
            </button>
          </div>
        )}

        {currentView === 'TRASH' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {allTasksArray.filter(t => t.deleted_at).length} recordatorio{allTasksArray.filter(t => t.deleted_at).length === 1 ? '' : 's'} · Se eliminan definitivamente tras 30 días
            </span>
            {allTasksArray.some(t => t.deleted_at) && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDialog({
                    title: 'Vaciar papelera',
                    message: '¿Estás seguro de que deseas vaciar la papelera? Todos los recordatorios se eliminarán permanentemente. Esta acción no se puede deshacer.',
                    confirmText: 'Vaciar papelera',
                    tone: 'danger'
                  });
                  if (ok) {
                    useAppStore.getState().emptyTrash();
                    HapticService.notification('success');
                  }
                }}
                style={{
                  background: 'rgba(255, 59, 48, 0.1)',
                  color: 'var(--accent-red, #ff3b30)',
                  border: '1px solid rgba(255, 59, 48, 0.25)',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Trash2 size={13} />
                <span>Vaciar papelera</span>
              </button>
            )}
          </div>
        )}


        {sortBy !== 'manual' && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6, 
                padding: '4px 12px', 
                borderRadius: 12, 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                background: 'var(--accent-glow, rgba(10,132,255,0.1))', 
                color: 'var(--accent-primary)',
                border: '1px solid rgba(10,132,255,0.2)'
              }}
            >
              <ArrowUpDown size={13} />
              <span>Orden: {
                sortBy === 'dueDate' ? 'Fecha de vencimiento' :
                sortBy === 'priority' ? 'Prioridad' :
                sortBy === 'title' ? 'Título (A-Z)' : 'Fecha de creación'
              }</span>
              <button
                type="button"
                onClick={() => { HapticService.selection(); setSortBy('manual'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 4 }}
                title="Restablecer a orden manual"
              >
                <X size={13} />
              </button>
            </span>
          </div>
        )}

        {isQueHeHechoList(currentView, currentList) && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'inline-flex', background: 'var(--bg-card, rgba(0,0,0,0.05))', padding: '3px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  onClick={() => { HapticService.selection(); setLifeLogViewMode('people'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 7,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: lifeLogViewMode === 'people' ? 'var(--bg-elevated, #fff)' : 'transparent',
                    color: lifeLogViewMode === 'people' ? '#5856d6' : 'var(--text-secondary)',
                    boxShadow: lifeLogViewMode === 'people' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users size={14} />
                  <span>Por Personas</span>
                </button>
                <button
                  type="button"
                  onClick={() => { HapticService.selection(); setLifeLogViewMode('timeline'); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 7,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: lifeLogViewMode === 'timeline' ? 'var(--bg-elevated, #fff)' : 'transparent',
                    color: lifeLogViewMode === 'timeline' ? '#5856d6' : 'var(--text-secondary)',
                    boxShadow: lifeLogViewMode === 'timeline' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Clock size={14} />
                  <span>Línea de Tiempo</span>
                </button>
                <button
                  type="button"
                  data-testid="monthly-summary-btn"
                  onClick={() => handleOpenMonthlySummary()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 11px',
                    borderRadius: 7,
                    fontSize: '0.80rem',
                    fontWeight: 650,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'rgba(255, 149, 0, 0.12)',
                    color: '#ff9500',
                    transition: 'all 0.15s ease'
                  }}
                  title="Generar memoria y resumen mensual con IA"
                >
                  <Wand2 size={13} strokeWidth={2.2} />
                  <span>Resumen del mes</span>
                </button>
              </div>
            </div>

            {/* Filtro rápido por persona en modo personas */}
            {lifeLogViewMode === 'people' && (() => {
              const allQueHeHecho = allTasksArray.filter((t: any) => !t.deleted_at && (t.categoryId === 'que_he_hecho' || (t as any).category_id === 'que_he_hecho'));
              const uniqueP = Array.from(new Set(allQueHeHecho.flatMap(t => (t.people && t.people.length > 0) ? t.people : extractPeopleFromText(`${t.title || ''} ${t.description || ''}`)))).filter(Boolean);
              if (uniqueP.length === 0) return null;
              return (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Filtrar:</span>
                  <button
                    type="button"
                    onClick={() => { HapticService.selection(); setSelectedPersonFilter(null); }}
                    style={{
                      padding: '2px 9px',
                      borderRadius: 999,
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      border: selectedPersonFilter === null ? '1px solid #5856D6' : '1px solid var(--border-subtle)',
                      background: selectedPersonFilter === null ? '#5856D6' : 'var(--bg-elevated)',
                      color: selectedPersonFilter === null ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    Todos
                  </button>
                  {uniqueP.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { HapticService.selection(); setSelectedPersonFilter(selectedPersonFilter === p ? null : p); }}
                      style={{
                        padding: '2px 9px',
                        borderRadius: 999,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: selectedPersonFilter === p ? '1px solid #5856D6' : '1px solid var(--border-subtle)',
                        background: selectedPersonFilter === p ? '#5856D6' : 'var(--bg-elevated)',
                        color: selectedPersonFilter === p ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <User size={11} strokeWidth={2.4} /> {p}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Banner 'Un día como hoy' */}
            {flashbackMemories.length > 0 && (
              <div
                data-testid="flashback-banner"
                onClick={() => onEditTask?.(flashbackMemories[0].id)}
                style={{
                  marginTop: 6,
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, rgba(88, 86, 214, 0.12), rgba(255, 149, 0, 0.12))',
                  border: '1px solid rgba(88, 86, 214, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                }}
                title="Toca para ver este recuerdo"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'flex', width: 32, height: 32, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(255, 149, 0, 0.16)' }}>
                    <Star size={16} color="#ff9500" fill="#ff9500" strokeWidth={1.5} />
                  </span>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Un día como hoy: {flashbackMemories[0].title}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {flashbackMemories[0].people && flashbackMemories[0].people.length > 0
                        ? `Con ${flashbackMemories[0].people.join(', ')} • Toca para revivir este momento`
                        : 'Recordatorio especial vivido en esta misma fecha'}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.74rem', color: '#5856D6', fontWeight: 650 }}>Ver recuerdo →</span>
              </div>
            )}
          </div>
        )}
      </header>

      {totalDuration && totalDuration.activeMinutes > 0 && (
        <DurationInfoCard
          isOpen={isDurationCardOpen}
          onClose={() => setIsDurationCardOpen(false)}
          title={getTitle()}
          color={viewColor}
          totalSummary={totalDuration}
          completedSummary={completedDuration}
          routineParts={mixParts}
          mixParts={mixParts}
          onStartSequence={_onStartSequence}
          pendingCount={activeVisibleCount}
        />
      )}
    </>
  );
};
