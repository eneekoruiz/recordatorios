import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus,
  Check,
  LogOut,
  BarChart,
  Trash2,
  Download,
  MoreHorizontal,
  Inbox,
  Pin,
  PinOff,
  Edit3,
  Settings,
  Volume2,
  HelpCircle,
  Folder,
  FolderOpen,
  FolderPlus,
  IndentIncrease,
  IndentDecrease,
  Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';
import { SoundService } from '../../services/SoundService';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { CycleConfigModal } from './CycleConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

// Sub-componente para jerarquía infinita
const ListHierarchy = ({ 
  lists, currentView, onSelectView, onAddSublist, onEditList, getTaskCount, 
  parentId = undefined, depth = 0, isEditMode = false,
  activeMenuId, setActiveMenuId, menuCoords, setMenuCoords
}: any) => {
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
  }, [activeMenuId]);
  
  const uniqueLists = Array.from(new Map((lists || []).map((l: any) => [l.id, l])).values());
  const currentLevelLists = uniqueLists.filter((l: any) => l.parentId === parentId && l.id !== 'user_preferences_smart_lists' && l.id !== 'primeros_pasos');
  if (currentLevelLists.length === 0) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {currentLevelLists.map((list: any) => {
        const hasChildren = uniqueLists.some((l: any) => l.parentId === list.id);
        const isExpanded = expanded[list.id] !== undefined ? expanded[list.id] : true;
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
                borderRadius: activeMenuId === list.id ? 12 : 0,
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
                    try { navigator.vibrate([10]); } catch (_err) {}
                  }
                  // Open Premium Context Menu
                  if (activeMenuId === list.id) {
                    setActiveMenuId(null);
                    setMenuCoords(null);
                  } else {
                    const el = document.querySelector(`[data-list-id="${list.id}"]`);
                    const rect = el ? el.getBoundingClientRect() : { bottom: pointerStartRef.current!.y, left: pointerStartRef.current!.x };
                    setMenuCoords({
                      top: rect.bottom,
                      left: rect.left
                    });
                    setActiveMenuId(list.id);
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
                setMenuCoords({
                  top: e.clientY,
                  left: e.clientX
                });
                setActiveMenuId(list.id);
              }}
              style={{ position: 'relative', transition: 'background-color 150ms ease', cursor: 'grab' }}
            >
              {list.isFolder ? (
                isExpanded ? <FolderOpen size={depth > 0 ? 14 : 18} color={list.color} style={{ marginRight: depth > 0 ? 8 : 10, flexShrink: 0 }} /> : <Folder size={depth > 0 ? 14 : 18} color={list.color} style={{ marginRight: depth > 0 ? 8 : 10, flexShrink: 0 }} />
              ) : (
                <div className="list-icon" style={{ backgroundColor: list.color, width: depth > 0 ? 16 : undefined, height: depth > 0 ? 16 : undefined, marginRight: depth > 0 ? 8 : undefined }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)', fontSize: depth > 0 ? '0.9rem' : undefined }}>{list.name}</span>
                {list.isShared && <span className="subtitle">Esta lista es compartida.</span>}
              </div>
              
              {getTaskCount && !list.isFolder && <span className="count">{getTaskCount(list.id) || 0}</span>}
              
              {(hasChildren || list.isFolder) ? (
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setExpanded(p => ({...p, [list.id]: !isExpanded})); 
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ 
                    background: isExpanded ? 'var(--accent-glow)' : 'var(--bg-card)', 
                    border: isExpanded ? '1px solid rgba(10, 132, 255, 0.3)' : '1px solid var(--border-subtle)', 
                    borderRadius: 6, 
                    padding: '3px 8px', 
                    cursor: 'pointer', 
                    color: isExpanded ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginLeft: 6,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  title={isExpanded ? "Contraer sublistas" : "Expandir sublistas"}
                >
                  <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                    <ChevronDown size={14} color={isExpanded ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                  </motion.div>
                  <span style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                    {isExpanded ? 'Sublistas' : 'Ver sublistas'}
                  </span>
                </button>
              ) : null}
              
              <button 
                className="list-action-btn"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (activeMenuId === list.id) {
                    setActiveMenuId(null);
                    setMenuCoords(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuCoords({
                      top: rect.bottom,
                      left: rect.left - 120
                    });
                    setActiveMenuId(list.id);
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, marginLeft: 4 }}
                title="Acciones"
              >
                <MoreHorizontal size={14} />
              </button>

              {activeMenuId === list.id && menuCoords && createPortal(
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }} 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                  />
                  <motion.div 
                    initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.85, y: -10 }}
                    animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                    exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 450 }}
                    className={isMobile ? undefined : "ios-dropdown-menu"}
                    style={isMobile ? { 
                      position: 'fixed',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 99999,
                      background: 'var(--bg-elevated, #1c1c1e)',
                      borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                      borderRadius: '20px 20px 0 0',
                      padding: '16px 16px max(24px, env(safe-area-inset-bottom))',
                      boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: '80vh',
                      overflowY: 'auto'
                    } : { 
                      position: 'fixed',
                      top: Math.min(menuCoords.top + 4, window.innerHeight - 400),
                      left: Math.max(12, Math.min(menuCoords.left, window.innerWidth - 220)),
                      zIndex: 99999,
                      width: 220,
                      background: 'var(--bg-material, rgba(255,255,255,0.75))',
                      backdropFilter: 'blur(30px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                      borderRadius: '14px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '8px 0',
                      display: 'flex', flexDirection: 'column'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isMobile && (
                      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(255,255,255,0.2))', margin: '0 auto 12px', flexShrink: 0 }} />
                    )}
                    {list.id === 'primeros_pasos' ? (
                      <button 
                        className="ios-dropdown-item danger"
                        onClick={() => {
                          setActiveMenuId(null);
                          setMenuCoords(null);
                          localStorage.setItem('hide_onboarding_guide', 'true');
                          removeList('primeros_pasos');
                          onSelectView('list_inbox');
                        }}
                        style={isMobile ? { ...mobileItemStyle, color: '#ff3b30' } : { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: '#ff3b30', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', width: '100%' }}
                      >
                        <Trash2 size={16} color="#ff3b30" /> Ocultar / Eliminar guía de inicio
                      </button>
                    ) : (
                      <>
                        <button 
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            updateList(list.id, { isPinned: !list.isPinned });
                          }}
                          style={isMobile ? mobileItemStyle : { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', width: '100%' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {list.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                          {list.isPinned ? 'Desanclar' : 'Anclar'}
                        </button>
                        <button 
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            setExpanded(prev => ({ ...prev, [list.id]: true }));
                            onAddSublist(list.id, false);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Plus size={16} /> Nueva lista anidada
                        </button>
                        <button 
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            setExpanded(prev => ({ ...prev, [list.id]: true }));
                            onAddSublist(list.id, true);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <FolderPlus size={16} /> Nueva carpeta anidada
                        </button>
                        {index > 0 && (
                          <button 
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
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <IndentIncrease size={16} /> Sangrar (Anidar en anterior)
                          </button>
                        )}
                        {list.parentId && (
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => {
                              const parentList = lists.find((l: any) => l.id === list.parentId);
                              updateList(list.id, { parentId: parentList?.parentId });
                              window.dispatchEvent(new CustomEvent('show-toast', { detail: `Des-sangrado (Nivel subido)` }));
                              setActiveMenuId(null);
                              setMenuCoords(null);
                            }}
                            style={isMobile ? mobileItemStyle : undefined}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <IndentDecrease size={16} /> Des-sangrar (Subir de nivel)
                          </button>
                        )}
                        <button 
                          className="ios-dropdown-item"
                          onClick={() => {
                            setActiveMenuId(null);
                            setMenuCoords(null);
                            onEditList(list.id);
                          }}
                          style={isMobile ? mobileItemStyle : undefined}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Edit3 size={16} /> Editar {list.isFolder ? 'Carpeta' : 'Lista'}
                        </button>
                        <div className="ios-dropdown-divider" style={isMobile ? { margin: '4px 0', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))' } : undefined} />
                        <button 
                          className="ios-dropdown-item danger"
                          onClick={() => {
                            if (confirm(`¿Seguro que quieres borrar ${list.isFolder ? 'la carpeta' : 'la lista'} "${list.name}" y su contenido anidado?`)) {
                              removeList(list.id);
                            }
                            setActiveMenuId(null);
                            setMenuCoords(null);
                          }}
                          style={isMobile ? { ...mobileItemStyle, color: 'var(--accent-danger, #ff3b30)' } : undefined}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Trash2 size={16} /> Eliminar {list.isFolder ? 'Carpeta' : 'Lista'}
                        </button>
                      </>
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
          </div>
        );
      })}
    </div>
  );
};

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const lists = useAppStore((state) => state.lists);
  const cycles = useAppStore((state) => state.cycles);
  const smartListVisibility = useAppStore((state) => state.smartListVisibility);
  const pinnedSmartLists = useAppStore((state) => state.pinnedSmartLists) || ['smart_primeros_pasos'];
  const toggleSmartList = useAppStore((state) => state.toggleSmartList);
  const togglePinSmartList = useAppStore((state) => state.togglePinSmartList);
  const tasks = useAppStore((state) => state.tasks);
  const cycleVisibility = useAppStore((state) => state.cycleVisibility);
  const toggleCycleVisibility = useAppStore((state) => state.toggleCycleVisibility);
  const globalCyclesEnabled = useAppStore((state) => state.globalCyclesEnabled);
  const toggleGlobalCycles = useAppStore((state) => state.toggleGlobalCycles);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  
  const getTaskCount = (listId: string) => {
    const all = Object.values(tasks || {}).filter(t => !t.deleted_at);
    const active = all.filter(t => !isTaskCompleted(t));
    const todayStr = new Date().toDateString();
    
    switch (listId) {
      case 'smart_primeros_pasos':
        return active.filter(t => t.categoryId === 'primeros_pasos').length;
      case 'smart_today': 
        return active.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr).length;
      case 'smart_scheduled': 
        return active.filter(t => t.dueDate && new Date(t.dueDate) > new Date()).length;
      case 'smart_all': 
        return active.length;
      case 'smart_flagged': 
        return active.filter(t => Boolean(t.flagged || (t.priority && t.priority !== 'none'))).length;
      case 'smart_completed': 
        return all.filter(t => isTaskCompleted(t)).length;
      case 'smart_overdue': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return active.filter(t => t.dueDate && new Date(t.dueDate) < today).length;
      }
      default: {
        const cleanListId = listId.replace('list_', '').replace('folder_', '');
        const descendantListIds = new Set<string>([cleanListId]);
        const queue = [cleanListId];
        while (queue.length > 0) {
          const currId = queue.shift()!;
          const children = lists?.filter(l => l.parentId === currId) || [];
          children.forEach(c => {
            descendantListIds.add(c.id);
            queue.push(c.id);
          });
        }
        return active.filter(t => {
          if (t.categoryId === 'primeros_pasos') return false;
          const catId = t.categoryId || (t as any).category_id;
          return catId && descendantListIds.has(catId);
        }).length;
      }
    }
  };

  const user = { name: 'Eneko Ruiz', email: localStorage.getItem('userEmail') || 'eneekoruiz@gmail.com' };
  const userProfileRef = useRef<HTMLDivElement>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditCyclesMode, setIsEditCyclesMode] = useState(false);
  
  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | undefined>(undefined);
  const [parentListId, setParentListId] = useState<string | undefined>(undefined);
  const [isNewFolderDefault, setIsNewFolderDefault] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(SoundService.enabled);

  useEffect(() => {
    setIsProfileOpen(false);
  }, [currentView]);

  const handleAddList = () => {
    setEditingListId(undefined);
    setParentListId(undefined);
    setIsNewFolderDefault(false);
    setIsListConfigOpen(true);
  };

  return (
    <aside className="sidebar" onScroll={() => window.dispatchEvent(new Event('close-list-menus'))}>
      {/* 1 & 2. STICKY HEADER: USER PROFILE + SEARCH BAR */}
      <div className="sidebar-header">
      {/* 1. USER PROFILE */}
      <div 
        ref={userProfileRef}
        className="user-profile" 
        onClick={(e) => { e.stopPropagation(); setIsProfileOpen((prev) => !prev); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          cursor: 'pointer',
          position: 'relative',
          padding: 'var(--space-8) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          transition: 'background 0.2s',
          zIndex: 100
        }}
      >
        <div className="avatar" style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {user.name.charAt(0)}
        </div>
        <div className="user-info" style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {user.name}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {user.email}
          </span>
        </div>
        <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />

        {/* PROFILE DROPDOWN (PORTALED TO BODY FOR 100% RELIABLE CLICK OUTSIDE) */}
        {isProfileOpen && typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            <motion.div 
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
              onClick={(e) => { e.stopPropagation(); setIsProfileOpen(false); }}
            />
            <motion.div 
              key="sidebar-dropdown"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="ios-dropdown-menu"
              style={{ 
                position: 'fixed', 
                top: (userProfileRef.current?.getBoundingClientRect().bottom || 60) + 8, 
                left: userProfileRef.current?.getBoundingClientRect().left || 16, 
                width: userProfileRef.current?.getBoundingClientRect().width || 240, 
                zIndex: 99999
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  localStorage.removeItem('pwa_prompt_dismissed'); 
                  window.dispatchEvent(new Event('open-install-modal'));
                  setIsProfileOpen(false); 
                }}
              >
                <Download size={16} /> Instalar como App
              </div>
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { e.stopPropagation(); onSelectView('DATA'); setIsProfileOpen(false); }}
              >
                <Folder size={16} /> Importar / Exportar
              </div>
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { e.stopPropagation(); onSelectView('ANALYTICS'); setIsProfileOpen(false); }}
              >
                <BarChart size={16} /> Estadísticas
              </div>
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { e.stopPropagation(); toggleGlobalCycles(); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Settings size={16} /> Ciclos Temporales
                </span>
                <div style={{
                  width: '36px', height: '22px', borderRadius: '11px',
                  background: globalCyclesEnabled ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
                  position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff',
                    position: 'absolute', top: '2px', left: globalCyclesEnabled ? '16px' : '2px',
                    transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { e.stopPropagation(); const next = SoundService.toggleSound(); setSoundEnabled(next); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Volume2 size={16} /> Sonidos Acústicos
                </span>
                <div style={{
                  width: '36px', height: '22px', borderRadius: '11px',
                  background: soundEnabled ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
                  position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff',
                    position: 'absolute', top: '2px', left: soundEnabled ? '16px' : '2px',
                    transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
              <div 
                className="ios-dropdown-item"
                onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event('open-shortcuts-modal')); setIsProfileOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <HelpCircle size={16} /> Atajos de Teclado
                </span>
                <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem', fontWeight: 600 }}>?</kbd>
              </div>
              <div className="ios-dropdown-divider" />
              <div 
                className="ios-dropdown-item danger"
                onClick={() => {
                  useAppStore.getState().logout();
                  setIsProfileOpen(false);
                }}
              >
                <LogOut size={16} /> Cerrar Sesión
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </div>

      {/* 2. SEARCH BAR */}
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar (Ctrl + K)" 
          onFocus={(e) => {
            window.dispatchEvent(new Event('open-command-palette'));
            e.target.blur();
          }}
        />
      </div>
      </div>

      {/* 3. SCROLLABLE AREA */}
      <div 
        className="sidebar-content sidebar-scroll-area" 
        onScroll={() => window.dispatchEvent(new Event('close-list-menus'))}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'auto',
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        
        {/* ANCLADAS (PINNED SMART LISTS SECTION) */}
        {pinnedSmartLists.length > 0 && (
          <div style={{ padding: '0 var(--space-12)', marginBottom: 'var(--space-16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)', paddingLeft: 12 }}>
              <span className="section-header" style={{ margin: 0, padding: 0 }}>Ancladas</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pinnedSmartLists.map(smartId => {
                const smartItem = SMART_LISTS.find(s => s.id === smartId);
                if (!smartItem) return null;
                const Icon = smartItem.icon;
                const count = getTaskCount(smartId);
                const isActive = currentView === smartId;

                return (
                  <motion.div
                    key={smartId}
                    layoutId={"pinned-item-" + smartId}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
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
                      borderRadius: 12,
                      background: isActive ? 'var(--accent-glow)' : 'var(--bg-elevated)',
                      border: isActive ? '1px solid rgba(10, 132, 255, 0.25)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      boxShadow: isActive ? '0 2px 8px var(--accent-glow)' : '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 150ms ease'
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: smartItem.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 2px 6px ${smartItem.color}40`
                    }}>
                      <Icon size={16} color="white" />
                    </div>
                    <span style={{
                      flex: 1, fontWeight: 600, fontSize: '0.95rem',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {smartItem.name}
                    </span>
                    
                    {!isEditMode && (
                      <span style={{
                        fontSize: '0.85rem', fontWeight: 700,
                        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        background: isActive ? 'rgba(10, 132, 255, 0.15)' : 'var(--bg-hover)',
                        padding: '2px 8px', borderRadius: 999
                      }}>
                        {count}
                      </span>
                    )}

                    {isEditMode && (
                      <button
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
            </div>
          </div>
        )}

        {/* SMART LISTS GRID */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--space-12)', marginBottom: 'var(--space-8)' }}>
          <span className="section-header" style={{ margin: 0, padding: 0, marginLeft: 12 }}>Listas inteligentes</span>
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            style={{ background: 'transparent', border: 'none', color: isEditMode ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {isEditMode ? 'Hecho' : 'Editar'}
          </button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
          gap: 'var(--space-8)', 
          padding: '0 var(--space-12)',
          marginBottom: 'var(--space-16)'
        }}>
          {SMART_LISTS.filter(list => !pinnedSmartLists.includes(list.id) && (smartListVisibility[list.id] || isEditMode)).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-16) 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No tienes listas inteligentes seleccionadas
            </div>
          ) : (
            SMART_LISTS.filter(list => !pinnedSmartLists.includes(list.id)).map(list => {
              if (!smartListVisibility[list.id] && !isEditMode) return null;
              const Icon = list.icon;
            
            return (
              <motion.div 
                key={list.id}
                layoutId={"smart-card-" + list.id}
                className="ios-smart-card"
                onClick={() => {
                  if (isEditMode) {
                    toggleSmartList(list.id);
                  } else {
                    onSelectView(list.id);
                  }
                }}
                style={{
                  opacity: isEditMode && !smartListVisibility[list.id] ? 0.5 : 1,
                  transition: 'background-color 150ms ease, opacity 150ms ease'
                }}
              >
                {isEditMode && (
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinSmartList(list.id);
                      }}
                      style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--accent-orange)'
                      }}
                      title="Anclar arriba"
                    >
                      <Pin size={12} />
                    </button>
                    <div style={{ 
                      width: 20, height: 20, borderRadius: '50%', 
                      border: smartListVisibility[list.id] ? 'none' : '1px solid var(--border-focus)',
                      background: smartListVisibility[list.id] ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: smartListVisibility[list.id] ? '0 0 10px var(--accent-glow)' : 'none'
                    }}>
                      {smartListVisibility[list.id] && <Check size={12} color="white" />}
                    </div>
                  </div>
                )}
                <motion.div layoutId={"smart-icon-" + list.id} className="icon-circle" style={{ backgroundColor: list.color, boxShadow: `0 4px 12px ${list.color}40`, border: 'none' }}>
                  <Icon size={18} color="white" />
                </motion.div>
                {!isEditMode && (
                  <span 
                    className="count" 
                    style={{ 
                      fontSize: getTaskCount(list.id) >= 100 ? '1.4rem' : getTaskCount(list.id) >= 10 ? '1.7rem' : '2rem'
                    }}
                  >
                    {getTaskCount(list.id)}
                  </span>
                )}
                <h3>{list.name}</h3>
              </motion.div>
            );
          }))}
        </div>



        {/* MIS LISTAS */}
        <div className="categories-section" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px 8px 16px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Mis listas</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button 
                className="btn-icon"
                style={{ padding: 4, cursor: 'pointer' }}
                title="Añadir lista"
                onClick={handleAddList}
              >
                <Plus size={16} color="var(--accent-primary)" />
              </button>
            </div>
          </div>
          <div className="ios-list-block">
            {/* 🚀 Primeros Pasos (Banner distinguido en la parte superior) */}
            {lists?.some(l => l.id === 'primeros_pasos') && (
              <motion.div 
                className={`ios-list-item ${currentView === 'smart_primeros_pasos' || currentView === 'list_primeros_pasos' ? 'active' : ''}`}
                onClick={() => onSelectView('smart_primeros_pasos')}
                style={{ 
                  background: 'rgba(255, 45, 85, 0.08)',
                  borderBottom: '1px solid rgba(255, 45, 85, 0.15)',
                  transition: 'background-color 150ms ease'
                }}
              >
                <div className="list-icon" style={{ backgroundColor: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Rocket size={12} color="white" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Primeros Pasos</span>
                </div>
                <span className="count" style={{ background: 'rgba(255, 45, 85, 0.15)', color: '#ff2d55', fontWeight: 700 }}>
                  {getTaskCount('smart_primeros_pasos')}
                </span>
                
                <button 
                  className="list-action-btn"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (activeMenuId === 'primeros_pasos') {
                      setActiveMenuId(null);
                      setMenuCoords(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuCoords({
                        top: rect.bottom,
                        left: rect.left - 120
                      });
                      setActiveMenuId('primeros_pasos');
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, marginLeft: 4 }}
                  title="Opciones de Guía"
                >
                  <MoreHorizontal size={14} />
                </button>
              </motion.div>
            )}

            {/* Portal flotante para menú de Primeros Pasos */}
            {activeMenuId === 'primeros_pasos' && menuCoords && createPortal(
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }} 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                />
                <motion.div 
                  initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.85, y: -10 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 450 }}
                  className={isMobile ? undefined : "ios-dropdown-menu"}
                  style={isMobile ? { 
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 99999,
                    background: 'var(--bg-elevated, #1c1c1e)',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: '20px 20px 0 0', padding: '16px 16px max(24px, env(safe-area-inset-bottom))',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8
                  } : { 
                    position: 'fixed',
                    top: Math.min(menuCoords.top + 4, window.innerHeight - 200),
                    left: Math.max(12, Math.min(menuCoords.left, window.innerWidth - 220)),
                    zIndex: 99999, width: 220,
                    background: 'var(--bg-material, rgba(255,255,255,0.75))',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    borderRadius: '14px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(255,255,255,0.2)', padding: '8px 0',
                    display: 'flex', flexDirection: 'column'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    className="ios-dropdown-item danger"
                    onClick={() => {
                      setActiveMenuId(null);
                      setMenuCoords(null);
                      localStorage.setItem('hide_onboarding_guide', 'true');
                      removeList('primeros_pasos');
                      const allTasks = useAppStore.getState().tasks;
                      Object.values(allTasks).forEach(t => {
                        if (t.categoryId === 'primeros_pasos') {
                          updateTask(t.id, { deleted_at: new Date().toISOString() });
                        }
                      });
                      onSelectView('list_inbox');
                    }}
                    style={isMobile ? mobileItemStyle : { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', color: '#ff3b30', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.88rem', fontWeight: 600, width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={16} color="#ff3b30" /> Saltar primeros pasos
                  </button>
                </motion.div>
              </>,
              document.body
            )}

            {/* Bandeja de entrada */}
            <motion.div 
              className={`ios-list-item ${currentView === 'list_inbox' ? 'active' : ''}`}
              onClick={() => onSelectView('list_inbox')}
              style={{ transition: 'background-color 150ms ease' }}
            >
              <div className="list-icon" style={{ backgroundColor: '#0a84ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={12} color="white" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: currentView === 'list_inbox' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Bandeja de entrada</span>
              </div>
              <span className="count">
                {Object.values(tasks || {}).filter(t => {
                  if (t.deleted_at || isTaskCompleted(t)) return false;
                  const catId = t.categoryId || (t as any).category_id;
                  return catId === 'inbox' || !catId;
                }).length}
              </span>
            </motion.div>

            <ListHierarchy 
              lists={lists} 
              currentView={currentView} 
              onSelectView={onSelectView} 
              getTaskCount={getTaskCount}
              onAddSublist={(pId: string, isF?: boolean) => { setEditingListId(undefined); setParentListId(pId); setIsNewFolderDefault(!!isF); setIsListConfigOpen(true); }} 
              onEditList={(listId: string) => { setEditingListId(listId); setParentListId(undefined); setIsListConfigOpen(true); }}
              isEditMode={isEditMode}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              menuCoords={menuCoords}
              setMenuCoords={setMenuCoords}
            />

            {/* Papelera */}
            <motion.div 
              className={`ios-list-item ${currentView === 'TRASH' ? 'active' : ''}`}
              onClick={() => onSelectView('TRASH')}
              style={{ transition: 'background-color 150ms ease' }}
            >
              <div className="list-icon" style={{ backgroundColor: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={12} color="white" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: currentView === 'TRASH' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Papelera</span>
              </div>
              <span className="count">
                {Object.values(tasks || {}).filter(t => t.deleted_at).length}
              </span>
            </motion.div>
          </div>
        </div>

        {/* CICLOS TEMPORALES */}
        {globalCyclesEnabled && (
          <div style={{ marginTop: 'var(--space-16)' }}>
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Ciclos temporales</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {isEditCyclesMode && (() => {
                const allVisible = cycles.every(c => cycleVisibility[c.id]);
                return (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextVisibility: Record<string, boolean> = {};
                      cycles.forEach(c => {
                        nextVisibility[c.id] = !allVisible;
                      });
                      useAppStore.setState({ cycleVisibility: nextVisibility });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    title={allVisible ? "Ocultar todos los ciclos" : "Mostrar todos los ciclos"}
                  >
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Todos</span>
                    <div style={{
                      width: '32px', height: '18px', borderRadius: '9px',
                      background: allVisible ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
                      position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
                    }}>
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                        position: 'absolute', top: '2px', left: allVisible ? '16px' : '2px',
                        transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>
                );
              })()}
              <button 
                onClick={() => setIsEditCyclesMode(!isEditCyclesMode)}
                style={{ background: 'transparent', border: 'none', color: isEditCyclesMode ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {isEditCyclesMode ? 'Hecho' : 'Editar'}
              </button>
              <button 
                className="btn-icon"
                style={{ padding: 4, cursor: 'pointer' }}
                title="Nuevo Ciclo"
                onClick={(e) => { e.stopPropagation(); setIsCycleModalOpen(true); }}
              >
                <Plus size={14} color="var(--text-tertiary)" />
              </button>
            </div>
          </div>

          {cycles.filter(c => c.isPinned && (cycleVisibility[c.id] || isEditCyclesMode)).length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
              No hay ciclos visibles. Edita para activarlos.
            </div>
          )}

          <div className="ios-list-block">
            {Array.from(new Map((cycles || []).map((c: any) => [c.id, c])).values()).filter(c => c.isPinned).map(cycle => {
              const isVisible = !!cycleVisibility[cycle.id];
              const Icon = getCycleIcon(cycle.icon);
              const isActive = currentView === cycle.id;
              const taskCount = Object.values(tasks || {}).filter(t => !t.deleted_at && !isTaskCompleted(t) && t.categoryId !== 'primeros_pasos' && t.cycle_id === cycle.id && !isCompletedInCurrentPeriod(t, cycles)).length;
              
              // Si el usuario desactivó explícitamente el ciclo, no lo mostramos a menos que esté en modo edición
              if (!isVisible && !isEditCyclesMode) return null;
              
              return (
                <motion.div 
                  key={cycle.id}
                  className={`ios-list-item ${isActive ? 'active' : ''}`}
                  style={{ position: 'relative', opacity: isEditCyclesMode && !isVisible ? 0.5 : 1, transition: 'background-color 150ms ease' }}
                >
                  <div 
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: isEditCyclesMode ? 'default' : 'pointer' }} 
                    onClick={() => {
                      if (!isEditCyclesMode) {
                        onSelectView(cycle.id);
                      } else {
                        toggleCycleVisibility(cycle.id);
                      }
                    }}
                  >
                    <div className="list-icon" style={{ backgroundColor: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={12} color="white" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{cycle.name}</span>
                    </div>
                    {!isEditCyclesMode && <span className="count">{taskCount}</span>}
                  </div>
                  {isEditCyclesMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCycleVisibility(cycle.id); }}
                      title={isVisible ? 'Desactivar ciclo' : 'Activar ciclo'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: isVisible ? 'var(--accent-primary)' : 'var(--text-tertiary)', padding: 4, marginLeft: 4 }}
                    >
                      {isVisible ? <Check size={14} /> : <Plus size={14} />}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
        )}

      </div>
      
      {/* MODALS (OUTSIDE SCROLL) */}
      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={editingListId} 
        parentId={parentListId} 
        defaultIsFolder={isNewFolderDefault}
      />
      <CycleConfigModal 
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        onSuccess={(id) => {
          setIsCycleModalOpen(false);
          onSelectView(id);
        }}
      />
      
    </aside>
  );
}
