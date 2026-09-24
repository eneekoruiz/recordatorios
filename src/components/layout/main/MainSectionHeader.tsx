import React, { useState, useRef, useCallback } from 'react';
import { MoreHorizontal, ChevronDown, Clock, Play } from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import type { SectionMenuState } from './SectionContextMenu';
import type { TasksDurationSummary } from '../../../utils/taskDuration';

interface SectionData {
  title: string;
  titleIcon?: React.ReactNode;
  category: string;
  color: string;
  sectionId?: string;
  depth: number;
  periodicity?: string | null;
  routineCounts?: { full: number; only: number } | null;
  routineMode?: 'full_routine' | 'only_section';
  sectionTaskIds?: string[];
}

interface MainSectionHeaderProps {
  data: SectionData;
  itemKey: string | number;
  index: number;
  itemStyle: React.CSSProperties;
  showDivider: boolean;
  isCustomSection: boolean;
  isDraggingOver: boolean;
  isCatCollapsed: (cat: string) => boolean;
  toggleCategory: (cat: string) => void;
  sectionMenuId?: string | null;
  setSectionMenuId?: (id: string | null) => void;
  setDragOverSectionId: (id: string | null) => void;
  updateTaskSection: (taskId: string, sectionId: string) => void;
  setSectionMenu: (menu: SectionMenuState) => void;
  sectionTouchTimer: React.MutableRefObject<any>;
  editingSectionId: string | null;
  editingSectionName: string;
  setEditingSectionName: (name: string) => void;
  saveSectionName: (e: any, id: string) => void;
  startEditingSection: (e: any, id: string, name: string) => void;
  setSelectedPersonForProfile: (person: string) => void;
  sectionTotal: number;
  durationSummary?: TasksDurationSummary;
  onOpenNewTask?: (sectionId?: string) => void;
  onAddSection?: (parentId?: string) => void;
  deleteListSection?: (id: string) => void;
  isolatedSectionKey?: string | null;
  setIsolatedSectionKey?: React.Dispatch<React.SetStateAction<string | null>>;
  isolatedRoutineMode?: 'full_routine' | 'only_section';
  setIsolatedRoutineMode?: (mode: 'full_routine' | 'only_section') => void;
  sectionRoutineModes?: Record<string, 'full_routine' | 'only_section'>;
  toggleSectionRoutineMode?: (secKey: string, mode: 'full_routine' | 'only_section') => void;
  dragOverSectionId: string | null;
  onStartSectionSequence?: () => void;
  pendingTaskCount?: number;
  isMobile?: boolean;
  sectionMenu?: SectionMenuState;
  isPrevHeader?: boolean;
  isFirstAfterPageHeader?: boolean;
}

export const MainSectionHeader: React.FC<MainSectionHeaderProps> = ({
  data,
  itemKey,
  index,
  itemStyle,
  showDivider: _showDivider,
  isCustomSection,
  isDraggingOver,
  isCatCollapsed,
  toggleCategory,
  sectionMenuId: _sectionMenuId,
  setSectionMenuId: _setSectionMenuId,
  setDragOverSectionId,
  updateTaskSection,
  setSectionMenu,
  sectionTouchTimer,
  editingSectionId,
  editingSectionName,
  setEditingSectionName,
  saveSectionName,
  startEditingSection,
  setSelectedPersonForProfile,
  sectionTotal,
  durationSummary,
  onOpenNewTask: _onOpenNewTask,
  onAddSection: _onAddSection,
  deleteListSection: _deleteListSection,
  isolatedSectionKey: _isolatedSectionKey,
  setIsolatedSectionKey: _setIsolatedSectionKey,
  isolatedRoutineMode: _isolatedRoutineMode = 'only_section',
  setIsolatedRoutineMode: _setIsolatedRoutineMode,
  sectionRoutineModes = {},
  toggleSectionRoutineMode,
  dragOverSectionId,
  onStartSectionSequence,
  pendingTaskCount,
  isMobile,
  sectionMenu,
  isPrevHeader = false,
  isFirstAfterPageHeader = false
}) => {
  const currentSectionRoutineMode = sectionRoutineModes[data.category] || data.routineMode || 'only_section';
  const [isPressed, setIsPressed] = useState(false);
  const didSectionLongPressRef = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const getRowRect = () => {
    if (!rowRef.current) return undefined;
    const rect = rowRef.current.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  };

  const isMenuOpenForThisSection = Boolean(
    sectionMenu?.open && (
      (sectionMenu.sectionId && sectionMenu.sectionId === data.sectionId) ||
      (sectionMenu.category && sectionMenu.category === data.category)
    )
  );

  const openSectionMenu = useCallback(() => {
    HapticService.selection();
    const rowRect = getRowRect();
    if (!rowRect) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const menuWidth = 230;
    const menuHeight = 220;
    const padding = 12;

    // Anchor: siempre en la posición más lógica (bajo el botón '...' o el título)
    let anchorLeft: number;
    let anchorTop: number;

    if (moreBtnRef.current) {
      const btnRect = moreBtnRef.current.getBoundingClientRect();
      anchorLeft = btnRect.left;
      anchorTop = btnRect.bottom + 6;
    } else {
      anchorLeft = rowRect.left + 28 + (data.depth * 24);
      anchorTop = rowRect.top + rowRect.height + 6;
    }

    // Posición vertical segura: si no cabe abajo, abrir arriba
    let y = anchorTop;
    if (y + menuHeight > viewportH - padding) {
      if (rowRect.top - menuHeight - 6 >= padding) {
        y = rowRect.top - menuHeight - 6;
      } else {
        y = Math.max(padding, viewportH - menuHeight - padding);
      }
    }

    // Posición horizontal segura: alineado con el ancla y dentro de la pantalla
    const x = Math.max(padding, Math.min(anchorLeft, viewportW - menuWidth - padding));

    setSectionMenu({
      open: true,
      x,
      y,
      sectionId: data.sectionId,
      sectionName: data.title,
      pendingTaskCount,
      color: data.color,
      category: data.category,
      triggerRect: rowRect
    });
  }, [data.sectionId, data.title, data.color, data.category, data.depth, pendingTaskCount, setSectionMenu]);

  return (
    <div
      key={itemKey}
      data-index={index}
      ref={rowRef}
      className="group-header"
      style={{ 
        ...itemStyle, 
        position: 'sticky',
        top: data.depth === 0 ? 0 : 48,
        zIndex: isMenuOpenForThisSection ? 999992 : (data.depth === 0 ? 30 : 25),
        borderBottom: '1px solid var(--border-subtle)',
        borderTop: 'none',
        paddingLeft: `calc(28px + ${data.depth * 24}px)`,
        paddingRight: '16px',
        minHeight: data.depth === 0 ? 44 : 38,
        paddingTop: data.depth === 0 ? (isFirstAfterPageHeader ? 4 : isPrevHeader ? 6 : 8) : 5,
        paddingBottom: data.depth === 0 ? 6 : 5,
        margin: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        outline: isDraggingOver ? `2px solid ${data.color}` : undefined,
        background: isDraggingOver 
          ? `${data.color}14` 
          : isMenuOpenForThisSection
          ? 'var(--bg-elevated, #ffffff)'
          : isPressed
          ? 'var(--bg-hover, rgba(0,0,0,0.04))'
          : 'var(--bg-base)',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: isMenuOpenForThisSection ? 10 : 0,
        borderLeft: isMenuOpenForThisSection 
          ? `4px solid ${data.color || 'var(--accent-primary)'}` 
          : isPressed 
          ? '4px solid var(--border-subtle)' 
          : '4px solid transparent',
        transition: 'background 0.15s ease, border-color 0.15s ease, border-radius 0.15s ease'
      }}
      onClick={() => toggleCategory(data.category)}
      onClickCapture={(e) => {
        if (didSectionLongPressRef.current) {
          e.stopPropagation();
          e.preventDefault();
          didSectionLongPressRef.current = false;
        }
      }}
      onDragOver={isCustomSection ? (e) => { e.preventDefault(); setDragOverSectionId(data.sectionId!); } : undefined}
      onDragLeave={isCustomSection ? () => setDragOverSectionId(null) : undefined}
      onDrop={isCustomSection ? (e) => {
        e.preventDefault();
        setDragOverSectionId(null);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) updateTaskSection(taskId, data.sectionId!);
      } : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        openSectionMenu();
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        setIsPressed(true);
        didSectionLongPressRef.current = false;
        if (e.pointerType !== 'touch') return;
        touchStartPos.current = { x: e.clientX, y: e.clientY };
        if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current);
        sectionTouchTimer.current = setTimeout(() => {
          setIsPressed(false);
          didSectionLongPressRef.current = true;
          HapticService.impact('medium');
          openSectionMenu();
        }, 500);
      }}
      onPointerUp={() => { 
        setIsPressed(false);
        if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); 
      }}
      onPointerCancel={() => { 
        setIsPressed(false);
        if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); 
      }}
      onPointerMove={(e) => { 
        if (isPressed && e.pointerType === 'touch') {
          const dx = Math.abs(e.clientX - touchStartPos.current.x);
          const dy = Math.abs(e.clientY - touchStartPos.current.y);
          if (dx > 12 || dy > 12) {
            setIsPressed(false);
            if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current);
          }
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {isCustomSection && editingSectionId === data.sectionId ? (
            <input 
              type="text" 
              value={editingSectionName}
              onChange={e => setEditingSectionName(e.target.value)}
              onBlur={(e) => saveSectionName(e as any, data.sectionId!)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveSectionName(e as any, data.sectionId!);
              }}
              autoFocus
              onClick={e => e.stopPropagation()}
              style={{ background: 'transparent', border: 'none', borderBottom: `2px solid ${data.color}`, color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none' }}
            />
          ) : (
            <h3 
              onDoubleClick={(e) => isCustomSection && startEditingSection(e, data.sectionId!, data.title)}
              style={{ 
                cursor: isCustomSection ? 'text' : 'pointer',
                fontWeight: data.depth === 0 ? 700 : 600,
                color: data.depth === 0 ? 'var(--text-primary)' : data.depth === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontSize: data.depth === 0 ? '1.2rem' : data.depth === 1 ? '1rem' : '0.85rem',
                textTransform: 'none',
                letterSpacing: '0',
                lineHeight: '1.3',
                minHeight: '28px',
                wordBreak: 'break-word',
                margin: 0,
                padding: '4px 0',
                boxSizing: 'border-box'
              }}
              title={isCustomSection ? "Doble click para editar" : ""}
            >
              {data.titleIcon && (
                <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 6, opacity: 0.85 }}>
                  {data.titleIcon}
                </span>
              )}
              {data.title}
            </h3>
          )}
          {data.category.startsWith('persona_') && data.category !== 'persona_solo' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPersonForProfile(data.category.replace('persona_', ''));
              }}
              style={{
                background: 'rgba(88, 86, 214, 0.12)',
                border: '1px solid rgba(88, 86, 214, 0.25)',
                borderRadius: 999,
                color: '#5856D6',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '2px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                marginLeft: 4
              }}
              title="Ver momentos compartidos y relación"
            >
              <span>Ficha</span>
            </button>
          )}
          {sectionTotal > 0 && (
            <span 
              style={{
                fontSize: '0.76rem',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-secondary)',
                background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                border: '1px solid var(--border-subtle)',
                padding: '1.5px 7px',
                borderRadius: '6px',
                marginLeft: '2px',
                flexShrink: 0
              }}
              title="Subtotal de la sección"
            >
              {sectionTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
            </span>
          )}
          {isCustomSection && !isMobile && (
            <button 
              ref={moreBtnRef}
              type="button"
              className="desktop-only-action"
              onClick={(e) => {
                e.stopPropagation();
                openSectionMenu();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4 }}
              title="Opciones de sección"
              aria-label="Opciones de sección"
            >
              <MoreHorizontal size={16} color="var(--text-primary)" />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
          {/* Duración estimada total de la sección */}
          {durationSummary && durationSummary.activeMinutes > 0 && (() => {
            const isFullRoutine = currentSectionRoutineMode === 'full_routine' && Boolean(data.routineCounts && data.routineCounts.full > data.routineCounts.only);
            const titleText = isFullRoutine
              ? `Duración de rutina acumulada: ${durationSummary.formattedActive} (incluye frecuencias anteriores)${durationSummary.parallelTasksCount > 0 ? ` + ${durationSummary.formattedParallel} en paralelo` : ''}`
              : `Duración únicamente de esta sección (${data.title}): ${durationSummary.formattedActive}${durationSummary.parallelTasksCount > 0 ? ` + ${durationSummary.formattedParallel} en paralelo` : ''}`;

            return (
              <span 
                className="section-duration-pill"
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 550,
                  fontVariantNumeric: 'tabular-nums',
                  color: isFullRoutine ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isFullRoutine ? 'rgba(0, 122, 255, 0.08)' : 'var(--bg-hover, rgba(0,0,0,0.04))',
                  border: isFullRoutine ? '1px solid rgba(0, 122, 255, 0.22)' : '1px solid var(--border-subtle)',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3.5,
                  whiteSpace: 'nowrap'
                }}
                title={titleText}
              >
                <Clock size={11} style={{ opacity: 0.8 }} />
                <span>{durationSummary.formattedActive}</span>
                {isFullRoutine && (
                  <span style={{ fontSize: '0.66rem', opacity: 0.8, fontWeight: 600 }}>rutina</span>
                )}
              </span>
            );
          })()}

          {/* Si esta sección tiene periodicidad (no diaria), ESTÁ DESPLEGADA y hay tareas acumulables (full > only), conmutador nativo Apple */}
          {!isCatCollapsed(data.category) && data.periodicity && data.periodicity !== 'day' && data.routineCounts && data.routineCounts.full > data.routineCounts.only ? (
            <div className="apple-segmented-control">
              <button
                type="button"
                className={`apple-segmented-btn ${currentSectionRoutineMode === 'only_section' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  toggleSectionRoutineMode?.(data.category, 'only_section');
                  _setIsolatedSectionKey?.(null);
                }}
                title="Ver únicamente las tareas directas de esta sección"
              >
                Solo ({data.routineCounts.only})
              </button>
              <button
                type="button"
                className={`apple-segmented-btn ${currentSectionRoutineMode === 'full_routine' ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  toggleSectionRoutineMode?.(data.category, 'full_routine');
                  _setIsolatedSectionKey?.(null);
                }}
                title="Ver todas las tareas de la rutina periódica"
              >
                Todas ({data.routineCounts.full})
              </button>
            </div>
          ) : (
            /* Conteo numérico total estilo Apple: visible en Diario, en secciones plegadas, o en secciones sin conmutador de rutinas */
            (() => {
              const count = data.routineCounts 
                ? (currentSectionRoutineMode === 'full_routine' ? data.routineCounts.full : data.routineCounts.only) 
                : (pendingTaskCount ?? data.sectionTaskIds?.length ?? 0);
              return count > 0 ? (
                <span 
                  className="section-total-count"
                  style={{ 
                    fontSize: '0.84rem', 
                    fontWeight: 600, 
                    color: 'var(--text-tertiary)', 
                    fontVariantNumeric: 'tabular-nums',
                    marginRight: 2
                  }}
                  title={`${count} tareas`}
                >
                  {count}
                </span>
              ) : null;
            })()
          )}

          {/* Botón directo Empezar ya esta sección */}
          {onStartSectionSequence && (pendingTaskCount ?? data.sectionTaskIds?.length ?? 0) > 0 && (
            <button
              type="button"
              className="section-start-btn"
              onClick={(e) => {
                e.stopPropagation();
                HapticService.impact('medium');
                onStartSectionSequence();
              }}
              title="Empezar ya esta sección en modo enfoque"
              aria-label="Empezar sección"
              style={{
                background: data.color ? `${data.color}15` : 'rgba(0, 122, 255, 0.12)',
                border: `1px solid ${data.color ? `${data.color}35` : 'rgba(0, 122, 255, 0.25)'}`,
                color: data.color || 'var(--accent-primary)',
                borderRadius: '7px',
                padding: '2px 8px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s ease',
                height: 24,
                flexShrink: 0
              }}
            >
              <Play size={10} fill="currentColor" />
              <span>Empezar</span>
            </button>
          )}

          <button
            type="button"
            className="section-collapse-chevron-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleCategory(data.category);
            }}
            aria-label={isCatCollapsed(data.category) ? "Desplegar sección" : "Plegar sección"}
            aria-expanded={!isCatCollapsed(data.category)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              margin: -4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              flexShrink: 0
            }}
          >
            <ChevronDown 
              size={18} 
              color="currentColor" 
              style={{ 
                transform: isCatCollapsed(data.category) ? 'rotate(-90deg)' : 'rotate(0deg)', 
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)', 
                flexShrink: 0 
              }}
            />
          </button>
        </div>
      </div>
      {isCustomSection && dragOverSectionId === data.sectionId && (
        <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
      )}
    </div>
  );
};
