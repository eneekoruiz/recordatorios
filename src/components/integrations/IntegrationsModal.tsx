import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Mail, FileText, Download, Copy, Check, ExternalLink } from 'lucide-react';
import { IntegrationService } from '../../services/IntegrationService';
import type { TaskItem } from '../../models/Task';
import { HapticService } from '../../services/HapticService';

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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleOpenGoogleCalendar = () => {
    HapticService.selection();
    window.open('https://calendar.google.com', '_blank');
  };

  const handleOpenGmail = () => {
    HapticService.selection();
    window.open('https://mail.google.com', '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
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
            role="dialog"
            aria-label="Vincular con Google Calendar, Gmail y Notion"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '520px',
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
                    fontSize: '1.2rem',
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
                  Conecta tus tareas con Google Calendar, Gmail y Notion
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

            {/* Contenido con las 3 integraciones principales */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Google Calendar */}
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
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                      Google Calendar
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Sincroniza eventos, duraciones estimadas y citas
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Cada recordatorio cuenta con un botón directo para añadirlo a tu Google Calendar con duración estimada y notas.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleOpenGoogleCalendar}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 12,
                      background: '#4285F4',
                      color: '#ffffff',
                      border: 'none',
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
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 650 }}>
                      Notion
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Exporta como base de datos o tabla Markdown
                    </span>
                  </div>
                </div>

                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Pega directamente la tabla en una página de Notion o descarga el archivo CSV para importar en una base de datos con columnas estructuradas.
                </p>

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
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
