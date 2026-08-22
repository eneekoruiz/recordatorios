import { Command, Plus, HelpCircle, Sparkles } from 'lucide-react';

export function BottomShortcutBar() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 40,
        display: 'none',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-surface-glass)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid var(--border-color)',
        borderRadius: 999,
        padding: '5px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        fontSize: '0.75rem',
        color: 'var(--text-tertiary)'
      }}
      className="desktop-shortcut-bar"
    >
      <button
        onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'inherit',
          padding: '2px 4px',
          borderRadius: 4
        }}
      >
        <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-subtle)', fontWeight: 600 }}>Ctrl+K</kbd>
        <span>Buscar</span>
      </button>

      <span style={{ color: 'var(--border-subtle)' }}>•</span>

      <button
        onClick={() => window.dispatchEvent(new Event('open-new-task-drawer'))}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'inherit',
          padding: '2px 4px',
          borderRadius: 4
        }}
      >
        <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-subtle)', fontWeight: 600 }}>N</kbd>
        <span>Nueva</span>
      </button>

      <span style={{ color: 'var(--border-subtle)' }}>•</span>

      <button
        onClick={() => window.dispatchEvent(new Event('open-shortcuts-modal'))}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 'inherit',
          padding: '2px 4px',
          borderRadius: 4
        }}
      >
        <kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border-subtle)', fontWeight: 600 }}>?</kbd>
        <span>Atajos</span>
      </button>
    </div>
  );
}
