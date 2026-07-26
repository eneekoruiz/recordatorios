import React from 'react';

export const TaskSkeletonLoader: React.FC = () => {
  return (
    <div className="skeleton-container" style={{ padding: '24px', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <style>{`
        .skeleton-pulse {
          animation: pulse-shimmer 1.5s infinite ease-in-out;
          background: var(--bg-surface, rgba(255, 255, 255, 0.08));
        }
        @keyframes pulse-shimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
      <div className="skeleton-pulse" style={{ width: '180px', height: '32px', borderRadius: '16px', marginBottom: '24px' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton-pulse" style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderRadius: '16px', height: '76px', gap: '16px', background: 'var(--bg-surface-glass)' }}>
            <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="skeleton-pulse" style={{ width: `${60 + (i % 3) * 15}%`, height: '16px', borderRadius: '6px' }} />
              <div className="skeleton-pulse" style={{ width: '40%', height: '12px', borderRadius: '4px', opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
