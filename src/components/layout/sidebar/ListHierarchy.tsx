import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Share2, Link2Off,
  ChevronDown, 
  Plus, 
  Trash2, 
  Pin, 
  PinOff, 
  Edit3, 
  Folder, 
  FolderOpen, 
  FolderPlus, 
  IndentIncrease, 
  IndentDecrease, 
  MoreHorizontal,

} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../../store/useAppStore';
import type { CustomList } from '../../../models/Task';
import { confirmDialog } from '../../ui/confirmDialog';
import { shareList, unshareList } from '../../../services/ShareService';
import { getListIcon, getSuggestedListIconAndColor } from '../../../constants/icons';

interface ListHierarchyProps {
  lists: CustomList[];
  currentView: string;
  onSelectView: (view: string) => void;
  onAddSublist: (parentId: string, isFolder?: boolean) => void;
  onEditList: (listId: string) => void;
  getTaskCount?: (listId: string) => number;
  parentId?: string;
  depth?: number;
  isEditMode?: boolean;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  menuCoords: { top: number; left: number } | null;
  setMenuCoords: (coords: { top: number; left: number } | null) => void;
}

export const ListHierarchy: React.FC<ListHierarchyProps> = ({ 
  lists, 
  currentView, 
  onSelectView, 
  onAddSublist, 
  onEditList, 
  getTaskCount, 
  parentId = undefined, 
  depth = 0, 
  isEditMode = false,
  activeMenuId, 
  setActiveMenuId, 
  menuCoords, 
  setMenuCoords 
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draggingListId, setDraggingListId] = useState<string | null>(null);
  const removeList = useAppStore((state) => state.removeList);
  const updateList = useAppStore((state) => state.updateList);
  
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const wasLongPressedRef = useRef(false);

  useEffect(() => {
    if (!activeMenuId) return;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.ios-dropdown-menu')) {
        return; // Permite hacer scroll interno dentro del menú desplegable de la barra lateral
      }
      setActiveMenuId(null);
      setMenuCoords(null);
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('wheel', handleScroll, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScroll, { capture: true, passive: true });
    window.addEventListener('close-list-menus', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleScroll, true);
      window.removeEventListener('touchmove', handleScroll, true);
      window.removeEventListener('close-list-menus', handleScroll);
    };
  }, [activeMenuId, setActiveMenuId, setMenuCoords]);

  useEffect(() => {
    if (!activeMenuId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
        setMenuCoords(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeMenuId, setActiveMenuId, setMenuCoords]);
  
  const rawLists = Array.from(new Map((lists || []).map((l: any) => [l.id, l])).values());
  const seenNameParent = new Map<string, any>();
  for (const l of (rawLists as any[])) {
    const key = `${(l.name || '').trim().toLowerCase()}_${l.parentId || 'root'}`;
    const existing = seenNameParent.get(key);
    if (!existing) {
      seenNameParent.set(key, l);
    } else {
      const existingCount = getTaskCount ? (getTaskCount(existing.id) || 0) : 0;
      const currentCount = getTaskCount ? (getTaskCount(l.id) || 0) : 0;
      if (currentCount > existingCount) {
        seenNameParent.set(key, l);
      }
    }
  }
  const uniqueLists = Array.from(seenNameParent.values());
  const currentLevelLists = uniqueLists.filter((l: any) => l.parentId === parentId && l.id !== 'user_preferences_smart_lists' && l.id !== 'primeros_pasos' && !l.isPinned);
  if (currentLevelLists.length === 0) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {currentLevelLists.map((list: any) => {
        const hasChildren = uniqueLists.some((l: any) => l.parentId === list.id);
        const isExpanded = expanded[list.id] !== undefined ? expanded[list.id] : false;
        const isActive = !list.isFolder && currentView === `list_${list.id}`;
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        const mobileItemStyle = {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          minHeight: 48,
          fontSize: '1rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary)',
          textAlign: 'left' as const,
          cursor: 'pointer',
          borderRadius: 10,
          width: '100%'
        };

        const index = currentLevelLists.indexOf(list);
        

        const triggerListMenu = (anchorTarget?: HTMLElement | null) => {
          if (isMobile) {
            setMenuCoords({ top: 0, left: 0 });
            setActiveMenuId(list.id);
            return;
          }
          const el = anchorTarget?.closest(`[data-list-id="${list.id}"]`) as HTMLElement || document.querySelector(`[data-list-id="${list.id}"]`) as HTMLElement;
          if (el) {
            const rect = el.getBoundingClientRect();
            setMenuCoords({
              top: rect.bottom + 2,
              left: Math.max(12, Math.min(rect.right - 230, window.innerWidth - 245))
            });
          } else {
            setMenuCoords({ top: 120, left: 120 });
          }
          setActiveMenuId(list.id);
        };

        return (
          <div key={list.id} style={{ position: 'relative' }}>
            <motion.div 
              data-list-id={list.id}
              data-list-name={list.name}
              className={`ios-list-item ${isActive ? 'active' : ''}`}
              drag={draggingListId === list.id || isEditMode}
              dragSnapToOrigin={true}
              whileDrag={{ scale: 1.02, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', backgroundColor: 'var(--bg-elevated, #2c2c2e)' }}
              animate={{
                scale: activeMenuId === list.id ? 0.96 : 1,
                zIndex: activeMenuId === list.id ? 99999 : 'auto',
                boxShadow: activeMenuId === list.id ? '0 16px 40px rgba(0,0,0,0.2)' : 'none',
                borderRadius: 12,
              }}
              transition={{ type: 'spring', damping: 25, stiffness: 450 }}
              onDragStart={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onDragEnd={(e, info) => {
                setDraggingListId(null);
                const targetEl = e.currentTarget as HTMLElement;
                const oldVisibility = targetEl.style.visibility;
                targetEl.style.visibility = 'hidden';
                const dropTarget = document.elementFromPoint(info.point.x, info.point.y);
                targetEl.style.visibility = oldVisibility;

                if (dropTarget) {
                  const targetRow = dropTarget.closest('[data-list-id]') as HTMLElement;
                  if (targetRow) {
                    const targetId = targetRow.getAttribute('data-list-id');
                    if (targetId && targetId !== list.id) {
                      let isDescendant = false;
                      let curr = lists.find((l: any) => l.id === targetId);
                      while (curr && curr.parentId) {
                        if (curr.parentId === list.id) {
                          isDescendant = true;
                          break;
                        }
                        curr = lists.find((l: any) => l.id === curr!.parentId);
                      }
                      if (!isDescendant) {
                        updateList(list.id, { parentId: targetId });
                        setExpanded(prev => ({ ...prev, [targetId]: true }));
                        window.dispatchEvent(new CustomEvent('show-toast', { detail: `Anidado en "${targetRow.getAttribute('data-list-name') || targetId}"` }));
                        return;
                      }
                    }
                  }
                }

                if (Math.abs(info.offset.x) > 40 && Math.abs(info.offset.y) < 40) {
                  if (info.offset.x > 40 && index > 0) {
                    const prevSibling = currentLevelLists[index - 1];
                    updateList(list.id, { parentId: prevSibling.id });
                    setExpanded(prev => ({ ...prev, [prevSibling.id]: true }));
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: `Anidado bajo "${prevSibling.name}"` }));
                  } else if (info.offset.x < -40 && list.parentId) {
                    const parentList = lists.find((l: any) => l.id === list.parentId);
                    updateList(list.id, { parentId: parentList?.parentId });
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: `Lista movida de nivel` }));
                  }
                }
              }}
              onClick={() => {
                if (wasLongPressedRef.current) {
                  wasLongPressedRef.current = false;
                  return;
                }
                if (list.isFolder) {
                  setExpanded(p => ({ ...p, [list.id]: !isExpanded }));
                  onSelectView(`folder_${list.id}`);
                } else {
                  onSelectView(`list_${list.id}`);
                }
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 && e.button !== undefined) return;
                pointerStartRef.current = { x: e.clientX, y: e.clientY };
                wasLongPressedRef.current = false;
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = setTimeout(() => {
                  wasLongPressedRef.current = true;
                  if (navigator.vibrate) {
                    try { navigator.vibrate([10]); } catch {}
                  }
                  // Open Premium Context Menu
                  if (activeMenuId === list.id) {
                    setActiveMenuId(null);
                    setMenuCoords(null);
                  } else {
                    const el = document.querySelector(`[data-list-id="${list.id}"]`) as HTMLElement;
                    triggerListMenu(el);
                  }
                }, 300);
              }}
              onPointerMove={(e) => {
                if (!pointerStartRef.current || !longPressTimerRef.current) return;
                const dx = Math.abs(e.clientX - pointerStartRef.current.x);
                const dy = Math.abs(e.clientY - pointerStartRef.current.y);
                if (dx > 10 || dy > 10) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onPointerUp={() => {
                setDraggingListId(null);
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onPointerCancel={() => {
                setDraggingListId(null);
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
                wasLongPressedRef.current = true;
                triggerListMenu(e.currentTarget as HTMLElement);
              }}
              style={{ position: 'relative', transition: 'background-color 150ms ease', cursor: 'grab' }}
            >
              {list.isFolder ? (
                isExpanded ? <FolderOpen size={depth > 0 ? 14 : 18} color={list.color} style={{ marginRight: depth > 0 ? 8 : 10, flexShrink: 0 }} /> : <Folder size={depth > 0 ? 14 : 18} color={list.color} style={{ marginRight: depth > 0 ? 8 : 10, flexShrink: 0 }} />
              ) : (
                (() => {
                  const suggested = getSuggestedListIconAndColor(list.name);
                  const effectiveIcon = (list.icon && list.icon !== 'list') ? list.icon : (suggested?.icon || list.icon);
                  const effectiveColor = list.color || suggested?.color || '#0a84ff';
                  const ListIcon = getListIcon(effectiveIcon);
                  const small = depth > 0;
                  return (
                    <div className={`list-icon${small ? ' list-icon--small' : ''}`} style={{ backgroundColor: effectiveColor }}>
                      <ListIcon size={small ? 11 : 15} color="#fff" strokeWidth={2.4} />
                    </div>
                  );
                })()
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span 
                    className="title" 
                    style={{ 
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)', 
                      fontSize: depth > 0 ? '0.9rem' : undefined,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={list.name}
                  >
                    {list.name}
                  </span>
                </div>
                {list.isShared && <span className="subtitle">Esta lista es compartida.</span>}
              </div>
              
              {getTaskCount && !list.isFolder && <span className="count">{getTaskCount(list.id) || 0}</span>}
              
              {(hasChildren || list.isFolder) && (
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setExpanded(p => ({...p, [list.id]: !isExpanded})); 
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ 
                    background: 'transparent',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                    marginLeft: 4,
                    flexShrink: 0,
                    borderRadius: 6
                  }}
                  title={isExpanded ? "Contraer" : "Expandir"}
                >
                  <motion.div 
                    animate={{ rotate: isExpanded ? 0 : -90 }} 
                    transition={{ duration: 0.15 }}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronDown size={14} color="var(--text-tertiary)" />
                  </motion.div>
                </button>
              )}
              
              {!isMobile && (
                <button 
                  type="button"
                  className="list-action-btn desktop-only-action"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (activeMenuId === list.id) {
                      setActiveMenuId(null);
                      setMenuCoords(null);
                    } else {
                      triggerListMenu(e.currentTarget as HTMLElement);
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, marginLeft: 4 }}
                  title="Acciones"
                >
                  <MoreHorizontal size={14} />
                </button>
              )}

              {activeMenuId === list.id && menuCoords && createPortal(
                <>
                  <div 
                    style={{ 
                      position: 'fixed', 
                      inset: 0, 
                      zIndex: 99998, 
                      background: isMobile ? 'rgba(0, 0, 0, 0.45)' : 'transparent',
                      backdropFilter: isMobile ? 'blur(16px)' : 'none',
                      WebkitBackdropFilter: isMobile ? 'blur(16px)' : 'none',
                      transition: 'all 0.2s ease'
                    }} 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                  />
                  <motion.div 
                    initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -6 }}
                    animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                    exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 450 }}
                    className={isMobile ? undefined : "ios-dropdown-menu"}
                    style={isMobile ? { 
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 99999,
                      background: 'var(--bg-elevated, #1c1c1e)',
                      backdropFilter: 'blur(30px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                      borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                      borderRadius: '24px 24px 0 0',
                      padding: '16px 16px max(24px, env(safe-area-inset-bottom))',
                      boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: '80vh',
                      overflowY: 'auto'
                    } : { 
                      position: 'fixed',
                      top: Math.min(menuCoords.top, window.innerHeight - 300),
                      left: Math.max(12, Math.min(menuCoords.left, window.innerWidth - 235)),
                      zIndex: 99999,
                      width: 230,
                      background: 'var(--bg-material, rgba(255,255,255,0.85))',
                      backdropFilter: 'blur(30px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                      borderRadius: '14px',
                      boxShadow: '0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      scrollbarWidth: 'none'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isMobile && (
                      <>
                        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(255,255,255,0.2))', margin: '0 auto 12px', flexShrink: 0 }} />
                        <div style={{ textAlign: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{list.name}</span>
                        </div>
                      </>
                    )}
                    {list.id === 'primeros_pasos' ? (
                      <button 
                        type="button"
                        className="ios-dropdown-item danger"
                        onClick={() => {
                          setActiveMenuId(null);
                          setMenuCoords(null);
                          useAppStore.getState().dismissOnboarding();
                          onSelectView('list_inbox');
                        }}
                        style={isMobile ? { ...mobileItemStyle, color: '#ff3b30' } : undefined}
                      >
                        <Trash2 size={16} color="#ff3b30" /> Ocultar / Eliminar guía de inicio
                      </button>
                    ) : (
                      <>
                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            updateList(list.id, { isPinned: !list.isPinned });
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                        >
                          {list.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                          {list.isPinned ? 'Desanclar' : 'Anclar'}
                        </button>
                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            setExpanded(prev => ({ ...prev, [list.id]: true }));
                            onAddSublist(list.id, false);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                        >
                          <Plus size={16} /> Nueva lista anidada
                        </button>
                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            setExpanded(prev => ({ ...prev, [list.id]: true }));
                            onAddSublist(list.id, true);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                        >
                          <FolderPlus size={16} /> Nueva carpeta anidada
                        </button>
                        {index > 0 && (
                          <button 
                            type="button"
                            className="ios-dropdown-item"
                            onClick={() => {
                              const prevSibling = currentLevelLists[index - 1];
                              updateList(list.id, { parentId: prevSibling.id });
                              setExpanded(prev => ({ ...prev, [prevSibling.id]: true }));
                              window.dispatchEvent(new CustomEvent('show-toast', { detail: `Sangrado bajo "${prevSibling.name}"` }));
                              setActiveMenuId(null);
                              setMenuCoords(null);
                            }}
                            style={isMobile ? mobileItemStyle : undefined}
                          >
                            <IndentIncrease size={16} /> Sangrar (Anidar en anterior)
                          </button>
                        )}
                        {list.parentId && (
                          <button 
                            type="button"
                            className="ios-dropdown-item"
                            onClick={() => {
                              const parentList = lists.find((l: any) => l.id === list.parentId);
                              updateList(list.id, { parentId: parentList?.parentId });
                              window.dispatchEvent(new CustomEvent('show-toast', { detail: `Des-sangrado (Nivel subido)` }));
                              setActiveMenuId(null);
                              setMenuCoords(null);
                            }}
                            style={isMobile ? mobileItemStyle : undefined}
                          >
                            <IndentDecrease size={16} /> Des-sangrar (Subir de nivel)
                          </button>
                        )}
                        {!list.isFolder && (
                          <>
                            <button
                              type="button"
                              className="ios-dropdown-item"
                              onClick={() => {
                                setActiveMenuId(null);
                                setMenuCoords(null);
                                shareList(list.id, list.name);
                              }}
                              style={isMobile ? mobileItemStyle : undefined}
                            >
                              <Share2 size={16} /> Compartir enlace (solo lectura)
                            </button>
                            {list.isShared && (
                              <button
                                type="button"
                                className="ios-dropdown-item"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setMenuCoords(null);
                                  unshareList(list.id, list.name);
                                }}
                                style={isMobile ? mobileItemStyle : undefined}
                              >
                                <Link2Off size={16} /> Dejar de compartir
                              </button>
                            )}
                          </>
                        )}
                        <button 
                          type="button"
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            onEditList(list.id);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                        >
                          <Edit3 size={16} /> Editar {list.isFolder ? 'Carpeta' : 'Lista'}
                        </button>
                        <div className="ios-dropdown-divider" style={isMobile ? { margin: '4px 0', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))' } : undefined} />
                        <button 
                          type="button"
                          className="ios-dropdown-item danger"
                          onClick={async () => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            const kind = list.isFolder ? 'la carpeta' : 'la lista';
                            const ok = await confirmDialog({
                              title: `Eliminar ${list.isFolder ? 'carpeta' : 'lista'}`,
                              message: `Se eliminará ${kind} "${list.name}"${list.isFolder ? ', sus sublistas' : ''} y sus recordatorios pasarán a la papelera (podrás recuperarlos durante 30 días).`,
                              confirmText: 'Eliminar',
                            });
                            if (ok) {
                              const result = removeList(list.id);
                              window.dispatchEvent(new CustomEvent('show-toast', {
                                detail: {
                                  message: `«${list.name}» eliminada${result.tasks ? ` · ${result.tasks} recordatorio${result.tasks === 1 ? '' : 's'} en la papelera` : ''}`,
                                  onUndo: result.undo,
                                },
                              }));
                            }
                          }}
                          style={isMobile ? { ...mobileItemStyle, color: 'var(--accent-danger, #ff3b30)' } : undefined}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Trash2 size={16} /> Eliminar {list.isFolder ? 'Carpeta' : 'Lista'}
                        </button>
                      </>
                    )}
                    {isMobile && (
                      <button 
                        type="button"
                        className="ios-dropdown-item"
                        onClick={() => {
                          setActiveMenuId(null);
                          setMenuCoords(null);
                        }}
                        style={{ ...mobileItemStyle, justifyContent: 'center', marginTop: 8, fontWeight: 600 }}
                      >
                        Cancelar
                      </button>
                    )}
                  </motion.div>
                </>,
                document.body
              )}
            </motion.div>
            
            {(hasChildren || list.isFolder) && isExpanded && (
              hasChildren ? (
                <ListHierarchy 
                  lists={lists} 
                  currentView={currentView} 
                  onSelectView={onSelectView} 
                  onAddSublist={onAddSublist}
                  onEditList={onEditList}
                  getTaskCount={getTaskCount}
                  parentId={list.id} 
                  depth={depth + 1}
                  isEditMode={isEditMode}
                  activeMenuId={activeMenuId}
                  setActiveMenuId={setActiveMenuId}
                  menuCoords={menuCoords}
                  setMenuCoords={setMenuCoords}
                />
              ) : (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ 
                    paddingLeft: (depth + 1) * 16 + 28, 
                    paddingTop: 6, 
                    paddingBottom: 6, 
                    paddingRight: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    borderRadius: 8,
                    margin: '2px 0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                    <FolderOpen size={14} opacity={0.65} />
                    <span>Carpeta vacía</span>
                  </div>
                  {onAddSublist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddSublist(list.id);
                      }}
                      style={{
                        background: 'var(--accent-glow, rgba(10, 132, 255, 0.12))',
                        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
                        color: 'var(--accent-primary)',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Crear una sublista dentro de esta carpeta"
                    >
                      <Plus size={11} /> Sublista
                    </button>
                  )}
                </motion.div>
              )
            )}
            {!(depth === 0 && index === currentLevelLists.length - 1) && (
              <div 
                className="list-separator-line"
                aria-hidden="true" 
                style={{
                  height: 1,
                  minHeight: 1,
                  background: 'var(--border-subtle, rgba(120, 120, 128, 0.28))',
                  marginLeft: depth > 0 ? 44 : 52,
                  marginRight: 8,
                  opacity: 0.95,
                  flexShrink: 0
                }} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
