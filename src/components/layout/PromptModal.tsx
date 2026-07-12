import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { usePromptStore } from '../../store/usePromptStore';

export function PromptModal() {
  const { isOpen, title, placeholder, closePrompt } = usePromptStore();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setInputValue('');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePrompt(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closePrompt]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    closePrompt(inputValue.trim());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="premium-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0 }} onClick={() => closePrompt(null)}>
          <motion.section className="premium-sheet prompt-sheet" role="dialog" aria-modal="true"
            aria-labelledby="prompt-title" initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.82 }}
            onClick={(event) => event.stopPropagation()}>
            <div className="premium-sheet-icon accent" aria-hidden="true"><Sparkles size={22} /></div>
            <button className="premium-sheet-close" onClick={() => closePrompt(null)} aria-label="Cerrar"><X size={18} /></button>
            <div className="premium-sheet-copy">
              <span className="premium-eyebrow">Acción rápida</span>
              <h2 id="prompt-title">{title}</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <input ref={inputRef} className="premium-input" value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={placeholder || 'Escribe aquí…'} aria-label={title} />
              <div className="premium-sheet-actions">
                <button type="button" className="premium-button secondary" onClick={() => closePrompt(null)}>Cancelar</button>
                <button type="submit" className="premium-button accent" disabled={!inputValue.trim()}>Aceptar</button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
