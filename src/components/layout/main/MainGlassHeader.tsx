import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Check, Settings, FolderPlus, Play } from 'lucide-react';
import type { CustomList } from '../../../models/Task';
import { HapticService } from '../../../services/HapticService';
import { getListType, LIST_TYPE_CONFIG } from '../../../utils/specialLists';

const SMART_COLORS: Record<string, string> = {
  'smart_today': 'var(--accent-blue)',
  'smart_scheduled': 'var(--accent-red)',
  'smart_all': 'var(--text-secondary)',
  'smart_flagged': 'var(--accent-orange)',
  'smart_completed': 'var(--text-tertiary)',
  'smart_overdue': 'var(--accent-red)'
};

interface MainGlassHeaderProps {
  isScrolled: boolean;
  scrollTop?: number;
  isMobile?: boolean;
  onBackToSidebar?: () => void;
  isSmartView: boolean;
  isListView: boolean;
  isFolderView: boolean;
  currentView: string;
  currentList?: CustomList;
  title: string;
  isMenuOpen: boolean;
  setIsMenuOpen: (val: boolean) => void;
  resolvedShowCompleted: boolean;
  toggleShowCompleted: () => void;
  sortBy: 'manual' | 'dueDate' | 'priority' | 'title' | 'createdAt';
  setSortBy: (val: 'manual' | 'dueDate' | 'priority' | 'title' | 'createdAt') => void;
  updateList: (id: string, updates: Partial<CustomList>) => void;
  setIsListConfigOpen: (val: boolean) => void;
  onAddSection: () => void;
  onStartSequence?: () => void;
  showProminentStartButton?: boolean;
  startDuration?: string;
  completedCount?: number;
  isStartDisabled?: boolean;
  cycleRoutineMode?: 'only_section' | 'full_routine';
  onToggleCycleRoutineMode?: (mode: 'only_section' | 'full_routine') => void;
  currentCycleId?: string;
  currentCycleName?: string;
}

export const MainGlassHeader: React.FC<MainGlassHeaderProps> = ({
  isScrolled,
  scrollTop,
  isMobile = false,
  onBackToSidebar,
  isSmartView,
  isListView,
  isFolderView,
  currentView,
  currentList,
  title,
  isMenuOpen,
  setIsMenuOpen,
  resolvedShowCompleted,
  toggleShowCompleted,
  sortBy,
  setSortBy,
  updateList,
  setIsListConfigOpen,
  onAddSection,
  onStartSequence,
  showProminentStartButton = true,
  startDuration,
  completedCount,
  isStartDisabled = false,
  cycleRoutineMode,
  onToggleCycleRoutineMode,
  currentCycleId,
  currentCycleName,
}) => {
  const listAccentColor = isSmartView 
    ? (SMART_COLORS[currentView] || 'var(--accent-blue, #007AFF)') 
    : (currentList?.color || 'var(--accent-blue, #007AFF)');

  const isGlassActive = scrollTop !== undefined ? scrollTop > 24 : isScrolled;
  const glassProgress = scrollTop !== undefined 
    ? Math.min(1, Math.max(0, (scrollTop - 28) / 28))
    : (isScrolled ? 1 : 0);

  return (
    <header 
      className="glass-header" 
      style={{ 
        position: 'relative', 
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: onToggleCycleRoutineMode && currentCycleId && currentCycleId !== 'cycle_day' && isGlassActive ? '6px' : '12px',
        paddingLeft: '16px',
        paddingRight: '16px',
        minHeight: 'calc(env(safe-area-inset-top, 0px) + 56px)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%', 
        alignItems: 'stretch', 
        justifyContent: 'center', 
        zIndex: 1000,
        boxSizing: 'border-box',
        background: isGlassActive ? 'var(--bg-surface-glass)' : 'transparent',
        borderBottom: isGlassActive ? '0.5px solid var(--border-subtle)' : '0.5px solid transparent',
        backdropFilter: isGlassActive ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isGlassActive ? 'blur(20px) saturate(180%)' : 'none',
        transition: 'background 0.2s ease, border-color 0.2s ease, backdrop-filter 0.2s ease, -webkit-backdrop-filter 0.2s ease'
      }}
    >
      {/* Top row: back button + title + actions */}
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
      {/* Left: Back button ("Atrás para más listas") */}
      {onBackToSidebar ? (
        <button 
          type="button"
          onClick={() => {
            HapticService.selection();
            onBackToSidebar();
          }} 
          className="back-btn-ios" 
          data-testid="content-back-btn"
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 3, 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--accent-primary, #0a84ff)', 
            fontWeight: 500, 
            fontSize: '1.02rem', 
            cursor: 'pointer',
            padding: '4px 8px 4px 0',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
            zIndex: 10,
            transition: 'opacity 0.15s ease'
          }}
          title="Atrás para más listas"
        >
          <ChevronLeft size={22} strokeWidth={2.4} />
          <span>Listas</span>
        </button>
      ) : (
        <div style={{ minWidth: 24, flexShrink: 0 }} />
      )}
      
      {/* Dynamic List Title on Top Bar (visible when scrolled) */}
      <div style={{ 
        flex: 1, 
        minWidth: 0,
        textAlign: 'center', 
        fontWeight: 600, 
        fontSize: '1rem', 
        color: isSmartView ? SMART_COLORS[currentView] : currentList ? currentList.color : 'var(--text-primary)',
        opacity: glassProgress,
        transform: `translateY(${Math.max(0, 4 * (1 - glassProgress))}px)`,
        filter: glassProgress < 0.95 ? `blur(${Math.max(0, 1.5 * (1 - glassProgress))}px)` : 'none',
        transition: 'opacity 0.08s ease-out, transform 0.08s ease-out, filter 0.08s ease-out',
        pointerEvents: glassProgress > 0.5 ? 'auto' : 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 8px'
      }}>
        {title}
      </div>

      {/* Right: Actions unified in the top line */}
      <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'nowrap', flexShrink: 0, justifyContent: 'flex-end', position: 'relative' }}>
        {/* Empezar secuencia inmediata (prominente solo en listas de rutinas/acción) */}
        {showProminentStartButton && (
          <button
            type="button"
            className="apple-nav-start-btn"
            disabled={isStartDisabled}
            onClick={() => {
              if (isStartDisabled || !onStartSequence) return;
              HapticService.selection();
              onStartSequence();
            }}
            title={isStartDisabled ? "No hay recordatorios pendientes para empezar" : "Empezar lista en modo enfoque"}
            aria-label="Empezar lista"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: listAccentColor ? `color-mix(in srgb, ${listAccentColor} 14%, transparent)` : 'rgba(0, 122, 255, 0.12)',
              border: `1px solid ${listAccentColor ? `color-mix(in srgb, ${listAccentColor} 30%, transparent)` : 'rgba(0, 122, 255, 0.25)'}`,
              cursor: isStartDisabled ? 'default' : 'pointer',
              opacity: isStartDisabled ? 0.45 : 1,
              color: listAccentColor,
              fontWeight: 650,
              fontSize: '0.80rem',
              whiteSpace: 'nowrap',
              boxShadow: isStartDisabled ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <Play size={11} fill="currentColor" style={{ flexShrink: 0 }} />
            <span>Empezar</span>
            {startDuration && startDuration !== '0 min' && !isStartDisabled && (
              <span style={{ opacity: 0.85, fontSize: '0.72rem', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                ({startDuration})
              </span>
            )}
          </button>
        )}

        {/* Añadir sección de raíz */}
        {isListView && (
          <button 
            type="button"
            className="icon-btn apple-nav-action-btn" 
            onClick={() => {
              HapticService.selection();
              onAddSection();
            }} 
            title="Añadir sección de raíz"
            aria-label="Añadir sección de raíz"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              color: 'var(--accent-primary)',
              transition: 'all 0.15s ease'
            }}
          >
            <FolderPlus size={18} strokeWidth={2.2} />
          </button>
        )}

        {/* Opciones de lista */}
        {(isListView || isSmartView || isFolderView) && (
          <div style={{ position: 'relative' }}>
            <button 
              type="button"
              className="icon-btn apple-nav-action-btn" 
              onClick={() => setIsMenuOpen(!isMenuOpen)} 
              title="Opciones de lista"
              aria-label="Opciones de lista"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                color: 'var(--accent-primary)',
                transition: 'all 0.15s ease'
              }}
            >
              <MoreHorizontal size={18} strokeWidth={2.2} />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                isMobile ? (
                  createPortal(
                    <>
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ 
                          position: 'fixed', 
                          inset: 0, 
                          zIndex: 9998, 
                          background: 'rgba(0, 0, 0, 0.45)', 
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)'
                        }} 
                        onClick={() => setIsMenuOpen(false)} 
                      />
                      <motion.div 
                        role="dialog"
                        aria-label="Opciones de lista"
                        className="ios-bottom-sheet"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                        style={{ 
                          position: 'fixed', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          zIndex: 9999, 
                          background: 'var(--bg-material, rgba(255, 255, 255, 0.94))',
                          backdropFilter: 'blur(40px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                          borderTop: '1px solid var(--border-subtle)',
                          borderRadius: '24px 24px 0 0',
                          boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
                          padding: '12px 16px calc(24px + env(safe-area-inset-bottom, 0px)) 16px',
                          maxHeight: '82dvh',
                          overflowY: 'auto',
                          overscrollBehavior: 'contain',
                          WebkitOverflowScrolling: 'touch'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{
                          width: 36,
                          height: 5,
                          borderRadius: 3,
                          background: 'var(--border-strong, rgba(0,0,0,0.22))',
                          margin: '0 auto 16px auto'
                        }} />
                        {onStartSequence && (
                          <>
                            <button 
                              type="button"
                              className="ios-dropdown-item"
                              onClick={() => {
                                HapticService.selection();
                                setIsMenuOpen(false);
                                onStartSequence();
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}
                            >
                              <Play size={16} color={listAccentColor} fill={listAccentColor} />
                              <span style={{ whiteSpace: 'nowrap', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500 }}>Empezar lista</span>
                            </button>
                            <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                          </>
                        )}

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { toggleShowCompleted(); setIsMenuOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 44 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Check 
                              size={17} 
                              color="var(--accent-primary)" 
                              style={{ opacity: resolvedShowCompleted ? 1 : 0, transition: 'opacity 0.15s ease' }} 
                            />
                            <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{resolvedShowCompleted ? 'Ocultar completados' : 'Mostrar completados'}</span>
                          </div>
                          {completedCount !== undefined && completedCount > 0 && (
                            <span style={{ 
                              fontSize: '0.82rem', 
                              fontWeight: 600, 
                              color: 'var(--text-tertiary)',
                              background: 'var(--bg-hover, rgba(0,0,0,0.05))',
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontVariantNumeric: 'tabular-nums' 
                            }}>
                              {completedCount}
                            </span>
                          )}
                        </button>

                        <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                        
                        <div style={{ padding: '8px 12px 4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Ordenar por
                        </div>

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { HapticService.selection(); setSortBy('manual'); setIsMenuOpen(false); }}
                          style={{ justifyContent: 'space-between', minHeight: 44, fontSize: '0.95rem' }}
                        >
                          <span>Manual</span>
                          {sortBy === 'manual' && <Check size={16} color="var(--accent-primary)" />}
                        </button>

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { HapticService.selection(); setSortBy('dueDate'); setIsMenuOpen(false); }}
                          style={{ justifyContent: 'space-between', minHeight: 44, fontSize: '0.95rem' }}
                        >
                          <span>Fecha de vencimiento</span>
                          {sortBy === 'dueDate' && <Check size={16} color="var(--accent-primary)" />}
                        </button>

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { HapticService.selection(); setSortBy('priority'); setIsMenuOpen(false); }}
                          style={{ justifyContent: 'space-between', minHeight: 44, fontSize: '0.95rem' }}
                        >
                          <span>Prioridad</span>
                          {sortBy === 'priority' && <Check size={16} color="var(--accent-primary)" />}
                        </button>

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { HapticService.selection(); setSortBy('title'); setIsMenuOpen(false); }}
                          style={{ justifyContent: 'space-between', minHeight: 44, fontSize: '0.95rem' }}
                        >
                          <span>Título (A-Z)</span>
                          {sortBy === 'title' && <Check size={16} color="var(--accent-primary)" />}
                        </button>

                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => { HapticService.selection(); setSortBy('createdAt'); setIsMenuOpen(false); }}
                          style={{ justifyContent: 'space-between', minHeight: 44, fontSize: '0.95rem' }}
                        >
                          <span>Fecha de creación</span>
                          {sortBy === 'createdAt' && <Check size={16} color="var(--accent-primary)" />}
                        </button>

                        {isListView && currentList && (
                          <>
                            <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 0' }} />
                            <button 
                              type="button"
                              className="ios-dropdown-item"
                              onClick={() => { updateList(currentList.id, { isFinancial: !currentList.isFinancial }); setIsMenuOpen(false); }}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 44, fontSize: '0.95rem' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Check size={16} color="var(--accent-primary)" style={{ opacity: currentList.isFinancial ? 1 : 0 }} />
                                <span style={{ whiteSpace: 'nowrap' }}>Modo financiero</span>
                              </div>
                            </button>
                            <button 
                              type="button"
                              className="ios-dropdown-item"
                              onClick={() => { 
                                const nextVal = currentList.autoEstimateDuration === false ? true : false;
                                updateList(currentList.id, { autoEstimateDuration: nextVal }); 
                                setIsMenuOpen(false); 
                              }}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 44, fontSize: '0.95rem' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Check size={16} color="var(--accent-primary)" style={{ opacity: currentList.autoEstimateDuration !== false ? 1 : 0 }} />
                                <span style={{ whiteSpace: 'nowrap' }}>Estimar duración automática</span>
                              </div>
                            </button>
                            <button 
                              type="button"
                              className="ios-dropdown-item"
                              onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', minHeight: 44, fontSize: '0.95rem' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Settings size={16} color="var(--text-secondary)" />
                                <span style={{ whiteSpace: 'nowrap' }}>Personalizar lista</span>
                              </div>
                              <span style={{ 
                                fontSize: '0.74rem', 
                                fontWeight: 600, 
                                color: LIST_TYPE_CONFIG[getListType(currentList, currentView)].color,
                                background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                                padding: '2px 8px',
                                borderRadius: 6
                              }}>
                                {LIST_TYPE_CONFIG[getListType(currentList, currentView)].badgeLabel}
                              </span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            HapticService.selection();
                            setIsMenuOpen(false);
                          }}
                          style={{
                            marginTop: 14,
                            width: '100%',
                            minHeight: 46,
                            borderRadius: 14,
                            background: 'var(--bg-elevated, rgba(0,0,0,0.06))',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-primary)',
                            fontSize: '0.98rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          Cerrar
                        </button>
                      </motion.div>
                    </>,
                    document.body
                  )
                ) : (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'transparent' }} 
                      onClick={() => setIsMenuOpen(false)} 
                    />
                    <motion.div 
                      className="ios-dropdown-menu"
                      initial={{ opacity: 0, scale: 0.95, y: -4, transformOrigin: 'top right' }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ 
                        position: 'absolute', 
                        right: 0, 
                        top: '100%', 
                        marginTop: 8, 
                        zIndex: 200, 
                        minWidth: 245,
                        background: 'var(--bg-material, rgba(255,255,255,0.85))',
                        backdropFilter: 'blur(30px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                        boxShadow: '0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
                        borderRadius: 14,
                        padding: 6,
                        maxHeight: 'calc(100dvh - 120px)',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none'
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {onStartSequence && (
                        <>
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => {
                              HapticService.selection();
                              setIsMenuOpen(false);
                              onStartSequence();
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                          >
                            <Play size={14} color={listAccentColor} fill={listAccentColor} />
                            <span style={{ whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>Empezar lista</span>
                          </button>
                          <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                        </>
                      )}

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { toggleShowCompleted(); setIsMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Check 
                            size={15} 
                            color="var(--accent-primary)" 
                            style={{ opacity: resolvedShowCompleted ? 1 : 0, transition: 'opacity 0.15s ease' }} 
                          />
                          <span>{resolvedShowCompleted ? 'Ocultar completados' : 'Mostrar completados'}</span>
                        </div>
                        {completedCount !== undefined && completedCount > 0 && (
                          <span style={{ 
                            fontSize: '0.78rem', 
                            fontWeight: 600, 
                            color: 'var(--text-tertiary)',
                            background: 'var(--bg-hover, rgba(0,0,0,0.05))',
                            padding: '1.5px 7px',
                            borderRadius: 999,
                            fontVariantNumeric: 'tabular-nums' 
                          }}>
                            {completedCount}
                          </span>
                        )}
                      </button>

                      <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                      
                      <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Ordenar por
                      </div>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('manual'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Manual</span>
                        {sortBy === 'manual' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('dueDate'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Fecha de vencimiento</span>
                        {sortBy === 'dueDate' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('priority'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Prioridad</span>
                        {sortBy === 'priority' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('title'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Título (A-Z)</span>
                        {sortBy === 'title' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('createdAt'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Fecha de creación</span>
                        {sortBy === 'createdAt' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      {isListView && currentList && (
                        <>
                          <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => { updateList(currentList.id, { isFinancial: !currentList.isFinancial }); setIsMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Check size={14} color="var(--accent-primary)" style={{ opacity: currentList.isFinancial ? 1 : 0 }} />
                              <span style={{ whiteSpace: 'nowrap' }}>Modo financiero</span>
                            </div>
                          </button>
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => { 
                              const nextVal = currentList.autoEstimateDuration === false ? true : false;
                              updateList(currentList.id, { autoEstimateDuration: nextVal }); 
                              setIsMenuOpen(false); 
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Check size={14} color="var(--accent-primary)" style={{ opacity: currentList.autoEstimateDuration !== false ? 1 : 0 }} />
                              <span style={{ whiteSpace: 'nowrap' }}>Estimar duración automática</span>
                            </div>
                          </button>
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Settings size={15} color="var(--text-secondary)" />
                              <span style={{ whiteSpace: 'nowrap' }}>Personalizar lista</span>
                            </div>
                            <span style={{ 
                              fontSize: '0.72rem', 
                              fontWeight: 600, 
                              color: LIST_TYPE_CONFIG[getListType(currentList, currentView)].color,
                              background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                              padding: '1px 6px',
                              borderRadius: 6
                            }}>
                              {LIST_TYPE_CONFIG[getListType(currentList, currentView)].badgeLabel}
                            </span>
                          </button>
                        </>
                      )}
                    </motion.div>
                  </>
                )
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      </div>
      {/* Second row: frequency segmented control — only when scrolled and in a non-daily cycle */}
      {onToggleCycleRoutineMode && currentCycleId && currentCycleId !== 'cycle_day' && isGlassActive && (
        <div style={{
          display: 'inline-flex',
          padding: '2px',
          borderRadius: '10px',
          background: 'var(--bg-elevated, rgba(120,120,128,0.12))',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
          width: '100%',
          boxSizing: 'border-box',
          marginTop: 6,
          opacity: glassProgress,
          transition: 'opacity 0.12s ease'
        }}>
          <button
            type="button"
            onClick={() => { HapticService.selection(); onToggleCycleRoutineMode('only_section'); }}
            style={{
              flex: 1,
              padding: '5px 10px',
              borderRadius: '8px',
              border: 'none',
              background: cycleRoutineMode === 'only_section' || !cycleRoutineMode ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: cycleRoutineMode === 'only_section' || !cycleRoutineMode ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: cycleRoutineMode === 'only_section' || !cycleRoutineMode ? 650 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: cycleRoutineMode === 'only_section' || !cycleRoutineMode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              textAlign: 'center'
            }}
          >
            {currentCycleId === 'cycle_week' ? 'Solo semanales' :
             currentCycleId === 'cycle_month' ? 'Solo mensuales' :
             currentCycleId === 'cycle_year' ? 'Solo anuales' : `Solo ${currentCycleName?.toLowerCase() || ''}`}
          </button>
          <button
            type="button"
            onClick={() => { HapticService.selection(); onToggleCycleRoutineMode('full_routine'); }}
            style={{
              flex: 1,
              padding: '5px 10px',
              borderRadius: '8px',
              border: 'none',
              background: cycleRoutineMode === 'full_routine' ? 'var(--bg-card, #ffffff)' : 'transparent',
              color: cycleRoutineMode === 'full_routine' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: cycleRoutineMode === 'full_routine' ? 650 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
              boxShadow: cycleRoutineMode === 'full_routine' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              textAlign: 'center'
            }}
          >
            {currentCycleId === 'cycle_week' ? 'Semanales + Diarias' :
             currentCycleId === 'cycle_month' ? 'Mensuales + Acumuladas' :
             currentCycleId === 'cycle_year' ? 'Todas acumuladas' : 'Acumuladas'}
          </button>
        </div>
      )}
    </header>
  );
};
