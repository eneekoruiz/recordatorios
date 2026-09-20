import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Coins } from 'lucide-react';

interface DrawerFinanceSectionProps {
  cardFinanceOpen: boolean;
  setCardFinanceOpen: (open: boolean) => void;
  isDetailed: boolean;
  setIsDetailed: (isDetailed: boolean) => void;
  price?: number;
  setPrice: (price?: number) => void;
  quantity: number;
  setQuantity: (quantity: number) => void;
  brand: string;
  setBrand: (brand: string) => void;
}

export const DrawerFinanceSection: React.FC<DrawerFinanceSectionProps> = ({
  cardFinanceOpen,
  setCardFinanceOpen,
  setIsDetailed,
  price,
  setPrice,
  quantity,
  setQuantity,
  brand,
  setBrand
}) => {
  return (
    <div className="section-card" style={{ marginBottom: '0' }}>
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardFinanceOpen(!cardFinanceOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Coins size={16} color="var(--accent-primary)" />
          <span>Precio y Costes</span>
          {price !== undefined && price > 0 && (
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 5,
              background: 'var(--bg-hover, rgba(0,0,0,0.05))',
              color: 'var(--accent-primary)',
              marginLeft: 4
            }}>
              {price.toLocaleString('es-ES')} €
            </span>
          )}
        </span>
        <ChevronDown size={18} style={{ transform: cardFinanceOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardFinanceOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              {/* Campo principal de Precio siempre accesible */}
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label" style={{ fontWeight: 500 }}>Precio / Coste (€)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    placeholder="0.00" 
                    value={price !== undefined && price !== null && !isNaN(price) ? price : ''} 
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                      setPrice(val);
                      if (val && val > 0) setIsDetailed(true);
                    }}
                    style={{
                      width: 90,
                      textAlign: 'right',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 8,
                      padding: '5px 8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.92rem',
                      fontWeight: 600
                    }}
                  />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500 }}>€</span>
                </div>
              </div>

              <div className="divider" />

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Cantidad</span>
                <input 
                  type="number" 
                  step="1" 
                  min="1" 
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                  style={{
                    width: 75,
                    textAlign: 'right',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '5px 8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div className="divider" />

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Marca / Proveedor</span>
                <input 
                  type="text" 
                  placeholder="Ej: Nike, Apple, CK" 
                  value={brand} 
                  onChange={e => setBrand(e.target.value)}
                  style={{
                    width: 140,
                    textAlign: 'right',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: '5px 8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
