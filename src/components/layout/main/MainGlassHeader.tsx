import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Check, Settings, FolderPlus, Play } from 'lucide-react';
import type { CustomList } from '../../../models/Task';
import { HapticService } from '../../../services/HapticService';

export const SMART_COLORS: Record<string, string> = {
  'smart_today': 'var(--accent-blue)',
  'smart_scheduled': 'var(--accent-red)',
  'smart_all': 'var(--text-secondary)',
  'smart_flagged': 'var(--accent-orange)',
  'smart_completed': 'var(--text-tertiary)',
  'smart_overdue': 'var(--accent-red)'
};

interface MainGlassHeaderProps {
  isScrolled: boolean;
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
  completedCount?: number;
}

export const MainGlassHeader: React.FC<MainGlassHeaderProps> = ({
  isScrolled,
  isMobile: _isMobile,
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
  completedCount
}) => {
  const listAccentColor = isSmartView 
    ? (SMART_COLORS[currentView] || 'var(--accent-blue, #007AFF)') 
    : (currentList?.color || 'var(--accent-blue, #007AFF)');

  return (
    <header 
      className="glass-header" 
      style={{ 
        position: 'relative', 
        flexShrink: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: '12px',
        paddingLeft: '16px',
        paddingRight: '16px',
        minHeight: 'calc(env(safe-area-inset-top, 0px) + 56px)',
        display: 'flex', 
        width: '100%', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        zIndex: 100,
        boxSizing: 'border-box',
        background: isScrolled ? 'var(--bg-surface-glass)' : 'transparent',
        borderBottom: isScrolled ? '0.5px solid var(--border-subtle)' : '0.5px solid transparent',
        backdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
        transition: 'background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease, -webkit-backdrop-filter 0.25s ease'
      }}
    >
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
        opacity: isScrolled ? 1 : 0,
        transform: isScrolled ? 'translateY(0)' : 'translateY(4px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: isScrolled ? 'auto' : 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 8px'
      }}>
        {title}
      </div>

      {/* Right: Actions unified in the top line */}
      <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'nowrap', flexShrink: 0, justifyContent: 'flex-end', position: 'relative' }}>
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
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 180, background: 'rgba(0,0,0,0.2)' }} 
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
                      background: 'var(--bg-elevated, #ffffff)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      boxShadow: '0 16px 44px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.1)',
                      borderRadius: 14,
                      padding: 6,
                      maxHeight: 'calc(100dvh - 120px)',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      WebkitOverflowScrolling: 'touch'
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
                          onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
                        >
                          <Settings size={15} color="var(--text-secondary)" />
                          <span style={{ whiteSpace: 'nowrap' }}>Personalizar lista</span>
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
};
