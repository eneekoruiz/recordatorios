import React from 'react';
import { 
  ArrowUpDown, 
  X, 
  Users, 
  Clock, 
  CreditCard, 
  ShieldAlert 
} from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import { isCaducidadesList, isQueHeHechoList } from '../../../utils/specialLists';
import type { TaskItem, CustomCycle, CustomList } from '../../../models/Task';

interface MainPageHeaderProps {
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
}

export const MainPageHeader: React.FC<MainPageHeaderProps> = ({
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
  caducidadesStats
}) => {
  return (
    <>
      <header 
        className="content-header" 
        style={{ padding: '2px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, margin: '0', borderBottom: 'none', boxSizing: 'border-box' }}
      >
        {/* Línea del Título - Estilo Apple Reminders */}
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
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
            flex: 1,
            minWidth: 0
          }}>
            {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" style={{ marginRight: 12 }} />}
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

          {/* Gran Contador Apple Reminders en el color de la lista y Total Presupuesto */}
          {!currentCycle && currentView !== 'TRASH' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

        {totalCost > 0 && (
          <div 
            style={{ 
              marginTop: 10, 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6,
              background: 'var(--bg-elevated)', 
              color: 'var(--text-secondary)', 
              padding: '4px 12px', 
              borderRadius: 8, 
              fontWeight: 500, 
              fontSize: '0.84rem',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>Total estimado:</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
              {totalCost.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
            </span>
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
                  <span>🪄 Resumen del mes</span>
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
                        cursor: 'pointer'
                      }}
                    >
                      👤 {p}
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
                  <span style={{ fontSize: '1.4rem' }}>🌟</span>
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

        {isCaducidadesList(currentView, currentList) && caducidadesStats && (
          <div style={{
            marginTop: 10,
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CreditCard size={15} color="#ff9500" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Tarjetas:</span>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caducidadesStats.cards}</span>
            </div>
            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} color="#007aff" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Suscripciones:</span>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caducidadesStats.subs}</span>
            </div>
            {caducidadesStats.subCosts && caducidadesStats.subCosts.count > 0 && (
              <>
                <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Gasto recurrente:</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#34c759' }}>
                    {caducidadesStats.subCosts.formattedMonthly}/mes
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                    ({caducidadesStats.subCosts.formattedYearly}/año)
                  </span>
                </div>
              </>
            )}
            {caducidadesStats.critical > 0 && (
              <>
                <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ff3b30' }}>
                  <ShieldAlert size={15} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Atención inmediata:</span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{caducidadesStats.critical}</span>
                </div>
              </>
            )}
          </div>
        )}
      </header>
    </>
  );
};
