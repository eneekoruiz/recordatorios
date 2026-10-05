import React, { useState, useRef, useCallback } from 'react';
import { MoreHorizontal, ChevronDown, Check, Plus, Clock } from 'lucide-react';
import { DurationInfoCard } from '../../ui/DurationInfoCard';
import { HapticService } from '../../../services/HapticService';
import type { SectionMenuState } from './SectionContextMenu';
import { formatSummaryDuration, type TasksDurationSummary } from '../../../utils/taskDuration';
import { isShoppingList, isLifeLibraryList } from '../../../utils/specialLists';
import { useAppStore } from '../../../store/useAppStore';
import { formatEuro } from '../../../utils/format';
import { classifyDropZone, DRAG_MOVE_THRESHOLD_PX } from '../../../utils/dragDrop';
import { getReservedFrequencyColor } from '../../../constants/colors';
import { MetaSplit, MONEY_COLOR } from '../../ui/MetaSplit';
import { routinePeriodLabel, type RoutinePart } from '../../../utils/routineBreakdown';
import { getPeriodContextLabel } from '../../../utils/sectionRoutine';

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
  /** Pendientes de cada frecuencia incluida (de la más larga a la más corta). */
  routineParts?: RoutinePart[] | null;
  routineMode?: 'full_routine' | 'only_section';
  sectionTaskIds?: string[];
  /** Pendientes de esta cabecera (con las incluidas ya mezcladas, si «+ Diarias» está activo). */
  pendingCount?: number;
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
  sectionCompletedTotal?: number;
  durationSummary?: TasksDurationSummary;
  /** Sin «+ Diarias»: lo pendiente repartido en puntuales y frecuencias, si de verdad hay mezcla. */
  mixParts?: RoutinePart[] | null;
  completedDurationSummary?: TasksDurationSummary;
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
  sectionCompletedTotal,
  durationSummary,
  mixParts,
  completedDurationSummary,
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
  const isLibrary = isLifeLibraryList(data.category);
  // Con «+ Diarias» activo, routineDurations.full ya incluye las mezcladas (mismo nivel, sin subcabecera).
  const isFullRoutine = currentSectionRoutineMode === 'full_routine';
  const durSummary = !isShopping && !isLibrary ? (data.routineDurations ? (isFullRoutine ? data.routineDurations.full : data.routineDurations.only) : durationSummary) : null;
  const sectionDurationLabel = durSummary && durSummary.activeMinutes > 0 ? formatSummaryDuration(durSummary.activeMinutes) : null;

  // Corto para caber en el móvil: «+ Diarias» en las semanales, «+ Acumuladas» en mensuales y anuales.
  const includeLabel = data.periodicity === 'week' ? 'Diarias' : 'Acumuladas';

  const periodContext = React.useMemo(() => {
    const effPeriod = (data.periodicity as any) || null;
    if (!effPeriod) return null;
    if (/^\d{4}$/.test((data.title || '').trim())) return null;
    return getPeriodContextLabel(effPeriod, pendingTaskCount ?? 0, sectionTotal);
  }, [data.periodicity, data.title, pendingTaskCount, sectionTotal]);

  const [isSectionDurationOpen, setIsSectionDurationOpen] = useState(false);

  let durationNode: React.ReactNode = null;
  if (sectionDurationLabel && durSummary) {
    durationNode = (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          HapticService.selection();
          setIsSectionDurationOpen(true);
        }}
        className="section-duration-label"
        title="Toca para ver el desglose de tiempo"
        aria-label="Ver desglose de tiempo de sección"
      >
        <Clock size={11} strokeWidth={1.8} className="section-duration-icon" />
        <span>{sectionDurationLabel}</span>
      </button>
    );
  }

  let priceNode: React.ReactNode = null;
  if (sectionTotal > 0 || (sectionCompletedTotal && sectionCompletedTotal > 0)) {
    const paid = sectionCompletedTotal && sectionCompletedTotal > 0 ? sectionCompletedTotal : 0;
    priceNode = (
      <MetaSplit
        label={formatEuro(sectionTotal)}
        parts={paid > 0 ? [
          { id: 'pending', value: sectionTotal, text: `${formatEuro(sectionTotal)} pendientes`, color: MONEY_COLOR, tone: 'solid' },
          { id: 'paid', value: paid, text: `${formatEuro(paid)} pagados`, color: MONEY_COLOR, tone: 'done' },
        ] : []}
        description={paid > 0 ? `Pendiente: ${formatEuro(sectionTotal)} · Ya pagado: ${formatEuro(paid)} · Total original: ${formatEuro(sectionTotal + paid)}` : `Subtotal: ${formatEuro(sectionTotal)}`}
      />
    );
  }
  const [isPressed, setIsPressed] = useState(false);
  const [sectionDragOverPos, setSectionDragOverPos] = useState<'top' | 'bottom' | 'inside' | null>(null);
  // Congela el alto de la fila al entrar: si no, el propio hueco que se abre (DROP_GAP_PX)
  // cambiaría el rect en cada evento y podría oscilar entre zonas.
  const sectionDragOverRectRef = useRef<DOMRect | null>(null);
  const didSectionLongPressRef = useRef(false);
  const sectionTouchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  // Arrastrar con el dedo (mantener pulsado se «arma»; mover de verdad arrastra, quieto abre el menú)
  const [isDraggingTouchSection, setIsDraggingTouchSection] = useState(false);
  const touchSectionGhostRef = useRef<HTMLDivElement | null>(null);
  const touchSectionDragActiveRef = useRef(false);
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
    if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
      return;
    }
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

    if (moreBtnRef.current) {
      const btnRect = moreBtnRef.current.getBoundingClientRect();
      anchorLeft = btnRect.left;
    } else {
      anchorLeft = rowRect.left + 28 + (data.depth * 24);
    }
    // Siempre anclado por debajo de la fila completa de la cabecera
    const anchorTop = rowRect.top + rowRect.height + 6;

    // Posición vertical: abajo si cabe; si no, arriba para no tapar nunca la cabecera
    const spaceBelow = Math.max(0, viewportH - anchorTop - padding);
    const spaceAbove = Math.max(0, rowRect.top - 6 - padding);
    let y = anchorTop;
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      y = Math.max(padding, rowRect.top - Math.min(menuHeight, spaceAbove) - 6);
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
      triggerRect: rowRect,
      getTriggerElement: () => rowRef.current
    });
  }, [data.sectionId, data.title, data.color, data.category, data.depth, pendingTaskCount, setSectionMenu, getRowRect]);

  // Arrastre táctil de la sección: se arma al mantener pulsado; si luego el dedo se mueve de
  // verdad, arrastra (reordenar o anidar); si se suelta sin moverse, abre el menú de la sección.
  // Igual que en las tareas: así una misma pulsación mantenida nunca es ambigua.
  const startSectionTouchDrag = useCallback((startY: number, startX: number) => {
    const sectionId = data.sectionId;
    if (!sectionId || !rowRef.current) return;
    const rect = rowRef.current.getBoundingClientRect();

    const createGhost = () => {
      if (!rowRef.current) return;
      const cloned = rowRef.current.cloneNode(true) as HTMLDivElement;
      cloned.querySelectorAll('[data-section-drag-ghost]').forEach(el => el.remove());
      const ghost = document.createElement('div');
      ghost.setAttribute('data-section-drag-ghost', 'true');
      ghost.style.cssText = `
        position:fixed;
        left:${rect.left}px;
        top:${startY - rect.height / 2}px;
        width:${rect.width}px;
        height:${rect.height}px;
        pointer-events:none;
        z-index:999999;
        border-radius:12px;
        box-shadow:0 10px 36px rgba(0,0,0,0.28),0 0 0 2px ${data.color || 'var(--accent-primary,#007aff)'};
        opacity:0.95;
        transform:scale(1.02);
        overflow:hidden;
        background:var(--bg-base);
      `;
      ghost.appendChild(cloned);
      document.body.appendChild(ghost);
      touchSectionGhostRef.current = ghost;
      setIsDraggingTouchSection(true);
      HapticService.impact('medium');
    };

    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      ev.preventDefault();
      const moved = Math.abs(t.clientY - startY) > DRAG_MOVE_THRESHOLD_PX || Math.abs(t.clientX - startX) > DRAG_MOVE_THRESHOLD_PX;
      if (!moved && !touchSectionDragActiveRef.current) return;
      if (!touchSectionDragActiveRef.current) createGhost();
      touchSectionDragActiveRef.current = true;
      if (touchSectionGhostRef.current) {
        touchSectionGhostRef.current.style.top = `${t.clientY - rect.height / 2}px`;
      }
      document.querySelectorAll<HTMLElement>('[data-section-drag-key]').forEach((el) => {
        if (el.getAttribute('data-section-drag-key') === sectionId) {
          el.removeAttribute('data-section-drag-over');
          return;
        }
        const elRect = el.getBoundingClientRect();
        if (t.clientY >= elRect.top && t.clientY <= elRect.bottom) {
          const relY = (t.clientY - elRect.top) / elRect.height;
          el.setAttribute('data-section-drag-over', classifyDropZone(relY));
        } else {
          el.removeAttribute('data-section-drag-over');
        }
      });
    };

    const cleanup = () => {
      document.removeEventListener('touchmove', onMove);
      if (touchSectionGhostRef.current) {
        document.body.removeChild(touchSectionGhostRef.current);
        touchSectionGhostRef.current = null;
      }
      document.querySelectorAll<HTMLElement>('[data-section-drag-over]').forEach(el => el.removeAttribute('data-section-drag-over'));
      setIsDraggingTouchSection(false);
      document.body.style.overflow = '';
    };

    const onEnd = () => {
      const wasActive = touchSectionDragActiveRef.current;
      let targetId: string | null = null;
      let dropAction: 'top' | 'bottom' | 'inside' = 'top';
      if (wasActive) {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-section-drag-key]'));
        for (const el of candidates) {
          const attr = el.getAttribute('data-section-drag-over');
          if (attr) {
            targetId = el.getAttribute('data-section-drag-key');
            dropAction = attr as 'top' | 'bottom' | 'inside';
          }
        }
      }
      cleanup();
      touchSectionDragActiveRef.current = false;

      if (wasActive) {
        if (targetId && targetId !== sectionId) {
          if (dropAction === 'inside') {
            useAppStore.getState().updateListSection(sectionId, { parentId: targetId });
            HapticService.notification('success');
          } else {
            onReorderSections?.(sectionId, targetId, dropAction === 'bottom' ? 'after' : 'before');
            HapticService.impact('medium');
          }
        }
      } else {
        openSectionMenu();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { once: true });
    document.addEventListener('touchcancel', () => {
      touchSectionDragActiveRef.current = false;
      cleanup();
    }, { once: true });
  }, [data.sectionId, data.color, onReorderSections, openSectionMenu]);

  return (
    <div
      key={itemKey}
      data-index={index}
      ref={rowRef}
      className="group-header"
      draggable={!isMobile && isCustomSection && !editingSectionId}
      data-section-drag-key={data.sectionId}
      // Solo reordenar (no anidar) necesita abrir hueco por CSS — "inside" ya lo resuelve el
      // anillo de abajo (con el color de la sección), así que no se refleja aquí para no duplicarlo.
      data-section-drag-over={sectionDragOverPos === 'top' || sectionDragOverPos === 'bottom' ? sectionDragOverPos : undefined}
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
        opacity: isDraggingTouchSection ? 0.35 : 1,
        touchAction: isDraggingTouchSection ? 'none' : undefined,
        transition: 'background 0.15s ease, border-color 0.15s ease, border-radius 0.15s ease, opacity 0.15s ease, margin-top 0.18s cubic-bezier(0.22,1,0.36,1), margin-bottom 0.18s cubic-bezier(0.22,1,0.36,1)'
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
          if (!sectionDragOverRectRef.current) {
            sectionDragOverRectRef.current = e.currentTarget.getBoundingClientRect();
          }
          const rect = sectionDragOverRectRef.current;
          const relY = (e.clientY - rect.top) / rect.height;
          setSectionDragOverPos(classifyDropZone(relY));
        } else if (isCustomSection) {
          e.preventDefault();
          setDragOverSectionId(data.sectionId!);
        }
      }}
      onDragLeave={() => {
        sectionDragOverRectRef.current = null;
        setSectionDragOverPos(null);
        if (isCustomSection) setDragOverSectionId(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const curDragPos = sectionDragOverPos;
        sectionDragOverRectRef.current = null;
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
        e.stopPropagation();
        if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
          return;
        }
        openSectionMenu();
      }}
      onPointerDown={(e) => {
        if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
          return;
        }
        if ((e.target as HTMLElement).closest('button, input')) return;
        setIsPressed(true);
        didSectionLongPressRef.current = false;
        if (e.pointerType !== 'touch' || !isCustomSection) return;
        // Mantener pulsado «arma» el gesto; startSectionTouchDrag decide, al soltar o al moverse
        // de verdad, si era para abrir el menú o para arrastrar (reordenar o anidar).
        touchStartPos.current = { x: e.clientX, y: e.clientY };
        const sx = e.clientX, sy = e.clientY;
        if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current);
        sectionTouchTimer.current = setTimeout(() => {
          sectionTouchTimer.current = null;
          setIsPressed(false);
          didSectionLongPressRef.current = true;
          startSectionTouchDrag(sy, sx);
        }, 380);
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
        // Solo mientras se espera a que el gesto se arme: si hay movimiento grande antes de
        // eso, es un scroll de la lista, no una pulsación mantenida sobre esta fila.
        if (sectionTouchTimer.current && e.pointerType === 'touch') {
          const dx = Math.abs(e.clientX - touchStartPos.current.x);
          const dy = Math.abs(e.clientY - touchStartPos.current.y);
          if (dx > 20 || dy > 20) {
            setIsPressed(false);
            clearTimeout(sectionTouchTimer.current);
            sectionTouchTimer.current = null;
          }
        }
      }}
    >
      {/* El hueco y la línea de "top"/"bottom" los pinta el CSS (.group-header[data-section-drag-over])
          en polish.css, compartido con el arrastre táctil. Anidar no reordena (no hay hueco),
          así que aquí solo un anillo fino (nunca un recuadro relleno) con el color de la sección. */}
      {sectionDragOverPos === 'inside' && (
        <div style={{ position: 'absolute', inset: 3, borderRadius: 8, boxShadow: `inset 0 0 0 2px ${data.color || 'var(--accent-primary, #007aff)'}`, zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16 }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#fff', background: data.color || 'var(--accent-primary, #007aff)', padding: '2px 8px', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center', flex: '1 1 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'nowrap' }}>
                {data.titleIcon && (
                  <span style={{ display: 'inline-flex', verticalAlign: '-2px', marginRight: 2, opacity: 0.85, flexShrink: 0 }}>
                    {data.titleIcon}
                  </span>
                )}
                <h3 
                  aria-level={2}
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
                    boxSizing: 'border-box',
                    flexShrink: 1
                  }}
                  title={isCustomSection ? "Doble click para editar" : data.title}
                >
                  {data.title}
                </h3>
                {periodContext && (
                  <span 
                    className="section-period-context-badge"
                    title={periodContext.isRolledOver ? 'Período actual completado · Mostrando siguiente ciclo' : 'Período en curso'}
                    style={{
                      marginLeft: 4,
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      color: periodContext.isRolledOver ? 'var(--accent-green, #34c759)' : 'var(--text-tertiary)',
                      letterSpacing: '-0.01em',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      flexShrink: 0
                    }}
                  >
                    {periodContext.isRolledOver && <Check size={11} strokeWidth={2.5} />}
                    {periodContext.label}
                  </span>
                )}
                {!isMobile && durationNode && (
                  <div className="section-duration section-meta" style={{ marginLeft: 6, flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
                    {durationNode}
                  </div>
                )}
              </div>
              {((isMobile && durationNode) || priceNode) && (
                <div
                  className="section-duration section-meta"
                  style={{ fontSize: data.depth === 0 ? '0.8rem' : '0.74rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}
                >
                  {isMobile && durationNode}
                  {priceNode}
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
          {isCustomSection && !isMobile && (
            <button 
              ref={moreBtnRef}
              type="button"
              className="desktop-only-action section-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                openSectionMenu();
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              title="Opciones de sección"
              aria-label="Opciones de sección"
              aria-haspopup="menu"
              aria-expanded={isMenuOpenForThisSection}
            >
              <MoreHorizontal size={16} color="var(--text-primary)" />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, justifyContent: 'flex-end' }}>
          {/* Incluir las frecuencias anteriores: una cápsula que se enciende (con la sección desplegada) */}
          {!isCatCollapsed(data.category) && data.routineCounts && data.routineCounts.full > data.routineCounts.only && (
            <button
              type="button"
              className={`routine-chip${isFullRoutine ? ' is-on' : ''}`}
              aria-pressed={isFullRoutine}
              aria-label={`Incluir ${includeLabel.toLowerCase()}`}
              style={{ ['--chip-color' as string]: data.color }}
              onClick={(e) => {
                e.stopPropagation();
                HapticService.selection();
                toggleSectionRoutineMode?.(data.category, isFullRoutine ? 'only_section' : 'full_routine');
              }}
              title={isFullRoutine ? `Mostrando también ${includeLabel.toLowerCase()}` : `Incluir ${includeLabel.toLowerCase()}`}
            >
              {isFullRoutine ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <Plus size={12} strokeWidth={2.6} aria-hidden="true" />}
              <span>{includeLabel}</span>
            </button>
          )}
          {/* Conteo numérico sutil estilo Apple: total y desglose (propias + incluidas) si «+ Diarias» está activo */}
          {(() => {
            const count = data.pendingCount ?? pendingTaskCount ?? data.sectionTaskIds?.length ?? 0;
            if (count <= 0) return null;

            const hasRoutineBreakdown = isFullRoutine && Boolean(data.routineCounts && data.routineCounts.full > data.routineCounts.only);
            const onlyCount = data.routineCounts?.only ?? count;
            const extraCount = hasRoutineBreakdown ? (data.routineCounts!.full - data.routineCounts!.only) : 0;

            const ownLabel = data.periodicity === 'week' ? 'semanales' : data.periodicity === 'month' ? 'mensuales' : data.periodicity === 'year' ? 'anuales' : 'propias';
            const extraLabel = data.periodicity === 'week' ? 'diarias' : 'acumuladas';
            const countParts = hasRoutineBreakdown && data.routineParts && data.routineParts.length > 1
              ? data.routineParts.map((rp) => ({ id: rp.periodicity, n: rp.count, color: getReservedFrequencyColor(rp.periodicity), label: routinePeriodLabel(rp.periodicity) }))
              : hasRoutineBreakdown
                ? [
                    { id: 'own', n: onlyCount, color: getReservedFrequencyColor(data.periodicity), label: ownLabel },
                    { id: 'extra', n: extraCount, color: data.periodicity === 'week' ? getReservedFrequencyColor('day') : 'var(--text-tertiary)', label: extraLabel },
                  ]
                : [];

            const tooltipText = hasRoutineBreakdown
              ? `${count} tareas totales (${countParts.map(cp => `${cp.n} ${cp.label}`).join(' + ')})`
              : `${count} tareas pendientes`;

            return (
              <span 
                className="section-total-count"
                title={tooltipText}
              >
                <span className="section-main-count">{count}</span>
                {hasRoutineBreakdown && countParts.length > 0 && (
                  <span 
                    className="section-routine-breakdown"
                  >
                    <span style={{ opacity: 0.35 }}>(</span>
                    {countParts.map((cp, i) => (
                      <React.Fragment key={cp.id}>
                        {i > 0 && <span style={{ opacity: 0.35, fontSize: '0.62rem', margin: '0 1px' }}> + </span>}
                        <span style={{ color: cp.color }}>{cp.n}</span>
                      </React.Fragment>
                    ))}
                    <span style={{ opacity: 0.35 }}>)</span>
                  </span>
                )}
              </span>
            );
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

      {durSummary && durSummary.activeMinutes > 0 && (
        <DurationInfoCard
          isOpen={isSectionDurationOpen}
          onClose={() => setIsSectionDurationOpen(false)}
          title={data.title}
          color={data.color}
          totalSummary={durSummary}
          completedSummary={completedDurationSummary}
          routineParts={data.routineParts}
          mixParts={mixParts}
          onStartSequence={_onStartSectionSequence}
          pendingCount={data.pendingCount ?? pendingTaskCount ?? data.sectionTaskIds?.length}
        />
      )}
    </div>
  );
};
