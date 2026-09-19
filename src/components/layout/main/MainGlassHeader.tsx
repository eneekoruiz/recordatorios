import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Check, Settings, FolderPlus } from 'lucide-react';
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
}

export const MainGlassHeader: React.FC<MainGlassHeaderProps> = ({
  isScrolled,
  isMobile,
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
  onAddSection
}) => {
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
      {/* Left spacer / Mobile Back Button */}
      {isMobile && onBackToSidebar ? (
        <button 
          onClick={onBackToSidebar} 
          className="back-btn-ios" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4, 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--accent-primary, #0a84ff)', 
            fontWeight: 500, 
            fontSize: '1.05rem', 
            cursor: 'pointer',
            padding: '4px 8px 4px 0',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
            zIndex: 10
          }}
          title="Volver a listas"
        >
          <ChevronLeft size={22} /> Listas
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

      {/* Right: Actions aligned to the right */}
      <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'nowrap', flexShrink: 0, justifyContent: 'flex-end', position: 'relative' }}>
        {(isListView || isSmartView || isFolderView) && (
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} title="Opciones de Lista">
              <MoreHorizontal size={20} color="var(--accent-primary)" />
            </button>
            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.15)' }} 
                    onClick={() => setIsMenuOpen(false)} 
                  />
                  <motion.div 
                    className="ios-dropdown-menu glass-panel"
                    initial={{ opacity: 0, scale: 0.92, y: -6, transformOrigin: 'top right' }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: -6 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ 
                      position: 'absolute', right: 0, top: '100%', marginTop: 10, 
                      zIndex: 100, minWidth: 210,
                      maxHeight: 'calc(100dvh - 120px)',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                      WebkitOverflowScrolling: 'touch'
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <button 
                      className="ios-dropdown-item"
                      onClick={() => { toggleShowCompleted(); setIsMenuOpen(false); }}
                    >
                      <input type="checkbox" checked={resolvedShowCompleted} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                      Mostrar Completados
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
                        >
                          <input type="checkbox" checked={!!currentList.isFinancial} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                          Modo Financiero
                        </button>
                        <button 
                          className="ios-dropdown-item"
                          onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                        >
                          <Settings size={16} />
                          Personalizar Lista
                        </button>
                      </>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
        {isListView && (
          <button className="icon-btn" onClick={onAddSection} title="Añadir Sección Raíz">
            <FolderPlus size={20} color="var(--accent-primary)" />
          </button>
        )}
      </div>
    </header>
  );
};
