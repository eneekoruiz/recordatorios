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
  Trash2
} from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import { isCaducidadesList, isQueHeHechoList } from '../../../utils/specialLists';
import { confirmDialog } from '../../ui/confirmDialog';
import { useAppStore } from '../../../store/useAppStore';
import type { TaskItem, CustomCycle, CustomList } from '../../../models/Task';

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
  activeVisibleCount: number;
  completedVisibleCount: number;
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
}

export const MainPageHeader: React.FC<MainPageHeaderProps> = ({
  scrollTop,
  isMobile: _isMobile,
  onBackToSidebar: _onBackToSidebar,
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
  activeVisibleCount,
  completedVisibleCount,
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
  onStartSequence: _onStartSequence
}) => {
  const scrollOffset = Math.min(45, Math.max(0, scrollTop || 0));
  const titleProgress = Math.min(1, scrollOffset / 28);
  const titleOpacity = Math.max(0, 1 - titleProgress * 1.15);
  const titleTranslateY = -titleProgress * 8;
  const titleScale = 1 - titleProgress * 0.04;
  const titleBlur = titleProgress * 2.5;

  return (
    <>
      <header 
        className="content-header" 
        style={{ padding: '8px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, margin: '0', borderBottom: 'none', boxSizing: 'border-box', background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
      >
        {/* Línea del Título - Estilo Apple Reminders con transición fluida */}
        <div style={{ 
          width: '100%', 
          boxSizing: 'border-box', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          gap: '12px', 
          flexWrap: 'wrap',
          opacity: titleOpacity,
          transform: `translateY(${titleTranslateY}px) scale(${titleScale})`,
          filter: titleBlur > 0.1 ? `blur(${titleBlur}px)` : 'none',
          transformOrigin: 'left center',
          willChange: 'opacity, transform, filter',
          transition: 'opacity 0.08s ease-out, transform 0.08s ease-out, filter 0.08s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto', flexWrap: 'wrap' }}>
            <h1 className="text-display" style={{ 
              fontSize: '34px', 
              fontWeight: 700,
              lineHeight: '1.2',
              wordBreak: 'break-word',
              letterSpacing: '-0.5px',
              color: viewColor,
              display: 'flex', alignItems: 'center', margin: 0,
              padding: 0,
              boxSizing: 'border-box',
              minWidth: 0
            }}>
              {CycleIcon && <CycleIcon size={32} color={viewColor} style={{ marginRight: 12 }} />}
              {SmartIcon && smartListInfo && (
                <div style={{
                  marginRight: 12,
                  width: 38, height: 38, borderRadius: '50%',
                  backgroundColor: smartListInfo.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${smartListInfo.color}40`,
                  flexShrink: 0
                }}>
                  <SmartIcon size={22} color="white" />
                </div>
              )}
              {currentView === 'TRASH' && (
                <div style={{
                  marginRight: 12,
                  width: 38, height: 38, borderRadius: '50%',
                  backgroundColor: '#8e8e93',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(142, 142, 147, 0.4)',
                  flexShrink: 0
                }}>
                  <Trash2 size={22} color="white" />
                </div>
              )}
              
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
              ) : (
                <span 
                  onDoubleClick={() => {
                    if (currentCycle) {
                      setCycleEditName(currentCycle.name);
                      setIsEditingCycle(true);
                    }
                  }}
                  style={{ cursor: currentCycle ? 'text' : 'default', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={currentCycle ? "Doble click para editar nombre" : undefined}
                >
                  {getTitle()}
                </span>
              )}
            </h1>

            {/* Caducidades stats en la misma línea del título — diseño Apple con iconos profesionales sin emojis */}
            {isCaducidadesList(currentView, currentList) && caducidadesStats && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'var(--bg-card, rgba(0,0,0,0.03))',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                fontSize: '0.80rem',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                  <CreditCard size={14} color="#ff9500" />
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{caducidadesStats.cards}</strong>
                  <span>tarjetas</span>
                </span>
                <span style={{ width: 1, height: 12, background: 'var(--border-subtle, rgba(0,0,0,0.1))' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
                  <Clock size={14} color="#0a84ff" />
                  <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{caducidadesStats.subs}</strong>
                  <span>suscripciones</span>
                </span>
                {caducidadesStats.subCosts && caducidadesStats.subCosts.count > 0 && (
                  <>
                    <span style={{ width: 1, height: 12, background: 'var(--border-subtle, rgba(0,0,0,0.1))' }} />
                    <span style={{ color: '#34c759', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)', marginRight: 4 }}>Gasto recurrente:</span>
                      {caducidadesStats.subCosts.formattedMonthly}/mes
                    </span>
                  </>
                )}
                {caducidadesStats.critical > 0 && (
                  <>
                    <span style={{ width: 1, height: 12, background: 'var(--border-subtle, rgba(0,0,0,0.1))' }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ff3b30', fontWeight: 650 }}>
                      <ShieldAlert size={13} />
                      <span>{caducidadesStats.critical} por vencer</span>
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Gran Contador Apple Reminders en el color de la lista */}
          {!currentCycle && currentView !== 'TRASH' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              {totalCost > 0 && (
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-card, rgba(255,255,255,0.7))',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.2px'
                  }}
                  title="Presupuesto total pendiente"
                >
                  {totalCost.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                </span>
              )}
              <span className="apple-large-counter" style={{ color: viewColor }}>
                {activeVisibleCount}
              </span>
            </div>
          )}
        </div>

        {currentCycle && (
          <div className="content-stats" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginLeft: '4px' }}>
            <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 999 }}><strong>{activeVisibleCount}</strong> &nbsp;pendientes</span>
            <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 999 }}><strong>{completedVisibleCount}</strong> &nbsp;completadas</span>
          </div>
        )}

        {currentCycle && !['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(currentCycle.id) && (
          <div>
            <button 
              type="button"
              onClick={async () => {
                setConfirmProps({ title: 'Eliminar Ciclo', message: `¿Estás seguro de eliminar el ciclo ${currentCycle.name}? Esta acción no se puede deshacer.`, onConfirm: () => deleteCycle(currentCycle.id) }); setIsConfirmOpen(true);
              }}
              className="time-pill"
              style={{ cursor: 'pointer', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--accent-red)', border: 'none' }}
            >
              Eliminar Ciclo
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
    </>
  );
};
