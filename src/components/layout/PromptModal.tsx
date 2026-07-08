import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePromptStore } from '../../store/usePromptStore';

export function PromptModal() {
  const { isOpen, title, placeholder, closePrompt } = usePromptStore();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    closePrompt(inputValue);
  };

  const handleCancel = () => {
    closePrompt(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)', pointerEvents: 'auto'
          }}
          onClick={handleCancel}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="surface-card"
            style={{ 
              width: '100%', maxWidth: 400, padding: 24, 
              background: 'var(--bg-base)', border: '1px solid var(--border-focus)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.25rem' }}>{title}</h3>
            <form onSubmit={handleSubmit}>
              <input 
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={placeholder || 'Escribe aquí...'}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border-focus)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  marginBottom: 24,
                  outline: 'none',
                  fontSize: '1rem'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={handleCancel} className="cancel-btn">Cancelar</button>
                <button type="submit" className="save-btn">Aceptar</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
