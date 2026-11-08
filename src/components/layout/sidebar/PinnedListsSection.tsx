import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { PinOff, Copy, Trash2, EyeOff, SlidersHorizontal } from 'lucide-react';
import { SMART_LISTS, SMART_LISTS_WITHOUT_COUNT } from '../../../constants/smartLists';
import type { CustomList } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';

interface PinnedListsSectionProps {
  pinnedSmartLists: string[];
  lists: CustomList[];
  smartListVisibility: Record<string, boolean>;
  isEditMode: boolean;
  currentView: string;
  onSelectView: (view: string) => void;
  togglePinSmartList: (id: string) => void;
  getTaskCount: (id: string) => number;
  onOpenListConfig?: (listId: string) => void;
}

export const PinnedListsSection: React.FC<PinnedListsSectionProps> = ({
  pinnedSmartLists,
  lists,
  smartListVisibility,
  isEditMode,
  currentView,
  onSelectView,
  togglePinSmartList,
  getTaskCount,
  onOpenListConfig
}) => {
  const updateList = useAppStore(state => state.updateList);
  const deleteList = useAppStore(state => state.deleteList);
  const addList = useAppStore(state => state.addList);
  const toggleSmartList = useAppStore(state => state.toggleSmartList);

  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    isSmart: boolean;
    name: string;
    color?: string;
    coords: { x: number; y: number } | null;
  } | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const wasLongPressedRef = useRef(false);

  useEffect(() => {
    if (!activeMenu) return;
    const handleClose = () => setActiveMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [activeMenu]);

  const triggerContextMenu = (id: string, isSmart: boolean, name: string, color: string | undefined, clientX?: number, clientY?: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([15]); } catch {}
    }
    HapticService.impact('medium');
    wasLongPressedRef.current = true;

    const x = clientX ?? window.innerWidth / 2;
    const y = clientY ?? window.innerHeight / 2;
    setActiveMenu({ id, isSmart, name, color, coords: { x, y } });
  };

  const handlePointerDown = (id: string, isSmart: boolean, name: string, color?: string) => (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    wasLongPressedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      triggerContextMenu(id, isSmart, name, color, e.clientX, e.clientY);
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const visiblePinnedSmartLists = pinnedSmartLists.filter(smartId => {
    if (smartId === 'smart_primeros_pasos') {
      const isHidden = localStorage.getItem('hide_onboarding_guide') === 'true' ||
        lists?.some((l: any) => l.id === 'user_preferences_onboarding');
      if (isHidden || getTaskCount('smart_primeros_pasos') === 0) return false;
    }
    if (!smartListVisibility[smartId] && !isEditMode) return false;
    return true;
  });
  const visiblePinnedCustomLists = (lists || []).filter((l: any) => l.isPinned && l.id !== 'primeros_pasos');
  const hasAnyPinned = visiblePinnedSmartLists.length > 0 || visiblePinnedCustomLists.length > 0;

  if (!hasAnyPinned) return null;

  return (
    <div style={{ padding: '0 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 2 }}>
        <span className="section-header" style={{ margin: 0, padding: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>Ancladas</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Pinned Smart Lists */}
        {visiblePinnedSmartLists.map(smartId => {
          const smartItem = SMART_LISTS.find(s => s.id === smartId);
          if (!smartItem) return null;
          const Icon = smartItem.icon;
          const count = getTaskCount(smartId);
          const isActive = currentView === smartId;

          return (
            <motion.div
              key={smartId}
              layoutId={"pinned-item-" + smartId}
              role="button"
              tabIndex={0}
              aria-label={smartItem.name}
              aria-pressed={isActive}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onPointerDown={handlePointerDown(smartId, true, smartItem.name, smartItem.color)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePointerUpOrCancel();
                triggerContextMenu(smartId, true, smartItem.name, smartItem.color, e.clientX, e.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (isEditMode) {
                    togglePinSmartList(smartId);
                  } else {
                    onSelectView(smartId);
                  }
                }
              }}
              onClick={() => {
                if (wasLongPressedRef.current) {
                  wasLongPressedRef.current = false;
                  return;
                }
                if (isEditMode) {
                  togglePinSmartList(smartId);
                } else {
                  onSelectView(smartId);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 14,
                background: isActive 
                  ? `color-mix(in srgb, ${smartItem.color} 16%, var(--bg-elevated))` 
                  : `color-mix(in srgb, ${smartItem.color} 7%, var(--bg-elevated))`,
                border: isActive 
                  ? `1.5px solid ${smartItem.color}` 
                  : `1px solid color-mix(in srgb, ${smartItem.color} 16%, var(--border-subtle))`,
                cursor: 'pointer',
                boxShadow: isActive ? `0 4px 14px color-mix(in srgb, ${smartItem.color} 22%, transparent)` : '0 1px 3px rgba(0, 0, 0, 0.04)',
                transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, fill 150ms ease, opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease'
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: smartItem.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 2px 6px color-mix(in srgb, ${smartItem.color} 36%, transparent)`
              }}>
                <Icon size={16} color="white" />
              </div>
              <span style={{
                flex: 1, fontWeight: 600, fontSize: '0.98rem',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {smartItem.name}
              </span>
              
              {!isEditMode && !SMART_LISTS_WITHOUT_COUNT.has(smartId) && (
                <span style={{
                  fontSize: '0.9rem', fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-hover)',
                  padding: '2px 8px', borderRadius: 999,
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {count}
                </span>
              )}

              {isEditMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinSmartList(smartId);
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--accent-orange)' }}
                  title="Desanclar de esta sección"
                >
                  <PinOff size={16} />
                </button>
              )}
            </motion.div>
          );
        })}

        {/* Pinned Custom Lists */}
        {visiblePinnedCustomLists.map((list: any) => {
          const isActive = currentView === `list_${list.id}`;
          const count = getTaskCount(list.id);
          const listColor = list.color || '#0a84ff';
          return (
            <motion.div
              key={"pinned-custom-" + list.id}
              role="button"
              tabIndex={0}
              aria-label={list.name}
              aria-pressed={isActive}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onPointerDown={handlePointerDown(list.id, false, list.name, listColor)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePointerUpOrCancel();
                triggerContextMenu(list.id, false, list.name, listColor, e.clientX, e.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectView(`list_${list.id}`);
                }
              }}
              onClick={() => {
                if (wasLongPressedRef.current) {
                  wasLongPressedRef.current = false;
                  return;
                }
                onSelectView(`list_${list.id}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 14,
                background: isActive 
                  ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated))' 
                  : 'var(--bg-elevated)',
                border: isActive 
                  ? '1.5px solid var(--accent-primary)' 
                  : '1px solid var(--border-subtle)',
                cursor: 'pointer',
                boxShadow: isActive ? '0 4px 14px rgba(0, 122, 255, 0.16)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, fill 150ms ease, opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease'
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: listColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 2px 6px color-mix(in srgb, ${listColor} 36%, transparent)`
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                <span style={{
                  fontWeight: isActive ? 650 : 500, fontSize: '0.94rem',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1
                }}>
                  {list.name}
                </span>
              </div>
              <span style={{
                fontSize: '0.9rem', fontWeight: 600,
                color: 'var(--text-tertiary)',
                background: 'var(--bg-hover)',
                padding: '2px 8px', borderRadius: 999
              }}>
                {count}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Context Menu for Pinned Lists */}
      {activeMenu && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999998,
              background: 'rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
            onClick={() => setActiveMenu(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              className="ios-dropdown-menu"
              style={{
                position: 'fixed',
                top: Math.max(16, Math.min(activeMenu.coords?.y ?? 100, window.innerHeight - 260)),
                left: Math.max(16, Math.min(activeMenu.coords?.x ?? 50, window.innerWidth - 240)),
                zIndex: 999999,
                width: 230,
                background: 'var(--bg-material, rgba(30, 30, 32, 0.96))',
                backdropFilter: 'blur(35px) saturate(190%)',
                WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                borderRadius: 14,
                boxShadow: '0 14px 40px rgba(0, 0, 0, 0.28), 0 2px 10px rgba(0, 0, 0, 0.08)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '6px 10px 4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
                {activeMenu.name}
              </div>

              {activeMenu.isSmart ? (
                <>
                  <button
                    type="button"
                    className="ios-dropdown-item"
                    onClick={() => {
                      HapticService.selection();
                      togglePinSmartList(activeMenu.id);
                      setActiveMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px' }}
                  >
                    <PinOff size={15} color="var(--accent-orange, #ff9500)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Desanclar</span>
                  </button>
                  <button
                    type="button"
                    className="ios-dropdown-item"
                    onClick={() => {
                      HapticService.selection();
                      toggleSmartList(activeMenu.id);
                      setActiveMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px' }}
                  >
                    <EyeOff size={15} color="var(--text-secondary)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Ocultar lista</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="ios-dropdown-item"
                    onClick={() => {
                      HapticService.selection();
                      updateList(activeMenu.id, { isPinned: false });
                      setActiveMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px' }}
                  >
                    <PinOff size={15} color="var(--accent-orange, #ff9500)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Desanclar</span>
                  </button>
                  {onOpenListConfig && (
                    <button
                      type="button"
                      className="ios-dropdown-item"
                      onClick={() => {
                        HapticService.selection();
                        onOpenListConfig(activeMenu.id);
                        setActiveMenu(null);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px' }}
                    >
                      <SlidersHorizontal size={15} color="var(--accent-primary, #007aff)" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Configuración y filtros</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ios-dropdown-item"
                    onClick={() => {
                      HapticService.selection();
                      const target = lists.find(l => l.id === activeMenu.id);
                      if (target) {
                        const newId = `list_${Date.now()}`;
                        addList({
                          ...target,
                          id: newId,
                          name: `${target.name} (copia)`,
                          isPinned: false
                        });
                      }
                      setActiveMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px' }}
                  >
                    <Copy size={15} color="var(--accent-blue, #007aff)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Duplicar lista</span>
                  </button>
                  <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                  <button
                    type="button"
                    className="ios-dropdown-item danger"
                    onClick={() => {
                      HapticService.notification('warning');
                      deleteList(activeMenu.id);
                      setActiveMenu(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 36, padding: '6px 10px', color: 'var(--accent-red, #ff3b30)' }}
                  >
                    <Trash2 size={15} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>Eliminar lista</span>
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
