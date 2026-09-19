import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

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
  isDetailed,
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
          <span style={{ fontSize: 14 }}>💰</span>
          Modo Financiero (Costes)
        </span>
        <ChevronDown size={18} style={{ transform: cardFinanceOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardFinanceOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Habilitar Detalles</span>
                <label className="switch">
                  <input type="checkbox" checked={isDetailed} onChange={e => setIsDetailed(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {isDetailed && (
                <>
                  <div className="divider"></div>
                  
                  <div className="detail-row" style={{ padding: '8px 0' }}>
                    <span className="detail-label">Precio/Unidad (€)</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="0.00" 
                      value={price || ''} 
                      onChange={e => setPrice(parseFloat(e.target.value))}
                      style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                    />
                  </div>
                  
                  <div className="divider"></div>

                  <div className="detail-row" style={{ padding: '8px 0' }}>
                    <span className="detail-label">Cantidad</span>
                    <input 
                      type="number" 
                      step="1" 
                      min="1" 
                      value={quantity} 
                      onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                      style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div className="divider"></div>

                  <div className="detail-row" style={{ padding: '8px 0' }}>
                    <span className="detail-label">Marca sugerida</span>
                    <input 
                      type="text" 
                      placeholder="Ej: Nestlé" 
                      value={brand} 
                      onChange={e => setBrand(e.target.value)}
                      style={{ width: 120, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
