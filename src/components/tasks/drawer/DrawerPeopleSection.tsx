import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X, Users, User } from 'lucide-react';

interface DrawerPeopleSectionProps {
  cardPeopleOpen: boolean;
  setCardPeopleOpen: (open: boolean) => void;
  people: string[];
  setPeople: (people: string[]) => void;
  personInput: string;
  setPersonInput: (val: string) => void;
  vibe?: string;
  setVibe: (vibe?: string) => void;
}

export const DrawerPeopleSection: React.FC<DrawerPeopleSectionProps> = ({
  cardPeopleOpen,
  setCardPeopleOpen,
  people,
  setPeople,
  personInput,
  setPersonInput,
  vibe,
  setVibe
}) => {
  const handleAddPerson = () => {
    const val = personInput.trim().replace(/^@/, '');
    if (val && !people.includes(val)) {
      setPeople([...people, val]);
      setPersonInput('');
    }
  };

  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardPeopleOpen(!cardPeopleOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} strokeWidth={2.1} />
          Personas involucradas ({people.length})
        </span>
        <ChevronDown size={18} style={{ transform: cardPeopleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardPeopleOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: people.length > 0 ? 10 : 0 }}>
                {people.map(p => (
                  <span 
                    key={p} 
                    style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: 4, 
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                      background: 'rgba(88, 86, 214, 0.14)', color: '#5856d6', border: '1px solid rgba(88, 86, 214, 0.25)' 
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><User size={11} strokeWidth={2.4} /> {p}</span>
                    <button
                      type="button"
                      onClick={() => setPeople(people.filter(x => x !== p))}
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="Nombre de la persona (ej. Laura, Carlos)..."
                  value={personInput}
                  onChange={e => setPersonInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddPerson();
                    }
                  }}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={handleAddPerson}
                  style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Añadir
                </button>
              </div>

              {/* Vibe / Estado de ánimo estilo Apple Journal */}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Vibe / Estado de Ánimo (Apple Journal)
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    '✨ Especial',
                    '🏔️ Aventura',
                    '🎉 Celebración',
                    '💼 Logro',
                    '🍕 Relax',
                    '💪 Deporte',
                    '❤️ Familia'
                  ].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVibe(vibe === v ? undefined : v)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: vibe === v ? '1.5px solid #ff9500' : '1px solid var(--border-subtle)',
                        background: vibe === v ? 'rgba(255, 149, 0, 0.16)' : 'var(--bg-surface)',
                        color: vibe === v ? '#ff9500' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
