import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle } from 'lucide-react';

export function InstallPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [installInfo, setInstallInfo] = useState<{ title: string; desc: string; isError?: boolean } | null>(null);

  useEffect(() => {
    // Si ya está instalado (standalone) o si el usuario lo descartó previamente
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');

    if (isStandalone || hasDismissed) return;

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = isIOS && /safari/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
    const isChromeIOS = isIOS && /crios/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      if (isChromeIOS) {
        setInstallInfo({
          title: 'Abre Safari para Instalar',
          desc: 'Apple no permite instalar apps desde Chrome. Copia este enlace, ábrelo en Safari y selecciona "Añadir a la pantalla de inicio".',
          isError: true
        });
      } else if (isSafari) {
        setInstallInfo({
          title: 'Instala Recordatorios Élite',
          desc: 'Toca el ícono de "Compartir" en la barra inferior de Safari y luego selecciona "Añadir a la pantalla de inicio".',
        });
      }
    } else if (isAndroid) {
      setInstallInfo({
        title: 'Instala la App',
        desc: 'Toca el menú de tres puntos (⋮) en Chrome y selecciona "Añadir a la pantalla de inicio" o "Instalar aplicación".',
      });
    } else {
      // Escritorio u otros
      setInstallInfo({
        title: 'Disponible como App',
        desc: 'Puedes instalar esta web como aplicación nativa desde el menú de tu navegador para usarla offline y sin distracciones.',
      });
    }

    // Retrasar el modal un poco para no asustar al entrar
    const timer = setTimeout(() => setIsOpen(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    setIsOpen(false);
  };

  if (!installInfo) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="install-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ 
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
          }}
          onClick={handleDismiss}
        >
          <motion.div 
            key="install-modal-content"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="surface-card"
            style={{ 
              width: '100%', maxWidth: 360, padding: 24, 
              background: 'var(--bg-base)', border: '1px solid var(--border-focus)',
              boxShadow: 'var(--shadow-xl)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 16, 
                background: installInfo.isError ? 'rgba(255, 59, 48, 0.1)' : 'var(--accent-glow)',
                color: installInfo.isError ? 'var(--accent-red)' : 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {installInfo.isError ? <AlertCircle size={28} /> : <Download size={28} />}
              </div>
            </div>

            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {installInfo.title}
            </h3>
            
            <p style={{ margin: '0 0 24px 0', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {installInfo.desc}
            </p>

            <button 
              onClick={handleDismiss} 
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12,
                background: 'var(--accent-primary)', color: 'white',
                border: 'none', fontWeight: 600, fontSize: '1rem', cursor: 'pointer'
              }}
            >
              Entendido
            </button>
            <button 
              onClick={handleDismiss} 
              style={{
                width: '100%', padding: '12px 0', borderRadius: 12, marginTop: 8,
                background: 'transparent', color: 'var(--text-tertiary)',
                border: 'none', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
