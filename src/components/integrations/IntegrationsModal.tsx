import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Calendar, 
  Mail, 
  FileText, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  GitBranch, 
  Key, 
  RefreshCw
} from 'lucide-react';
import { IntegrationService } from '../../services/IntegrationService';
import type { TaskItem } from '../../models/Task';
import { HapticService } from '../../services/HapticService';
import { downloadIcsFile } from '../../utils/icsExporter';
import { useAppStore } from '../../store/useAppStore';
import { getAccountSettings, saveAccountSettings } from '../../utils/accountSettings';

const NOTION_LEGACY_KEYS = { apiKey: 'notion_api_key', databaseId: 'notion_db_id' };
const GITHUB_LEGACY_KEYS = { token: 'github_token', repo: 'github_repo', username: 'github_user' };
interface IntegrationCredentials {
  identity: string;
  notionApiKey: string;
  notionDbId: string;
  githubToken: string;
  githubRepo: string;
  githubUser: string | null;
}

export interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  listName?: string;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  tasks,
  listName = 'Recordatorios'
}) => {
  const [copiedNotion, setCopiedNotion] = useState(false);
  const [copiedGitHub, setCopiedGitHub] = useState(false);
  const [downloadedIcs, setDownloadedIcs] = useState(false);
  const userId = useAppStore(state => state.userId);
  const sessionGeneration = useAppStore(state => state.sessionGeneration);
  const accountIdentity = `${userId ?? 'anonymous'}:${sessionGeneration}`;

  // Notion real connection state
  const [showNotionConfig, setShowNotionConfig] = useState(false);
  const [credentials, setCredentials] = useState<IntegrationCredentials>(() => {
    const notion = getAccountSettings<{ apiKey?: string; databaseId?: string }>(userId, 'notion', {}, NOTION_LEGACY_KEYS);
    const github = getAccountSettings<{ token?: string; repo?: string; username?: string }>(userId, 'github', {}, GITHUB_LEGACY_KEYS);
    return {
      identity: accountIdentity,
      notionApiKey: notion.apiKey || '',
      notionDbId: notion.databaseId || '',
      githubToken: github.token || '',
      githubRepo: github.repo || '',
      githubUser: github.username || null
    };
  });
  const activeCredentials = credentials.identity === accountIdentity ? credentials : {
    identity: accountIdentity, notionApiKey: '', notionDbId: '', githubToken: '', githubRepo: '', githubUser: null
  };
  const { notionApiKey, notionDbId, githubToken, githubRepo, githubUser } = activeCredentials;
  const [notionSaved, setNotionSaved] = useState(false);
  const [savedNotionCredentials, setSavedNotionCredentials] = useState(() => {
    const notion = getAccountSettings<{ apiKey?: string; databaseId?: string }>(userId, 'notion', {}, NOTION_LEGACY_KEYS);
    return { identity: accountIdentity, apiKey: notion.apiKey || '', databaseId: notion.databaseId || '' };
  });
  const [notionSaveError, setNotionSaveError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const modalLayerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // GitHub real connection state
  const [showGitHubConfig, setShowGitHubConfig] = useState(false);
  const [githubTestingIdentity, setGithubTestingIdentity] = useState<string | null>(null);
  const [githubStatus, setGithubStatus] = useState<{ identity: string; message: string } | null>(null);
  const githubTesting = githubTestingIdentity === accountIdentity;
  const githubStatusMessage = githubStatus?.identity === accountIdentity ? githubStatus.message : null;
  const githubRequestIdRef = useRef(0);
  const githubAbortRef = useRef<AbortController | null>(null);

  const [prevIdentity, setPrevIdentity] = useState(accountIdentity);
  if (prevIdentity !== accountIdentity) {
    setPrevIdentity(accountIdentity);
    const notion = getAccountSettings<{ apiKey?: string; databaseId?: string }>(userId, 'notion', {}, NOTION_LEGACY_KEYS);
    const github = getAccountSettings<{ token?: string; repo?: string; username?: string }>(userId, 'github', {}, GITHUB_LEGACY_KEYS);
    setCredentials({
      identity: accountIdentity,
      notionApiKey: notion.apiKey || '',
      notionDbId: notion.databaseId || '',
      githubToken: github.token || '',
      githubRepo: github.repo || '',
      githubUser: github.username || null
    });
    setNotionSaved(false);
    setSavedNotionCredentials({ identity: accountIdentity, apiKey: notion.apiKey || '', databaseId: notion.databaseId || '' });
    setNotionSaveError(null);
    setGithubTestingIdentity(null);
    setGithubStatus(null);
  }

  useEffect(() => {
    githubRequestIdRef.current += 1;
    githubAbortRef.current?.abort();
    githubAbortRef.current = null;
  }, [accountIdentity]);

  const updateCredential = (key: keyof Omit<IntegrationCredentials, 'identity'>, value: string) => {
    setCredentials(current => {
      const base = current.identity === accountIdentity ? current : activeCredentials;
      return { ...base, [key]: value, identity: accountIdentity };
    });
  };

  const isCurrentAccount = (identity: string, expectedUserId: string | null, generation: number) => {
    const current = useAppStore.getState();
    return identity === `${current.userId ?? 'anonymous'}:${current.sessionGeneration}`
      && current.userId === expectedUserId && current.sessionGeneration === generation;
  };

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const layer = modalLayerRef.current;
    const inertSiblings = new Map<HTMLElement, boolean>();
    if (layer) {
      for (const child of Array.from(document.body.children)) {
        if (child instanceof HTMLElement && child !== layer) {
          inertSiblings.set(child, child.inert);
          child.inert = true;
        }
      }
    }

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusInitialControl = () => {
      const firstFocusable = dialog?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || dialog)?.focus();
    };
    focusInitialControl();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      for (const [element, wasInert] of inertSiblings) element.inert = wasInert;
      const opener = openerRef.current;
      const fallback = document.querySelector<HTMLElement>('[data-testid="user-profile-trigger"]');
      const usableOpener = opener?.isConnected && opener.matches(focusableSelector)
        && !opener.closest('.ios-dropdown-menu');
      const target = usableOpener ? opener : fallback;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const handleCopyNotionMarkdown = () => {
    HapticService.selection();
    const md = IntegrationService.exportToNotionMarkdown(tasks, listName);
    navigator.clipboard.writeText(md);
    setCopiedNotion(true);
    setTimeout(() => setCopiedNotion(false), 2000);
  };

  const handleDownloadNotionCsv = () => {
    HapticService.selection();
    IntegrationService.downloadNotionCsv(tasks, `${listName.toLowerCase().replace(/\s+/g, '_')}_notion.csv`);
  };

  const handleSaveNotionConfig = () => {
    const expectedUserId = userId;
    const expectedGeneration = sessionGeneration;
    if (activeCredentials.identity !== accountIdentity || !isCurrentAccount(accountIdentity, expectedUserId, expectedGeneration)) return;
    HapticService.selection();
    const saved = saveAccountSettings(expectedUserId, 'notion', {
      apiKey: notionApiKey.trim(), databaseId: notionDbId.trim()
    }, NOTION_LEGACY_KEYS);
    if (!saved) {
      setNotionSaved(false);
      setNotionSaveError('No se pudieron guardar las credenciales. Revisa el almacenamiento e inténtalo de nuevo.');
      return;
    }
    setNotionSaveError(null);
    setSavedNotionCredentials({ identity: accountIdentity, apiKey: notionApiKey.trim(), databaseId: notionDbId.trim() });
    setNotionSaved(true);
    setTimeout(() => setNotionSaved(false), 2500);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Credenciales de Notion guardadas' }));
  };

  const handleTestGitHubConnection = async () => {
    const expectedUserId = userId;
    const expectedGeneration = sessionGeneration;
    const requestIdentity = accountIdentity;
    if (!isCurrentAccount(requestIdentity, expectedUserId, expectedGeneration)) return;
    if (!githubToken.trim()) {
      setGithubStatus({ identity: requestIdentity, message: 'Introduce un Personal Access Token para verificar.' });
      return;
    }
    githubAbortRef.current?.abort();
    const controller = new AbortController();
    githubAbortRef.current = controller;
    const requestId = ++githubRequestIdRef.current;
    const token = githubToken.trim();
    const repo = githubRepo.trim();
    const isActiveRequest = () => requestId === githubRequestIdRef.current
      && isCurrentAccount(requestIdentity, expectedUserId, expectedGeneration);
    setGithubTestingIdentity(requestIdentity);
    setGithubStatus(null);
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        },
        signal: controller.signal
      });
      if (!isActiveRequest()) return;
      if (res.ok) {
        const data = await res.json();
        if (!isActiveRequest()) return;
        const username = data.login || 'Usuario';
        const saved = saveAccountSettings(expectedUserId, 'github', { token, repo, username }, GITHUB_LEGACY_KEYS);
        if (!saved) {
          setGithubStatus({ identity: requestIdentity, message: 'GitHub verificó el token, pero no se pudieron guardar las credenciales. Inténtalo de nuevo.' });
          return;
        }
        setCredentials(current => current.identity === requestIdentity
          ? { ...current, githubToken: token, githubRepo: repo, githubUser: username }
          : current);
        setGithubStatus({ identity: requestIdentity, message: `¡Conectado exitosamente como @${username}!` });
        HapticService.selection();
      } else {
        setGithubStatus({ identity: requestIdentity, message: 'Token no válido o sin permisos de lectura.' });
      }
    } catch {
      if (isActiveRequest()) setGithubStatus({ identity: requestIdentity, message: 'No se pudo contactar con GitHub. Revisa tu conexión.' });
    } finally {
      if (isActiveRequest()) setGithubTestingIdentity(null);
    }
  };

  const handleDownloadIcs = () => {
    HapticService.selection();
    downloadIcsFile(tasks, `${listName.toLowerCase().replace(/\s+/g, '_')}.ics`, listName);
    setDownloadedIcs(true);
    setTimeout(() => setDownloadedIcs(false), 2500);
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: `Calendario "${listName}" (.ics) descargado. Ábrelo para sincronizar con tu calendario.`
      })
    );
  };

  const handleOpenGoogleCalendar = () => {
    HapticService.selection();
    window.open('https://calendar.google.com', '_blank');
  };

  const handleOpenGmail = () => {
    HapticService.selection();
    window.open('https://mail.google.com', '_blank');
  };

  const handleCopyGitHubMarkdown = () => {
    HapticService.selection();
    const md = IntegrationService.exportToGitHubMarkdown(tasks, listName);
    navigator.clipboard.writeText(md);
    setCopiedGitHub(true);
    setTimeout(() => setCopiedGitHub(false), 2000);
  };

  const handleOpenGitHub = () => {
    HapticService.selection();
    if (githubRepo.trim()) {
      window.open(`https://github.com/${githubRepo.trim()}/issues`, '_blank');
    } else {
      window.open('https://github.com', '_blank');
    }
  };

  if (typeof document === 'undefined') return null;

  const isNotionConfigured = savedNotionCredentials.identity === accountIdentity
    && Boolean(savedNotionCredentials.apiKey && savedNotionCredentials.databaseId)
    && savedNotionCredentials.apiKey === notionApiKey.trim()
    && savedNotionCredentials.databaseId === notionDbId.trim();
  const isGitHubConfigured = !!(githubToken && githubUser);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          ref={modalLayerRef}
          data-testid="integrations-modal-layer"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            pointerEvents: 'auto'
          }}
        >
          {/* Backdrop con blur profundo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          />

          {/* Modal flotante Apple */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            data-testid="integrations-modal"
            aria-label="Vincular con Google Calendar, Gmail y Notion"
            aria-modal="true"
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '540px',
              borderRadius: '26px',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary, #1c1c1e)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Cabecera */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.24rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em'
                  }}
                >
                  Ecosistema & Vinculaciones
                </h3>
                <p
                  style={{
                    margin: '3px 0 0',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary, #8e8e93)'
                  }}
                >
                  Conecta tus tareas con Google Calendar, Gmail, Notion y GitHub
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.06))',
                  color: 'var(--text-secondary, #8e8e93)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Contenido con las 4 integraciones principales */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Google Calendar / iCalendar */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: 'rgba(66, 133, 244, 0.14)',
                      color: '#4285F4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Calendar size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                        Google Calendar
                      </h4>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 6, background: 'rgba(66, 133, 244, 0.12)', color: '#4285F4', fontWeight: 700 }}>
                        iCal estándar
                      </span>
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Sincroniza eventos, duraciones estimadas y citas
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Exporta tus recordatorios a formato estándar .ics para importarlos o suscribirte con un toque en Google Calendar, Apple Calendar u Outlook.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleDownloadIcs}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: downloadedIcs ? 'rgba(48, 209, 88, 0.15)' : '#4285F4',
                      color: downloadedIcs ? '#30d158' : '#ffffff',
                      border: downloadedIcs ? '1px solid #30d158' : 'none',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(66, 133, 244, 0.25)'
                    }}
                  >
                    {downloadedIcs ? <Check size={14} /> : <Download size={14} />}
                    {downloadedIcs ? '¡Archivo .ics descargado!' : 'Sincronizar calendario (.ics)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenGoogleCalendar}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated, #ffffff)',
                      color: '#4285F4',
                      border: '1px solid rgba(66, 133, 244, 0.3)',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={14} /> Abrir Google Calendar
                  </button>
                </div>
              </div>

              {/* 2. Gmail */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: 'rgba(234, 67, 53, 0.14)',
                      color: '#EA4335',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Mail size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                      Gmail
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Localiza correos relacionados con tus tareas
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Búsqueda directa en tu bandeja de entrada de Gmail mediante palabras clave y asuntos de tus tareas.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleOpenGmail}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated, #ffffff)',
                      color: '#EA4335',
                      border: '1px solid rgba(234, 67, 53, 0.3)',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={14} /> Abrir Gmail
                  </button>
                </div>
              </div>

              {/* 3. Notion */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: 'rgba(0, 0, 0, 0.08)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FileText size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                        Notion
                      </h4>
                      {isNotionConfigured && (
                        <span data-testid="notion-configured-status" style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(0, 0, 0, 0.08))', color: 'var(--text-secondary)', fontWeight: 700 }}>
                          Credenciales guardadas · exportación manual
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Exporta como Markdown o CSV para importar
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Pega directamente la tabla en cualquier página de Notion o descarga el archivo CSV para importar en una base de datos con columnas estructuradas.
                </p>

                {/* Notion credentials toggle */}
                {showNotionConfig && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      Configurar token de integración y base de datos:
                    </div>
                    <input
                      type="password"
                      placeholder="API Key (secret_...)"
                      value={notionApiKey}
                      onChange={e => { setNotionSaveError(null); updateCredential('notionApiKey', e.target.value); }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '0.82rem', marginBottom: 6 }}
                    />
                    <input
                      type="text"
                      placeholder="ID de base de datos Notion"
                      value={notionDbId}
                      onChange={e => { setNotionSaveError(null); updateCredential('notionDbId', e.target.value); }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '0.82rem', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleSaveNotionConfig}
                        style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--accent-primary, #007aff)', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {notionSaved ? '✓ Guardado' : 'Guardar credenciales'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNotionConfig(false)}
                        style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Cerrar
                      </button>
                    </div>
                    {notionSaveError && (
                      <div role="alert" style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--accent-red, #c62828)' }}>
                        {notionSaveError}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCopyNotionMarkdown}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: copiedNotion ? 'rgba(48, 209, 88, 0.15)' : 'var(--bg-elevated, #ffffff)',
                      color: copiedNotion ? '#30d158' : 'var(--text-primary)',
                      border: copiedNotion ? '1px solid #30d158' : '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedNotion ? <Check size={14} /> : <Copy size={14} />}
                    {copiedNotion ? '¡Tabla copiada!' : 'Copiar tabla Markdown'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadNotionCsv}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated, #ffffff)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} /> Descargar CSV Notion
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNotionConfig(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Key size={13} /> {isNotionConfigured ? 'Editar credenciales' : 'Configurar credenciales'}
                  </button>
                </div>
              </div>

              {/* 4. GitHub */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: 'rgba(36, 41, 47, 0.12)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <GitBranch size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                        GitHub (Issues & Projects)
                      </h4>
                      {isGitHubConfigured && (
                        <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 6, background: 'rgba(48, 209, 88, 0.15)', color: '#30d158', fontWeight: 700 }}>
                          ✓ @{githubUser}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Exporta como checklist GFM o vincula repositorios
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Copia tus recordatorios en formato de tareas GitHub Markdown (- [ ] Tarea) listo para pegar en cualquier Issue, PR o Project board.
                </p>

                {/* GitHub configuration drawer */}
                {showGitHubConfig && (
                  <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                      Vincular con Personal Access Token (PAT):
                    </div>
                    <input
                      type="password"
                      placeholder="GitHub PAT (ghp_... o token clásico/fine-grained)"
                      value={githubToken}
                      onChange={e => updateCredential('githubToken', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '0.82rem', marginBottom: 6 }}
                    />
                    <input
                      type="text"
                      placeholder="Repositorio por defecto (ej: usuario/recordatorios)"
                      value={githubRepo}
                      onChange={e => updateCredential('githubRepo', e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', fontSize: '0.82rem', marginBottom: 8 }}
                    />
                    {githubStatusMessage && (
                      <div style={{ fontSize: '0.78rem', color: githubUser ? '#30d158' : '#ff453a', marginBottom: 8, fontWeight: 550 }}>
                        {githubStatusMessage}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={githubTesting}
                        onClick={handleTestGitHubConnection}
                        style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--accent-primary, #007aff)', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        {githubTesting && <RefreshCw size={12} className="animate-spin" />}
                        {githubUser ? 'Verificar y Guardar' : 'Probar conexión'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGitHubConfig(false)}
                        style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleCopyGitHubMarkdown}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: copiedGitHub ? 'rgba(48, 209, 88, 0.15)' : 'var(--bg-elevated, #ffffff)',
                      color: copiedGitHub ? '#30d158' : 'var(--text-primary)',
                      border: copiedGitHub ? '1px solid #30d158' : '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedGitHub ? <Check size={14} /> : <Copy size={14} />}
                    {copiedGitHub ? '¡Checklist copiada!' : 'Copiar checklist GitHub'}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenGitHub}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: 'var(--bg-elevated, #ffffff)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <ExternalLink size={14} /> {githubRepo ? `Abrir ${githubRepo}` : 'Abrir GitHub'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGitHubConfig(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Key size={13} /> {isGitHubConfigured ? 'Editar Token' : 'Vincular Token'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
