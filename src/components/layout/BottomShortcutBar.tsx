import { Keyboard } from 'lucide-react';
import { motion } from 'framer-motion';

export function BottomShortcutBar() {
  return (
    <motion.button
      type="button"
      onClick={() => window.dispatchEvent(new Event('open-shortcuts-modal'))}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="desktop-shortcut-bar"
      title="Atajos de teclado (?)"
      aria-label="Atajos de teclado"
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--bg-material, rgba(255, 255, 255, 0.88))',
        backdropFilter: 'blur(25px) saturate(180%)',
        WebkitBackdropFilter: 'blur(25px) saturate(180%)',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.12))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        padding: 0,
        flexShrink: 0
      }}
    >
      <Keyboard size={20} strokeWidth={2} />
    </motion.button>
  );
}

