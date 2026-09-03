import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, Sparkles, Monitor } from 'lucide-react';

export function InstallPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installInfo, setInstallInfo] = useState<{ title: string; desc: string; isError?: boolean; isEdge?: boolean } | null>(null);

  useEffect(() => {
    // Escuchar el evento nativo de instalación PWA en navegadores compatibles (Edge, Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Si ya está instalado en modo aplicación (standalone) o descartado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = isIOS && /safari/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
    const isChromeIOS = isIOS && /crios/.test(ua);
    const isAndroid = /android/.test(ua);
    const isEdge = /edg\//.test(ua);

    if (isIOS) {
      if (isChromeIOS) {
        setInstallInfo({
          title: 'Abre Safari para Instalar',
          desc: 'Apple requiere Safari para instalar apps. Copia este enlace, ábrelo en Safari y pulsa "Añadir a pantalla de inicio".',
          isError: true
        });
      } else if (isSafari) {
        setInstallInfo({
          title: 'Instala Recordatorios Élite',
          desc: 'Toca el icono de Compartir (⬆️) en Safari y selecciona "Añadir a la pantalla de inicio" para tener la experiencia de app nativa.',
        });
      }
    } else if (isAndroid) {
      setInstallInfo({
        title: 'Instala la App en tu móvil',
        desc: 'Toca el menú de tres puntos (⋮) en tu navegador y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".',
      });
    } else if (isEdge) {
      setInstallInfo({
        title: 'Instalar en Microsoft Edge',
        desc: 'Puedes instalar Recordatorios como app de escritorio. Pulsa el botón "Instalar" abajo o el icono (+) en la barra de direcciones de Edge.',
        isEdge: true
      });
    } else {
      setInstallInfo({
        title: 'Disponible como App de Escritorio',
        desc: 'Abre el menú de tu navegador (los tres puntos en la esquina superior) o haz clic en el icono de instalación en la barra de direcciones.',
      });
    }

    const handleOpenManual = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-install-modal', handleOpenManual);

    let timer: any = null;
    if (!isStandalone && !hasDismissed) {
      timer = setTimeout(() => setIsOpen(true), 2200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('open-install-modal', handleOpenManual);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_prompt_dismissed', 'true');
      }
      setDeferredPrompt(null);
      setIsOpen(false);
    } else {
      handleDismiss();
    }
  };

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
            background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)'
          }}
          onClick={handleDismiss}
        >
          <motion.div 
            key="install-modal-content"
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            style={{ 
              width: '100%', 
              maxWidth: 380, 
              padding: '28px 24px 22px', 
              background: 'var(--bg-elevated, #ffffff)', 
              border: '1px solid var(--border-color, rgba(0,0,0,0.1))',
              borderRadius: 24,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ 
                width: 60, height: 60, borderRadius: 18, 
                background: installInfo.isError 
                  ? 'rgba(255, 59, 48, 0.12)' 
                  : 'linear-gradient(135deg, rgba(10, 132, 255, 0.15), rgba(88, 86, 214, 0.15))',
                color: installInfo.isError ? 'var(--accent-red)' : 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 20px rgba(10, 132, 255, 0.15)'
              }}>
                {installInfo.isError ? <AlertCircle size={30} /> : installInfo.isEdge ? <Monitor size={30} /> : <Download size={30} />}
              </div>
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {deferredPrompt ? 'Instalar Recordatorios Élite' : installInfo.title}
            </h3>
            
            <p style={{ margin: '0 0 24px 0', fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {deferredPrompt 
                ? 'Haz clic en el botón "Instalar Aplicación" a continuación para añadir Recordatorios a tu escritorio o pantalla de inicio.' 
                : installInfo.desc}
            </p>

            <button 
              onClick={handleInstallClick} 
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                background: 'linear-gradient(135deg, var(--accent-primary), #0066ee)', 
                color: 'white',
                border: 'none', fontWeight: 600, fontSize: '0.98rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 18px rgba(10, 132, 255, 0.35)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              {deferredPrompt ? (
                <>
                  <Sparkles size={18} />
                  <span>Instalar Aplicación</span>
                </>
              ) : (
                <span>Entendido</span>
              )}
            </button>
            <button 
              onClick={handleDismiss} 
              style={{
                width: '100%', padding: '10px 0', borderRadius: 12, marginTop: 8,
                background: 'transparent', color: 'var(--text-tertiary)',
                border: 'none', fontWeight: 500, fontSize: '0.88rem', cursor: 'pointer'
              }}
            >
              No volver a mostrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
