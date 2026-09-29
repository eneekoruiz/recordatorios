import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import { AppLogo } from '../ui/AppLogo';

type InstallInfo = { title: string; desc: string; isError?: boolean };

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
        desc: 'En iPhone y iPad solo se puede instalar desde Safari. Abre este enlace en Safari y toca Compartir → «Añadir a pantalla de inicio».',
        isError: true
      };
    } else if (isSafari) {
      return {
        title: 'Añade a tu pantalla de inicio',
        desc: 'Toca Compartir en la barra de Safari y elige «Añadir a pantalla de inicio».',
      };
    }
  } else if (isAndroid) {
    return {
      title: 'Instala en tu móvil',
      desc: 'Toca el menú del navegador (⋮) y elige «Instalar aplicación» o «Añadir a pantalla de inicio».',
    };
  } else if (isEdge) {
    return {
      title: 'Instalar en Microsoft Edge',
      desc: 'Abre el menú ··· (arriba a la derecha) → «Aplicaciones» → «Instalar este sitio como aplicación».',
    };
  } else {
    return {
      title: 'Instalar como app',
      desc: 'Abre el menú del navegador y elige «Instalar aplicación» o «Guardar como aplicación».',
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

  const close = () => setIsOpen(false);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return close();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem('pwa_prompt_dismissed', 'true');
    setDeferredPrompt(null);
    close();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!installInfo) return null;

  // Alerta de iOS: icono de la app, título, instrucción y botones de texto.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="install-alert"
          className="premium-overlay alert-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
        >
          <motion.section
            className="app-alert install-alert"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="install-title"
            aria-describedby="install-description"
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="app-alert-copy">
              {installInfo.isError
                ? <span className="install-alert-icon is-error"><AlertCircle size={26} /></span>
                : <AppLogo size={52} style={{ borderRadius: 12, margin: '0 auto 8px' }} />}
              <h2 id="install-title">{deferredPrompt ? 'Instalar Recordatorios' : installInfo.title}</h2>
              <p id="install-description">
                {deferredPrompt
                  ? 'Ábrela desde el escritorio o la pantalla de inicio, en su propia ventana y también sin conexión.'
                  : installInfo.desc}
              </p>
            </div>
            <div className="app-alert-actions">
              {deferredPrompt ? (
                <>
                  <button type="button" className="secondary" onClick={close}>Ahora no</button>
                  <button type="button" className="is-preferred" onClick={handleInstallClick} autoFocus>Instalar</button>
                </>
              ) : (
                <button type="button" className="is-preferred" onClick={close} autoFocus>Entendido</button>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
