import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CreditCard, RefreshCw, FileText, Link2 } from 'lucide-react';

interface DrawerExpirationSectionProps {
  cardCaducidadOpen: boolean;
  setCardCaducidadOpen: (open: boolean) => void;
  expirationType?: 'card' | 'subscription' | 'other';
  setExpirationType: (type?: 'card' | 'subscription' | 'other') => void;
  issuerMask: string;
  setIssuerMask: (mask: string) => void;
  autoRollover: boolean;
  setAutoRollover: (auto: boolean) => void;
  subscriptionPeriod: 'monthly' | 'yearly';
  setSubscriptionPeriod: (period: 'monthly' | 'yearly') => void;
  managementUrl: string;
  setManagementUrl: (url: string) => void;
}

export const DrawerExpirationSection: React.FC<DrawerExpirationSectionProps> = ({
  cardCaducidadOpen,
  setCardCaducidadOpen,
  expirationType,
  setExpirationType,
  issuerMask,
  setIssuerMask,
  autoRollover,
  setAutoRollover,
  subscriptionPeriod,
  setSubscriptionPeriod,
  managementUrl,
  setManagementUrl
}) => {
  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardCaducidadOpen(!cardCaducidadOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={15} color="var(--accent-primary)" />
          Tipo de Caducidad {expirationType ? `(${expirationType === 'card' ? 'Tarjeta' : expirationType === 'subscription' ? 'Suscripción' : 'Otro'})` : ''}
        </span>
        <ChevronDown size={18} style={{ transform: cardCaducidadOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardCaducidadOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setExpirationType(expirationType === 'card' ? undefined : 'card')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px',
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                    background: expirationType === 'card' ? 'rgba(255, 149, 0, 0.16)' : 'var(--bg-surface)',
                    border: expirationType === 'card' ? '1.5px solid #ff9500' : '1px solid var(--border-subtle)',
                    color: expirationType === 'card' ? '#ff9500' : 'var(--text-secondary)',
                    fontWeight: expirationType === 'card' ? 600 : 400
                  }}
                >
                  <CreditCard size={20} strokeWidth={2} />
                  <span style={{ fontSize: '0.78rem' }}>Tarjeta / Doc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpirationType(expirationType === 'subscription' ? undefined : 'subscription')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px',
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                    background: expirationType === 'subscription' ? 'rgba(0, 122, 255, 0.16)' : 'var(--bg-surface)',
                    border: expirationType === 'subscription' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                    color: expirationType === 'subscription' ? '#007aff' : 'var(--text-secondary)',
                    fontWeight: expirationType === 'subscription' ? 600 : 400
                  }}
                >
                  <RefreshCw size={20} strokeWidth={2} />
                  <span style={{ fontSize: '0.78rem' }}>Suscripción</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpirationType(expirationType === 'other' ? undefined : 'other')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px',
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                    background: expirationType === 'other' ? 'rgba(142, 142, 147, 0.16)' : 'var(--bg-surface)',
                    border: expirationType === 'other' ? '1.5px solid #8e8e93' : '1px solid var(--border-subtle)',
                    color: expirationType === 'other' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: expirationType === 'other' ? 600 : 400
                  }}
                >
                  <FileText size={20} strokeWidth={2} />
                  <span style={{ fontSize: '0.78rem' }}>Otro</span>
                </button>
              </div>

              {/* Tarjeta / Documento: Campo de Emisor/Identificador estilo Apple Wallet */}
              {expirationType === 'card' && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Identificador / Tarjeta (Apple Wallet)
                  </label>
                  <input
                    type="text"
                    value={issuerMask}
                    onChange={e => setIssuerMask(e.target.value)}
                    placeholder="ej. VISA •• 4821, DNI, Revolut..."
                    style={{
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {['VISA', 'Mastercard', 'DNI', 'Pasaporte', 'Carnet', 'Revolut'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setIssuerMask(issuerMask ? `${preset} ${issuerMask.replace(/^(VISA|Mastercard|DNI|Pasaporte|Carnet|Revolut)\s*/i, '')}` : preset)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-elevated)',
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suscripción: Auto-rollover y periodicidad */}
              {expirationType === 'subscription' && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                      Renovación automática (Auto-rollover)
                    </span>
                    <input
                      type="checkbox"
                      checked={autoRollover}
                      onChange={e => setAutoRollover(e.target.checked)}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Periodicidad de cobro:
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setSubscriptionPeriod('monthly')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          border: subscriptionPeriod === 'monthly' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                          background: subscriptionPeriod === 'monthly' ? 'rgba(0, 122, 255, 0.12)' : 'var(--bg-surface)',
                          color: subscriptionPeriod === 'monthly' ? '#007aff' : 'var(--text-secondary)',
                          fontSize: '0.76rem',
                          fontWeight: subscriptionPeriod === 'monthly' ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubscriptionPeriod('yearly')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: 6,
                          border: subscriptionPeriod === 'yearly' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                          background: subscriptionPeriod === 'yearly' ? 'rgba(0, 122, 255, 0.12)' : 'var(--bg-surface)',
                          color: subscriptionPeriod === 'yearly' ? '#007aff' : 'var(--text-secondary)',
                          fontSize: '0.76rem',
                          fontWeight: subscriptionPeriod === 'yearly' ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        Anual
                      </button>
                    </div>
                  </div>

                  {/* Enlace para gestionar o cancelar suscripción */}
                  <div style={{ marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
                      <Link2 size={12} strokeWidth={2.4} /> Enlace para gestionar o cancelar suscripción:
                    </label>
                    <input
                      type="url"
                      value={managementUrl}
                      onChange={e => setManagementUrl(e.target.value)}
                      placeholder="https://netflix.com/youraccount, spotify.com..."
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
