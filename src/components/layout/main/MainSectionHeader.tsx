import React from 'react';
import { MoreHorizontal, ChevronDown } from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import type { SectionMenuState } from './SectionContextMenu';

interface SectionData {
  title: string;
  category: string;
  color: string;
  sectionId?: string;
  depth: number;
  periodicity?: string | null;
  routineCounts?: { full: number; only: number } | null;
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
}

export const MainSectionHeader: React.FC<MainSectionHeaderProps> = ({
  data,
  itemKey,
  index,
  itemStyle,
  showDivider,
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
  isMobile
}) => {
  const currentSectionRoutineMode = sectionRoutineModes[data.category] || 'only_section';

  return (
    <div 
      key={itemKey} 
      data-index={index} 
      className="group-header"
      style={{ 
        ...itemStyle, 
        borderBottom: 'none',
        borderTop: 'none',
        paddingLeft: `calc(32px + ${data.depth * 24}px)`,
        paddingRight: '16px',
        minHeight: showDivider ? 56 : 44,
        paddingTop: showDivider ? 16 : 8,
        paddingBottom: 8,
        margin: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        outline: isDraggingOver ? `2px solid ${data.color}` : undefined,
        background: isDraggingOver ? `${data.color}14` : 'transparent',
        zIndex: 10
      }}
      onClick={() => toggleCategory(data.category)}
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
        setSectionMenu({ 
          open: true, 
          x: e.clientX, 
          y: e.clientY, 
          sectionId: data.sectionId, 
          sectionName: data.title,
          pendingTaskCount,
          color: data.color,
          category: data.category
        });
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) return;
        if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current);
        const clientX = e.clientX;
        const clientY = e.clientY;
        const secId = data.sectionId;
        const secTitle = data.title;
        const count = pendingTaskCount;
        const clr = data.color;
        const cat = data.category;
        sectionTouchTimer.current = setTimeout(() => {
          setSectionMenu({ 
            open: true, 
            x: clientX, 
            y: clientY, 
            sectionId: secId, 
            sectionName: secTitle,
            pendingTaskCount: count,
            color: clr,
            category: cat
          });
        }, 400);
      }}
      onPointerUp={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
      onPointerCancel={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
      onPointerMove={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
    >
      {showDivider && (
        <div className="ios-section-divider" style={{ height: '0.5px', background: 'var(--separator-color, rgba(142, 142, 147, 0.3))', margin: '0 0 12px 0', width: '100%' }} />
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
            <h3 
              onDoubleClick={(e) => isCustomSection && startEditingSection(e, data.sectionId!, data.title)}
              style={{ 
                cursor: isCustomSection ? 'text' : 'pointer',
                fontWeight: data.depth === 0 ? 700 : 600,
                color: data.depth === 0 ? 'var(--text-primary)' : data.depth === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontSize: data.depth === 0 ? '1.2rem' : data.depth === 1 ? '1rem' : '0.85rem',
                textTransform: data.depth >= 2 ? 'uppercase' : 'none',
                letterSpacing: data.depth >= 2 ? '0.5px' : '0',
                lineHeight: '1.3',
                minHeight: '28px',
                wordBreak: 'break-word',
                margin: 0,
                padding: '4px 0',
                boxSizing: 'border-box'
              }}
              title={isCustomSection ? "Doble click para editar" : ""}
            >
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
              type="button"
              className="desktop-only-action"
              onClick={(e) => {
                e.stopPropagation();
                HapticService.selection();
                const rect = e.currentTarget.getBoundingClientRect();
                setSectionMenu({
                  open: true,
                  x: Math.max(12, rect.right - 235),
                  y: rect.bottom + 6,
                  sectionId: data.sectionId,
                  sectionName: data.title,
                  pendingTaskCount,
                  color: data.color,
                  category: data.category
                });
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4 }}
              title="Opciones de sección"
            >
              <MoreHorizontal size={16} color="var(--text-primary)" />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
          {/* Si esta sección tiene periodicidad, ESTÁ DESPLEGADA y hay tareas acumulables (full > only), conmutador nativo Apple */}
          {!isCatCollapsed(data.category) && data.periodicity && data.routineCounts && data.routineCounts.full > data.routineCounts.only && (
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
          )}

          {/* Si esta sección está plegada, mostrar solo un sutil conteo numérico estilo Apple */}
          {isCatCollapsed(data.category) && data.routineCounts && (
            <span style={{ 
              fontSize: '0.82rem', 
              fontWeight: 600, 
              color: 'var(--text-tertiary)', 
              fontVariantNumeric: 'tabular-nums',
              marginRight: 2
            }}>
              {currentSectionRoutineMode === 'full_routine' ? data.routineCounts.full : data.routineCounts.only}
            </span>
          )}

          <ChevronDown 
            size={18} 
            color="var(--text-tertiary)" 
            style={{ transform: isCatCollapsed(data.category) ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
          />
        </div>
      </div>
      {isCustomSection && dragOverSectionId === data.sectionId && (
        <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
      )}
    </div>
  );
};
