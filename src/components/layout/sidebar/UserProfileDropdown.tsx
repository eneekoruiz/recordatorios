import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  Download, 
  Volume2, 
  Smartphone, 
  Moon, 
  HelpCircle, 
  Settings, 
  BarChart, 
  LogOut 
} from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { SoundService } from '../../../services/SoundService';
import { HapticService } from '../../../services/HapticService';
import { syncManager } from '../../../sync/syncManager';
import { confirmDialog } from '../../ui/confirmDialog';

interface UserProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | null;
  user: { name: string; email: string };
  syncStatus: string;
  lastSyncedAt: number | null;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (val: boolean) => void;
  theme: string;
  toggleTheme: () => void;
  setIsListConfigOpen: (val: boolean) => void;
  onSelectView: (view: string) => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  isOpen,
  onClose,
  anchorEl,
  user,
  syncStatus,
  lastSyncedAt,
  soundEnabled,
  setSoundEnabled,
  hapticEnabled,
  setHapticEnabled,
  theme,
  toggleTheme,
  setIsListConfigOpen,
  onSelectView
}) => {
  const isSystemTheme = useAppStore((state) => state.useSystemTheme);
  if (!isOpen || typeof document === 'undefined') return null;

  const rect = anchorEl ? anchorEl.getBoundingClientRect() : null;
  const top = (rect?.bottom || 50) + 8;
  const left = Math.max(12, Math.min((typeof window !== 'undefined' ? window.innerWidth : 360) - 264, (rect?.right || 240) - 240));

  return createPortal(
    <AnimatePresence>
      <motion.div 
        key="sidebar-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
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
          top, 
          left, 
          width: 250, 
          maxHeight: `calc(100dvh - ${top + 16}px)`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          zIndex: 99999,
          borderRadius: 14,
          padding: 6,
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
          boxShadow: '0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* User info in dropdown */}
        <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
        </div>

        <div 
          className="ios-dropdown-item"
          onClick={(e) => { 
            e.stopPropagation(); 
            HapticService.selection();
            syncManager.syncNow(true);
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={16} style={{ animation: syncStatus === 'syncing' ? 'spin-anim 1s linear infinite' : 'none' }} /> 
            Sincronizar ahora
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pendiente'}
          </span>
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { 
            e.stopPropagation(); 
            localStorage.removeItem('pwa_prompt_dismissed'); 
            window.dispatchEvent(new Event('open-install-modal'));
            onClose(); 
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Download size={16} /> Instalar como App
          </span>
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { e.stopPropagation(); HapticService.selection(); const next = SoundService.toggleSound(); setSoundEnabled(next); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Volume2 size={16} /> Sonidos de Interfaz
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
          onClick={(e) => { 
            e.stopPropagation(); 
            const next = HapticService.toggle(); 
            setHapticEnabled(next); 
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Smartphone size={16} /> Vibración Háptica
          </span>
          <div style={{
            width: '36px', height: '22px', borderRadius: '11px',
            background: hapticEnabled ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
            position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
          }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff',
              position: 'absolute', top: '2px', left: hapticEnabled ? '16px' : '2px',
              transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { e.stopPropagation(); HapticService.selection(); toggleTheme(); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Moon size={16} /> Modo Oscuro {isSystemTheme && <span className="theme-auto-badge" style={{ marginLeft: 4 }}>(auto)</span>}
          </span>
          <div style={{
            width: '36px', height: '22px', borderRadius: '11px',
            background: theme === 'dark' ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
            position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
          }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', background: '#ffffff',
              position: 'absolute', top: '2px', left: theme === 'dark' ? '16px' : '2px',
              transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new Event('open-shortcuts-modal')); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HelpCircle size={16} /> Atajos de Teclado
          </span>
          <kbd style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem', fontWeight: 600 }}>?</kbd>
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { 
            e.stopPropagation(); 
            HapticService.selection();
            const data = useAppStore.getState().exportData();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recordatorios_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            onClose();
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}
          title="Descargar copia de seguridad en JSON"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Download size={16} /> Copia de Seguridad Rápida
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>JSON</span>
        </div>
        <div className="ios-dropdown-divider" />
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { e.stopPropagation(); setIsListConfigOpen(true); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', cursor: 'pointer' }}
        >
          <Settings size={16} /> Gestionar Listas
        </div>
        <div 
          className="ios-dropdown-item"
          onClick={(e) => { e.stopPropagation(); onSelectView('ANALYTICS'); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', cursor: 'pointer' }}
        >
          <BarChart size={16} /> Estadísticas y Productividad
        </div>
        <div className="ios-dropdown-divider" />
        <div 
          className="ios-dropdown-item delete"
          onClick={async (e) => {
            e.stopPropagation();
            onClose();
            // Subir lo pendiente antes de cerrar sesión (cerrar sesión borra los datos de este dispositivo).
            await syncManager.syncNow();
            if (syncManager.hasPendingChanges()) {
              const ok = await confirmDialog({
                title: 'Hay cambios sin sincronizar',
                message: 'Algunos cambios de este dispositivo aún no se han subido a la nube. Si cierras sesión ahora se perderán.',
                confirmText: 'Cerrar sesión igualmente',
              });
              if (!ok) return;
            }
            syncManager.stop();
            useAppStore.getState().logout();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', cursor: 'pointer' }}
        >
          <LogOut size={16} /> Cerrar Sesión
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
