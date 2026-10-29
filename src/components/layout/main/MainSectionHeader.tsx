import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { MoreHorizontal, ChevronDown, Check, Plus, Play, Flame } from 'lucide-react';
import { DurationInfoCard } from '../../ui/DurationInfoCard';
import { HapticService } from '../../../services/HapticService';
import type { SectionMenuState } from './SectionContextMenu';
import { formatSummaryDuration, type TasksDurationSummary } from '../../../utils/taskDuration';
import { isShoppingList, isLifeLibraryList } from '../../../utils/specialLists';
import { useAppStore } from '../../../store/useAppStore';
import { formatEuro } from '../../../utils/format';
import { classifyDropZone, DRAG_MOVE_THRESHOLD_PX, createEdgeAutoScroll, findScrollableParent, relativeYInRow, dropTargetAt, guardNativeScroll, createDragGhost } from '../../../utils/dragDrop';
import { MetaSplit, MONEY_COLOR } from '../../ui/MetaSplit';
import { routinePeriodLabel, type RoutinePart } from '../../../utils/routineBreakdown';
import { getPeriodContextLabel } from '../../../utils/sectionRoutine';
import { TRAINING_DAY_LABEL, type TrainingDayStatus } from '../../../utils/trainingDays';

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
  totalCount?: number;
  /** Periodo actual ya hecho: las tareas que se ven son del siguiente. */
  rolledOver?: boolean;
  /** Por eso empieza plegada (mientras no se abra o pliegue a mano). */
  foldedByDefault?: boolean;
  /** Programa por días: si este día toca hoy, es el siguiente u otro. */
  trainingDay?: TrainingDayStatus;
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
  /** `shownCollapsed`: si la cabecera se ve plegada ahora (lo que se va a invertir). */
  toggleCategory: (cat: string, shownCollapsed?: boolean) => void;
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
  /** Botón ▶ visible: en vistas de frecuencia, donde las cabeceras son listas y no tienen menú «···». */
  showStartButton?: boolean;
  pendingTaskCount?: number;
  totalTaskCount?: number;
  isMobile?: boolean;
  sectionMenu?: SectionMenuState;
  isPrevHeader?: boolean;
  isFirstAfterPageHeader?: boolean;
  isRoutine?: boolean;
  hidePeriodContext?: boolean;
  referenceDate?: Date;
  onReorderSections?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
  isActiveGymDay?: boolean;
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
  showStartButton = false,
  pendingTaskCount,
  totalTaskCount,
  isMobile,
  sectionMenu,
  isPrevHeader: _isPrevHeader = false,
  isFirstAfterPageHeader = false,
  isRoutine: _isRoutine = false,
  hidePeriodContext,
  referenceDate,
  onReorderSections,
  isActiveGymDay,
}) => {
  const currentSectionRoutineMode = sectionRoutineModes[data.category] || data.routineMode || 'only_section';
  const isShopping = isShoppingList(data.category);
  const isLibrary = isLifeLibraryList(data.category);
  // Con '+ Diarias' activo, routineDurations.full ya incluye las mezcladas (mismo nivel, sin subcabecera).
  const isFullRoutine = currentSectionRoutineMode === 'full_routine';
  const durSummary = !isShopping && !isLibrary ? (data.routineDurations ? (isFullRoutine ? data.routineDurations.full : data.routineDurations.only) : durationSummary) : null;
  const sectionDurationLabel = durSummary && durSummary.activeMinutes > 0 ? formatSummaryDuration(durSummary.activeMinutes) : null;

  // Qué añade «Rutina completa» en cada frecuencia (se dice en el aria-label y en el title).
  const includedScope = data.periodicity === 'week'
    ? 'las diarias'
    : data.periodicity === 'month'
      ? 'las semanales y diarias'
      : data.periodicity === 'year'
        ? 'las mensuales, semanales y diarias'
        : 'las de frecuencia más corta';

  const periodContext = React.useMemo(() => {
    if (hidePeriodContext) return null;
    const effPeriod = (data.periodicity as any) || null;
    if (!effPeriod) return null;
    if (/^\d{4}$/.test((data.title || '').trim())) return null;
    const effPending = pendingTaskCount !== undefined ? pendingTaskCount : (data.pendingCount !== undefined ? data.pendingCount : 0);
    const effTotal = totalTaskCount !== undefined ? totalTaskCount : (data.totalCount !== undefined ? data.totalCount : (data.sectionTaskIds?.length || 0));
    return getPeriodContextLabel(effPeriod, effPending, effTotal, referenceDate || new Date());
  }, [data.periodicity, data.title, data.pendingCount, data.totalCount, pendingTaskCount, totalTaskCount, data.sectionTaskIds, referenceDate, hidePeriodContext]);

  const [isSectionDurationOpen, setIsSectionDurationOpen] = useState(false);

  const hasAccumulatedBreakdown = isFullRoutine && Boolean(data.routineCounts);
  const hasMixBreakdown = Boolean(mixParts && mixParts.length > 1);
  const canShowDurationBreakdown = hasAccumulatedBreakdown || hasMixBreakdown;

  // La duración es texto; si hay desglose que ver, el mismo texto es el botón (sin icono ni flecha).
  let durationNode: React.ReactNode = null;
  // Con una sola tarea pendiente su fila ya muestra la duración: repetirla aquí no aporta nada.
  const onlyOneTask = (pendingTaskCount ?? data.pendingCount) === 1;
  if (data.depth === 0 && sectionDurationLabel && durSummary && !(onlyOneTask && !canShowDurationBreakdown)) {
    if (canShowDurationBreakdown) {
      durationNode = (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            HapticService.selection();
            setIsSectionDurationOpen(true);
          }}
          className="section-head-duration is-button"
          title="Ver desglose de tiempo"
          aria-label={`${sectionDurationLabel}. Ver desglose de tiempo de ${data.title}`}
        >
          {sectionDurationLabel}
        </button>
      );
    } else {
      durationNode = (
        <span className="section-head-duration" title={`Tiempo estimado: ~${sectionDurationLabel}`}>
          {sectionDurationLabel}
        </span>
      );
    }
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
  const didSectionLongPressRef = useRef(false);
  const sectionTouchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rowRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  // Arrastrar con el dedo (mantener pulsado se «arma»; mover de verdad arrastra, quieto abre el menú)
  const [isDraggingTouchSection, setIsDraggingTouchSection] = useState(false);
  const touchSectionGhostRef = useRef<ReturnType<typeof createDragGhost> | null>(null);
  // Armado tras la pulsación larga: desde ahí se cancela el scroll nativo de iOS (ver guardNativeScroll).
  const sectionTouchArmedRef = useRef(false);
  // Publica la altura real de la cabecera principal en su bloque (.section-container) para que las
  // subsecciones fijas se peguen exactamente debajo.
  useLayoutEffect(() => {
    const el = rowRef.current;
    const block = el?.parentElement;
    if (!el || !block || data.depth !== 0) return;
    const publish = () => block.style.setProperty('--section-sticky-h', `${el.getBoundingClientRect().height}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, [data.depth]);
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    return guardNativeScroll(el, () => sectionTouchArmedRef.current || touchSectionDragActiveRef.current);
  }, []);
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

    const btnRect = moreBtnRef.current?.getBoundingClientRect();
    // El «···» puede estar oculto (táctil con la sección plegada): entonces se ancla al título.
    if (btnRect && btnRect.width > 0) {
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
    sectionTouchArmedRef.current = true;

    const createGhost = () => {
      if (!rowRef.current) return;
      touchSectionGhostRef.current = createDragGhost(rowRef.current, startY, ['data-section-drag-key']);
      setIsDraggingTouchSection(true);
      HapticService.impact('medium');
    };

    // Objetivo estable: la cabecera bajo el dedo, conservada mientras siga en ella o en su hueco
    // (el hueco la desplaza; recalcular por rectángulos hacía que el objetivo saltase).
    let target: HTMLElement | null = null;
    let lastX = startX;
    let lastY = startY;
    const clearTarget = () => {
      target?.removeAttribute('data-section-drag-over');
      target = null;
    };
    const updateTarget = () => {
      let next: HTMLElement | null = null;
      if (target?.isConnected) {
        const rel = relativeYInRow(target, lastY);
        const slack = 26 / target.getBoundingClientRect().height;
        if (rel >= -slack && rel <= 1 + slack) next = target;
      }
      if (!next) {
        next = dropTargetAt(lastX, lastY, '[data-section-drag-key]');
        if (next?.getAttribute('data-section-drag-key') === sectionId) next = null;
      }
      if (next !== target) clearTarget();
      target = next;
      if (!target) return;
      const zone = classifyDropZone(relativeYInRow(target, lastY));
      if (target.getAttribute('data-section-drag-over') !== zone) target.setAttribute('data-section-drag-over', zone);
    };
    const autoScroll = createEdgeAutoScroll(findScrollableParent(rowRef.current), updateTarget);

    const onMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (ev.cancelable) ev.preventDefault();
      const moved = Math.abs(t.clientY - startY) > DRAG_MOVE_THRESHOLD_PX || Math.abs(t.clientX - startX) > DRAG_MOVE_THRESHOLD_PX;
      if (!moved && !touchSectionDragActiveRef.current) return;
      if (!touchSectionDragActiveRef.current) createGhost();
      touchSectionDragActiveRef.current = true;
      touchSectionGhostRef.current?.move(t.clientY);
      lastX = t.clientX;
      lastY = t.clientY;
      autoScroll.update(lastY);
      updateTarget();
    };

    // Un solo final para soltar y para cancelar, que quita todas las escuchas a la vez.
    const finish = (commit: boolean) => {
      const wasActive = touchSectionDragActiveRef.current;
      let targetId: string | null = null;
      let dropAction: 'top' | 'bottom' | 'inside' = 'top';
      if (commit && wasActive && target) {
        targetId = target.getAttribute('data-section-drag-key');
        dropAction = (target.getAttribute('data-section-drag-over') as 'top' | 'bottom' | 'inside' | null) || 'top';
      }
      autoScroll.stop();
      clearTarget();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      touchSectionGhostRef.current?.remove();
      touchSectionGhostRef.current = null;
      setIsDraggingTouchSection(false);
      document.body.style.overflow = '';
      touchSectionDragActiveRef.current = false;
      sectionTouchArmedRef.current = false;
      if (!commit) return;

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
    const onEnd = () => finish(true);
    const onCancel = () => finish(false);

    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onCancel);
  }, [data.sectionId, onReorderSections, openSectionMenu]);

  const isTopLevel = data.depth === 0;
  const isExpanded = !(data.foldedByDefault || isCatCollapsed(data.category));
  const canIncludeShorter = Boolean(data.routineCounts);
  // El interruptor solo aparece donde se usa: con la sección abierta, o si ya está encendido
  // (para que se vea qué está sumando el número aunque la sección esté plegada).
  const showRoutineToggle = isTopLevel && canIncludeShorter && (isExpanded || isFullRoutine);
  // Periodo hecho y lo de debajo es del siguiente («Octubre hecho»): se dice también en las
  // subsecciones, que empiezan plegadas; al abrir, se aclara de cuándo son las tareas que se ven.
  const showsNextPeriod = Boolean(data.rolledOver && periodContext?.isRolledOver);
  const periodText = (isTopLevel || showsNextPeriod) && periodContext ? periodContext.compactLabel : null;
  const nextPeriodNote = showsNextPeriod && isExpanded ? periodContext?.nextLabel ?? null : null;
  // La duración y el precio de esas tareas del siguiente periodo parecerían pendientes de ahora.
  if (showsNextPeriod) {
    durationNode = null;
    priceNode = null;
  }
  // Si lo único que habría en la segunda línea es la duración, va junto al nombre, en gris: una
  // línea entera para «28 min» alejaba las tareas de su cabecera.
  const durationInline = isTopLevel && Boolean(durationNode) && !periodText && !priceNode && !showRoutineToggle;
  const hasSubRow = (isTopLevel || showsNextPeriod) && !durationInline && Boolean(periodText || durationNode || priceNode || showRoutineToggle);

  const headerCount = data.pendingCount ?? pendingTaskCount ?? data.sectionTaskIds?.length ?? 0;
  const countTooltip = (() => {
    if (!(isFullRoutine && canIncludeShorter)) return `${headerCount} pendientes`;
    const parts = (data.routineParts || []).filter(rp => rp.count > 0);
    if (parts.length > 1) {
      return `${headerCount} pendientes: ${parts.map(rp => `${rp.count} ${routinePeriodLabel(rp.periodicity)}`).join(' + ')}`;
    }
    const own = data.routineCounts!.only;
    const extra = data.routineCounts!.full - own;
    const ownLabel = data.periodicity === 'week' ? 'semanales' : data.periodicity === 'month' ? 'mensuales' : data.periodicity === 'year' ? 'anuales' : 'propias';
    const extraLabel = data.periodicity === 'week' ? 'diarias' : 'de frecuencia más corta';
    return `${headerCount} pendientes: ${own} ${ownLabel} + ${extra} ${extraLabel}`;
  })();

  const moreButton = isCustomSection ? (
    <button
      ref={moreBtnRef}
      type="button"
      className="section-more-btn section-head-more"
      onClick={(e) => {
        e.stopPropagation();
        openSectionMenu();
      }}
      title="Opciones de sección"
      aria-label={`Opciones de ${data.title}`}
      aria-haspopup="menu"
      aria-expanded={isMenuOpenForThisSection}
    >
      <MoreHorizontal size={17} color="currentColor" />
    </button>
  ) : null;

  return (
    <div
      key={itemKey}
      data-index={index}
      ref={rowRef}
      className="group-header"
      data-expanded={isExpanded ? 'true' : 'false'}
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
        // Las subsecciones se pegan justo debajo de la cabecera principal de su bloque, mida lo que
        // mida (una línea, dos líneas…): con 56 px fijos quedaba un hueco por el que se leían las
        // tareas de detrás, o la subsección se metía debajo y se cortaba.
        top: data.depth === 0 ? 0 : 'var(--section-sticky-h, 56px)',
        zIndex: isMenuOpenForThisSection ? 999992 : Math.max(10, 30 - data.depth),
        borderBottom: data.depth === 0 ? '1px solid var(--border-subtle)' : 'none',
        borderTop: 'none',
        paddingLeft: `${16 + data.depth * 14}px`,
        paddingRight: '16px',
        minHeight: data.depth === 0 ? 52 : 44,
        paddingTop: data.depth === 0 ? (isFirstAfterPageHeader ? 6 : 10) : 4,
        paddingBottom: data.depth === 0 ? 8 : 4,
        marginTop: 0,
        marginBottom: 4,
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
          : 'var(--bg-base, #ffffff)',
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
      onClick={() => toggleCategory(data.category, !isExpanded)}
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
          setSectionDragOverPos(classifyDropZone(relativeYInRow(e.currentTarget as HTMLElement, e.clientY)));
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

      {/* Cabecera en dos líneas como mucho:
          1) nombre ........................ número  ⌄
          2) periodo · duración   [Rutina completa]   ···   (solo secciones de primer nivel con algo que contar)
          Las habitaciones/subsecciones son una sola línea: icono, nombre, número y flecha. */}
      <div className="section-head" data-depth={data.depth === 0 ? 'top' : 'nested'}>
        <div className="section-head-main">
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
              aria-label="Nombre de la sección"
              onClick={e => e.stopPropagation()}
              className="section-head-input"
              style={{ borderBottomColor: data.color }}
            />
          ) : (
            <>
              {data.titleIcon && (
                <span className="section-head-icon" aria-hidden="true">{data.titleIcon}</span>
              )}
              <h3
                aria-level={2}
                className="section-head-title"
                onDoubleClick={(e) => isCustomSection && startEditingSection(e, data.sectionId!, data.title)}
                style={{ cursor: isCustomSection ? 'text' : 'pointer' }}
                title={isCustomSection ? 'Doble clic para editar' : data.title}
              >
                {data.title}
              </h3>
              {isActiveGymDay && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(255, 149, 0, 0.15)',
                    color: '#ff9500',
                    border: '1px solid rgba(255, 149, 0, 0.3)',
                    flexShrink: 0,
                  }}
                >
                  <Flame size={12} /> Día activo
                </span>
              )}
              {durationInline && <span className="section-head-meta section-head-inline section-duration">{durationNode}</span>}
            </>
          )}
        </div>

        <div className="section-head-trailing">
          {data.category.startsWith('persona_') && data.category !== 'persona_solo' && (
            <button
              type="button"
              className="section-head-link"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPersonForProfile(data.category.replace('persona_', ''));
              }}
              title="Ver momentos compartidos y relación"
            >
              Ficha
            </button>
          )}
          {!hasSubRow && priceNode && <span className="section-head-price">{priceNode}</span>}
          {showStartButton && _onStartSectionSequence && (
            <button
              type="button"
              className="section-head-start"
              onClick={(e) => {
                e.stopPropagation();
                HapticService.selection();
                _onStartSectionSequence();
              }}
              aria-label={`Empezar ${data.title}`}
              title={`Empezar ${data.title}`}
              style={{ ['--start-color' as string]: data.color || 'var(--accent-primary)' }}
            >
              <Play size={13} fill="currentColor" aria-hidden="true" />
            </button>
          )}
          {moreButton}
          {headerCount > 0 && (
            <span className="section-head-count" title={countTooltip}>
              {headerCount}
            </span>
          )}
          <button
            type="button"
            className="section-collapse-chevron-btn section-head-chevron"
            onClick={(e) => {
              e.stopPropagation();
              toggleCategory(data.category, !isExpanded);
            }}
            aria-label={isExpanded ? `Plegar ${data.title}` : `Desplegar ${data.title}`}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              size={17}
              strokeWidth={2.2}
              color="currentColor"
              style={{
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            />
          </button>
        </div>

        {data.trainingDay && (
          <div className="section-head-sub">
            <span className={`section-head-training is-${data.trainingDay}`} data-testid="training-day-badge">
              {data.trainingDay === 'done_today' && <Check size={12} strokeWidth={2.6} aria-hidden="true" />}
              {TRAINING_DAY_LABEL[data.trainingDay]}
            </span>
          </div>
        )}
        {hasSubRow && (
          <div className="section-head-sub">
            <span className="section-head-meta section-duration">
              {periodText && (
                <span
                  className={`section-head-period${periodContext?.isRolledOver ? ' is-done' : ''}`}
                  title={periodContext?.label}
                >
                  {periodContext?.isRolledOver && <Check size={12} strokeWidth={2.6} aria-hidden="true" />}
                  {/* Cabe en la misma línea si no hay interruptor; si lo hay, va debajo (ver más abajo). */}
                  <span>
                    {periodText}
                    {nextPeriodNote && !showRoutineToggle && <span className="section-head-next">, {nextPeriodNote}</span>}
                  </span>
                </span>
              )}
              {periodText && (durationNode || priceNode) && <span className="section-head-dot" aria-hidden="true">·</span>}
              {durationNode}
              {durationNode && priceNode && <span className="section-head-dot" aria-hidden="true">·</span>}
              {priceNode}
            </span>
            {showRoutineToggle && (
              <button
                type="button"
                className={`routine-chip-btn${isFullRoutine ? ' is-on' : ''}`}
                aria-pressed={isFullRoutine}
                aria-label={`Rutina completa: incluir ${includedScope}`}
                style={{ ['--chip-color' as string]: data.color }}
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  toggleSectionRoutineMode?.(data.category, isFullRoutine ? 'only_section' : 'full_routine');
                }}
                title={isFullRoutine ? `Incluye también ${includedScope}` : `Incluir también ${includedScope}`}
              >
                {/* La cápsula visible mide 26 px; el botón que la contiene, 44 px (zona táctil real). */}
                <span className={`routine-chip${isFullRoutine ? ' is-on' : ''}`}>
                  {isFullRoutine ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <Plus size={12} strokeWidth={2.6} aria-hidden="true" />}
                  <span>Rutina completa</span>
                </span>
              </button>
            )}
            {nextPeriodNote && showRoutineToggle && (
              <span className="section-head-note">{nextPeriodNote.charAt(0).toUpperCase() + nextPeriodNote.slice(1)}</span>
            )}
          </div>
        )}
      </div>
      {isCustomSection && dragOverSectionId === data.sectionId && (
        <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
      )}

      {canShowDurationBreakdown && durSummary && durSummary.activeMinutes > 0 && (
        <DurationInfoCard
          isOpen={isSectionDurationOpen}
          onClose={() => setIsSectionDurationOpen(false)}
          title={data.title}
          color={data.color}
          totalSummary={durSummary}
          completedSummary={completedDurationSummary}
          routineParts={hasAccumulatedBreakdown ? data.routineParts : null}
          mixParts={hasMixBreakdown ? mixParts : null}
          onStartSequence={_onStartSectionSequence}
          pendingCount={data.pendingCount ?? pendingTaskCount ?? data.sectionTaskIds?.length}
        />
      )}
    </div>
  );
};
