import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, AlertCircle, Monitor, Share2 } from 'lucide-react';

type InstallInfo = { title: string; desc: string; isError?: boolean; isEdge?: boolean };

/** Instrucciones de instalación según el navegador (se calculan una sola vez). */
function detectInstallInfo(): InstallInfo | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = isIOS && /safari/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
  const isChromeIOS = isIOS && /crios/.test(ua);
  const isAndroid = /android/.test(ua);
  const isEdge = /edg\//.test(ua);

  if (isIOS) {
    if (isChromeIOS) {
      return {
        title: 'Abre Safari para instalar',
        desc: 'Apple solo permite instalar apps desde Safari. Copia el enlace, ábrelo en Safari y toca "Añadir a pantalla de inicio".',
        isError: true
      };
    } else if (isSafari) {
      return {
        title: 'Añade a tu pantalla de inicio',
        desc: 'Toca el botón Compartir (⬆️) en la barra de Safari y selecciona "Añadir a pantalla de inicio" para la experiencia completa.',
      };
    }
  } else if (isAndroid) {
    return {
      title: 'Instala en tu móvil',
      desc: 'Toca el menú del navegador (⋮) y selecciona "Instalar aplicación" o "Añadir a pantalla de inicio".',
    };
  } else if (isEdge) {
    return {
      title: 'Instalar en Microsoft Edge',
      desc: 'Abre el menú ··· en la esquina superior derecha → "Aplicaciones" → "Instalar este sitio como aplicación".',
      isEdge: true
    };
  } else {
    return {
      title: 'Instalar como app de escritorio',
      desc: 'Abre el menú del navegador y selecciona "Instalar aplicación" o "Guardar como aplicación".',
    };
  }
  return null;
}

export function InstallPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installInfo] = useState<InstallInfo | null>(detectInstallInfo);

  useEffect(() => {
    // Evento nativo de instalación PWA (Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleOpenManual = () => setIsOpen(true);
    window.addEventListener('open-install-modal', handleOpenManual);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('open-install-modal', handleOpenManual);
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

  const IconComponent = installInfo.isError ? AlertCircle : installInfo.isEdge ? Monitor : deferredPrompt ? Download : Share2;
  const iconBg = installInfo.isError
    ? 'linear-gradient(135deg, rgba(255,59,48,0.15), rgba(255,59,48,0.08))'
    : 'linear-gradient(135deg, rgba(10,132,255,0.18), rgba(88,86,214,0.12))';
  const iconColor = installInfo.isError ? 'var(--accent-red, #ff3b30)' : 'var(--accent-primary, #007aff)';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="install-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0,
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(20px) saturate(150%)',
            WebkitBackdropFilter: 'blur(20px) saturate(150%)'
          }}
          onClick={handleDismiss}
        >
          <motion.div
            key="install-modal-content"
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.90, opacity: 0, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.8 }}
            style={{
              width: '100%',
              maxWidth: 360,
              padding: '32px 24px 24px',
              background: 'var(--bg-elevated, #ffffff)',
              border: '0.5px solid var(--border-subtle, rgba(0,0,0,0.08))',
              borderRadius: 28,
              boxShadow: '0 40px 80px rgba(0,0,0,0.22), 0 8px 20px rgba(0,0,0,0.08)',
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icono con glow */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18, stiffness: 300, delay: 0.1 }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
                boxShadow: installInfo.isError
                  ? '0 8px 24px rgba(255,59,48,0.2)'
                  : '0 8px 24px rgba(10,132,255,0.2)'
              }}
            >
              <IconComponent size={30} />
            </motion.div>

            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '1.22rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              lineHeight: 1.25
            }}>
              {deferredPrompt ? 'Instala Recordatorios' : installInfo.title}
            </h3>

            <p style={{
              margin: '0 0 28px 0',
              fontSize: '0.90rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: 280
            }}>
              {deferredPrompt
                ? 'Accede más rápido desde tu pantalla de inicio con la experiencia nativa completa.'
                : installInfo.desc}
            </p>

            {/* CTA principal */}
            <motion.button
              onClick={handleInstallClick}
              whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(10,132,255,0.45)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 16,
                background: installInfo.isError ? 'var(--bg-hover)' : 'var(--accent-primary, #007aff)',
                color: installInfo.isError ? 'var(--text-primary)' : 'white',
                border: installInfo.isError ? '1px solid var(--border-subtle)' : 'none',
                fontWeight: 650,
                fontSize: '0.97rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: installInfo.isError ? 'none' : '0 6px 20px rgba(10,132,255,0.3)',
                transition: 'box-shadow 0.2s ease'
              }}
            >
              {deferredPrompt ? (
                <>
                  <Download size={17} />
                  <span>Instalar aplicación</span>
                </>
              ) : (
                <span>Entendido</span>
              )}
            </motion.button>

            {/* Secundario: no mostrar más */}
            <button
              onClick={handleDismiss}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '10px 0',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--text-tertiary)',
                border: 'none',
                fontWeight: 500,
                fontSize: '0.86rem',
                cursor: 'pointer'
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
