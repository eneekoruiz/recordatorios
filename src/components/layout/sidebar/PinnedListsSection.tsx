import React from 'react';
import { motion } from 'framer-motion';
import { PinOff } from 'lucide-react';
import { SMART_LISTS } from '../../../constants/smartLists';
import type { CustomList } from '../../../models/Task';

interface PinnedListsSectionProps {
  pinnedSmartLists: string[];
  lists: CustomList[];
  smartListVisibility: Record<string, boolean>;
  isEditMode: boolean;
  currentView: string;
  onSelectView: (view: string) => void;
  togglePinSmartList: (id: string) => void;
  getTaskCount: (id: string) => number;
}

export const PinnedListsSection: React.FC<PinnedListsSectionProps> = ({
  pinnedSmartLists,
  lists,
  smartListVisibility,
  isEditMode,
  currentView,
  onSelectView,
  togglePinSmartList,
  getTaskCount
}) => {
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

  if (!hasAnyPinned && !isEditMode) return null;

  return (
    <div style={{ padding: '0 14px', marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 4 }}>
        <span className="section-header" style={{ margin: 0, padding: 0 }}>Ancladas</span>
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
                padding: '11px 14px',
                borderRadius: 14,
                background: isActive 
                  ? smartItem.color 
                  : `linear-gradient(135deg, color-mix(in srgb, ${smartItem.color} 22%, var(--bg-elevated)) 0%, color-mix(in srgb, ${smartItem.color} 12%, var(--bg-elevated)) 100%)`,
                border: isActive 
                  ? `1.5px solid ${smartItem.color}` 
                  : `1px solid color-mix(in srgb, ${smartItem.color} 30%, transparent)`,
                cursor: 'pointer',
                boxShadow: isActive ? `0 4px 16px ${smartItem.color}45` : `0 2px 8px ${smartItem.color}18`,
                transition: 'all 150ms ease'
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : smartItem.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: isActive ? 'none' : `0 2px 6px ${smartItem.color}40`
              }}>
                <Icon size={15} color="white" />
              </div>
              <span style={{
                flex: 1, fontWeight: 650, fontSize: '0.95rem',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {smartItem.name}
              </span>
              
              {!isEditMode && (
                <span style={{
                  fontSize: '0.85rem', fontWeight: 700,
                  color: isActive ? '#ffffff' : 'var(--text-primary)',
                  background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'var(--bg-hover)',
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
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(`list_${list.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '11px 14px',
                borderRadius: 14,
                background: isActive 
                  ? listColor 
                  : `linear-gradient(135deg, color-mix(in srgb, ${listColor} 20%, var(--bg-elevated)) 0%, color-mix(in srgb, ${listColor} 10%, var(--bg-elevated)) 100%)`,
                border: isActive 
                  ? `1.5px solid ${listColor}` 
                  : `1px solid color-mix(in srgb, ${listColor} 28%, transparent)`,
                cursor: 'pointer',
                boxShadow: isActive ? `0 4px 16px ${listColor}45` : `0 2px 8px ${listColor}18`,
                transition: 'all 150ms ease'
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: isActive ? 'rgba(255, 255, 255, 0.25)' : listColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: isActive ? 'none' : `0 2px 6px ${listColor}40`
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
              </div>
              <span style={{
                flex: 1, fontWeight: 650, fontSize: '0.95rem',
                color: isActive ? '#ffffff' : 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {list.name}
              </span>
              <span style={{
                fontSize: '0.85rem', fontWeight: 700,
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                background: isActive ? 'rgba(255, 255, 255, 0.22)' : 'var(--bg-hover)',
                padding: '2px 8px', borderRadius: 999
              }}>
                {count}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
