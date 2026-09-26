import React, { useState, useRef, useCallback } from 'react';
import { MoreHorizontal, ChevronDown, Repeat } from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import type { SectionMenuState } from './SectionContextMenu';
import type { TasksDurationSummary } from '../../../utils/taskDuration';
import { isShoppingList } from '../../../utils/specialLists';
import { useAppStore } from '../../../store/useAppStore';
import { formatEuro } from '../../../utils/format';

interface SectionData {
  title: string;
  titleIcon?: React.ReactNode;
  category: string;
  color: string;
  sectionId?: string;
  depth: number;
  periodicity?: string | null;
  routineCounts?: { full: number; only: number } | null;
  routineDurations?: { only: TasksDurationSummary; full: TasksDurationSummary } | null;
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
  isRoutine?: boolean;
  onReorderSections?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
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
  onStartSectionSequence: _onStartSectionSequence,
  pendingTaskCount,
  isMobile,
  sectionMenu,
  isPrevHeader = false,
  isFirstAfterPageHeader = false,
  isRoutine: _isRoutine = false,
  onReorderSections
}) => {
  const currentSectionRoutineMode = sectionRoutineModes[data.category] || data.routineMode || 'only_section';
  const isShopping = isShoppingList(data.category);
  const durSummary = !isShopping ? (data.routineDurations
    ? (currentSectionRoutineMode === 'full_routine' ? data.routineDurations.full : data.routineDurations.only)
    : durationSummary) : null;
  const sectionDurationLabel = durSummary && durSummary.activeMinutes > 0 ? durSummary.formattedActive : null;
  const [isPressed, setIsPressed] = useState(false);
  const [sectionDragOverPos, setSectionDragOverPos] = useState<'top' | 'bottom' | 'inside' | null>(null);
  const didSectionLongPressRef = useRef(false);
  const sectionTouchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const getRowRect = useCallback(() => {
    if (!rowRef.current) return undefined;
    const rect = rowRef.current.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }, []);

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
    const menuWidth = 260;
    const menuHeight = 360;
    const padding = 12;

    // Anchor: bajo el botón '...' o el título
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

    // Posición vertical: abajo si cabe; si no, arriba para no tapar la cabecera
    let y = anchorTop;
    if (y + menuHeight > viewportH - padding && rowRect.top - menuHeight - 6 >= padding) {
      y = Math.max(padding, rowRect.top - menuHeight - 6);
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
  }, [data.sectionId, data.title, data.color, data.category, data.depth, pendingTaskCount, setSectionMenu, getRowRect]);

  return (
    <div
      key={itemKey}
      data-index={index}
      ref={rowRef}
      className="group-header"
      draggable={isCustomSection && !editingSectionId}
      onDragStart={(e) => {
        if (!isCustomSection || !data.sectionId) return;
        e.stopPropagation();
        e.dataTransfer.setData('text/section-id', data.sectionId);
        e.dataTransfer.setData('text/plain', data.sectionId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{ 
        ...itemStyle, 
        position: 'sticky',
        top: data.depth === 0 ? 0 : 48,
        zIndex: isMenuOpenForThisSection ? 999992 : (data.depth === 0 ? 30 : 25),
        borderBottom: '1px solid var(--border-subtle)',
        borderTop: 'none',
        paddingLeft: `${16 + data.depth * 14}px`,
        paddingRight: '16px',
        minHeight: data.depth === 0 ? 44 : 38,
        paddingTop: data.depth === 0 ? (isFirstAfterPageHeader ? 6 : isPrevHeader ? 8 : 12) : 10,
        paddingBottom: data.depth === 0 ? 8 : 6,
        marginTop: data.depth === 0 ? (isFirstAfterPageHeader ? 2 : 12) : 8,
        marginBottom: 2,
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
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/section-id')) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          const relY = (e.clientY - rect.top) / rect.height;
          if (relY < 0.25) setSectionDragOverPos('top');
          else if (relY > 0.75) setSectionDragOverPos('bottom');
          else setSectionDragOverPos('inside');
        } else if (isCustomSection) {
          e.preventDefault();
          setDragOverSectionId(data.sectionId!);
        }
      }}
      onDragLeave={() => {
        setSectionDragOverPos(null);
        if (isCustomSection) setDragOverSectionId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const curDragPos = sectionDragOverPos;
        setSectionDragOverPos(null);
        setDragOverSectionId(null);

        const droppedSectionId = e.dataTransfer.getData('text/section-id');
        if (droppedSectionId && droppedSectionId !== data.sectionId && data.sectionId) {
          if (curDragPos === 'inside') {
            useAppStore.getState().updateListSection(droppedSectionId, { parentId: data.sectionId });
            HapticService.notification('success');
          } else {
            onReorderSections?.(droppedSectionId, data.sectionId, curDragPos === 'bottom' ? 'after' : 'before');
            HapticService.impact('medium');
          }
          return;
        }

        if (isCustomSection && data.sectionId) {
          const taskId = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain');
          if (taskId) updateTaskSection(taskId, data.sectionId);
        }
      }}
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
      {/* Drop Target Indicators for sections */}
      {sectionDragOverPos === 'top' && (
        <div style={{ position: 'absolute', top: -1, left: 16, right: 16, height: 2, background: 'var(--accent-primary, #007aff)', zIndex: 9999, pointerEvents: 'none' }} />
      )}
      {sectionDragOverPos === 'bottom' && (
        <div style={{ position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, background: 'var(--accent-primary, #007aff)', zIndex: 9999, pointerEvents: 'none' }} />
      )}
      {sectionDragOverPos === 'inside' && (
        <div style={{ position: 'absolute', inset: 3, borderRadius: 8, border: '2px dashed var(--accent-primary, #007aff)', background: 'rgba(0, 122, 255, 0.08)', zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16 }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
            Anidar como subsección
          </span>
        </div>
      )}

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
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {data.titleIcon && !sectionDurationLabel && (
                  <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 2, opacity: 0.85, flexShrink: 0 }}>
                    {data.titleIcon}
                  </span>
                )}
                <h3 
                  onDoubleClick={(e) => isCustomSection && startEditingSection(e, data.sectionId!, data.title)}
                  style={{ 
                    cursor: isCustomSection ? 'text' : 'pointer',
                    fontWeight: data.depth === 0 ? 700 : 600,
                    color: data.depth === 0 ? 'var(--text-primary)' : data.depth === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    fontSize: data.depth === 0 ? '1.18rem' : data.depth === 1 ? '0.94rem' : '0.85rem',
                    textTransform: 'none',
                    letterSpacing: '-0.01em',
                    lineHeight: '1.25',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                    padding: '1px 0',
                    boxSizing: 'border-box'
                  }}
                  title={isCustomSection ? "Doble click para editar" : data.title}
                >
                  {data.title}
                </h3>
              </div>
              {sectionDurationLabel && (
                <div 
                  className="section-duration"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--text-tertiary)',
                    fontSize: data.depth === 0 ? '0.78rem' : '0.72rem',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 1,
                    opacity: 0.9
                  }}
                  title={`Duración estimada de ${data.title}: ${sectionDurationLabel}`}
                >
                  {data.titleIcon || <Repeat size={12} />}
                  <span>~{sectionDurationLabel}</span>
                </div>
              )}
            </div>
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
              {formatEuro(sectionTotal)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
          {/* Conmutador sutil: Solo vs + Diarias (estilo Apple Segmented - solo si la sección está desplegada) */}
          {!isCatCollapsed(data.category) && data.routineCounts && data.routineCounts.full > data.routineCounts.only && (
            <div 
              style={{
                display: 'inline-flex',
                padding: '2px',
                borderRadius: '8px',
                background: 'var(--bg-elevated, rgba(120, 120, 128, 0.12))',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                alignItems: 'center',
                marginRight: 4,
                flexShrink: 0
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  toggleSectionRoutineMode?.(data.category, 'only_section');
                }}
                aria-pressed={currentSectionRoutineMode === 'only_section'}
                style={{
                  border: 'none',
                  background: currentSectionRoutineMode === 'only_section' ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: currentSectionRoutineMode === 'only_section' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: currentSectionRoutineMode === 'only_section' ? 650 : 500,
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: currentSectionRoutineMode === 'only_section' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.12s ease',
                  whiteSpace: 'nowrap'
                }}
                title={`Ver solo tareas de ${data.title} (${data.routineCounts.only})`}
              >
                Solo ({data.routineCounts.only})
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  toggleSectionRoutineMode?.(data.category, 'full_routine');
                }}
                aria-pressed={currentSectionRoutineMode === 'full_routine'}
                style={{
                  border: 'none',
                  background: currentSectionRoutineMode === 'full_routine' ? 'var(--bg-card, #ffffff)' : 'transparent',
                  color: currentSectionRoutineMode === 'full_routine' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: currentSectionRoutineMode === 'full_routine' ? 650 : 500,
                  fontSize: '0.72rem',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: currentSectionRoutineMode === 'full_routine' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.12s ease',
                  whiteSpace: 'nowrap'
                }}
                title={`Incluir tareas de frecuencias anteriores (${data.routineCounts.full})`}
              >
                + Diarias ({data.routineCounts.full})
              </button>
            </div>
          )}
          {/* Conteo numérico sutil estilo Apple */}
          {(() => {
            const count = data.routineCounts 
              ? (currentSectionRoutineMode === 'full_routine' ? data.routineCounts.full : data.routineCounts.only) 
              : (pendingTaskCount ?? data.sectionTaskIds?.length ?? 0);
            return count > 0 ? (
              <span 
                className="section-total-count"
                style={{ 
                  fontSize: '0.88rem', 
                  fontWeight: 500, 
                  color: 'var(--text-tertiary)', 
                  fontVariantNumeric: 'tabular-nums',
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingRight: 2
                }}
                title={`${count} tareas pendientes`}
              >
                {count}
              </span>
            ) : null;
          })()}

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
