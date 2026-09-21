import React from 'react';
import { MapPin, Clock, Search, Home, Briefcase } from 'lucide-react';

interface DrawerLocationSectionProps {
  locationName: string;
  setLocationName: (name: string) => void;
  hasLocationAlert: boolean;
  setHasLocationAlert: (has: boolean) => void;
  locationLat: number | null;
  locationLng: number | null;
  locationRadius: number;
  setLocationRadius: (radius: number) => void;
  locationAddress: string;
  selectedPreset: 'current' | 'home' | 'work' | 'custom';
  setSelectedPreset: (preset: 'current' | 'home' | 'work' | 'custom') => void;
  selectPresetLocation: (preset: 'current' | 'home' | 'work' | 'custom') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleAddressSearch: () => void;
  isSearching: boolean;
  searchResults: { lat: string; lon: string; display_name: string }[];
  handleSelectSearchResult: (result: { lat: string; lon: string; display_name: string }) => void;
  saveHomeLocation: (loc: { lat: number; lng: number; address: string }) => void;
  saveWorkLocation: (loc: { lat: number; lng: number; address: string }) => void;
  showAlert: (msg: string) => void;
}

export const DrawerLocationSection: React.FC<DrawerLocationSectionProps> = ({
  locationName,
  setLocationName,
  hasLocationAlert,
  setHasLocationAlert,
  locationLat,
  locationLng,
  locationRadius,
  setLocationRadius,
  locationAddress,
  selectedPreset,
  setSelectedPreset,
  selectPresetLocation,
  searchQuery,
  setSearchQuery,
  handleAddressSearch,
  isSearching,
  searchResults,
  handleSelectSearchResult,
  saveHomeLocation,
  saveWorkLocation,
  showAlert
}) => {
  return (
    <>
      <div className="divider"></div>

      {/* Ubicación Informativa */}
      <div className="detail-row" style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} color="var(--accent-blue)" />
          <span className="detail-label" style={{ marginBottom: 0 }}>Información de Ubicación</span>
        </div>
        <label className="switch">
          <input 
            type="checkbox" 
            checked={!!locationName} 
            onChange={e => setLocationName(e.target.checked ? 'Dirección actual' : '')} 
          />
          <span className="slider round"></span>
        </label>
      </div>
      {!!locationName && (
        <div className="detail-row" style={{ padding: '4px 0', marginTop: -8 }}>
          <input 
            type="text" 
            className="detail-select" 
            placeholder="Escribe la dirección, URL de Google Maps, etc..."
            value={locationName === 'Dirección actual' ? '' : locationName}
            onChange={e => setLocationName(e.target.value)}
            style={{ width: '100%', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}
          />
        </div>
      )}

      <div className="divider"></div>

      {/* Alerta de Aviso al Llegar */}
      <div className="detail-row" style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={18} color="var(--accent-red)" />
          <span className="detail-label" style={{ marginBottom: 0 }}>Aviso al Llegar (Geocerca)</span>
        </div>
        <label className="switch">
          <input 
            type="checkbox" 
            checked={hasLocationAlert} 
            onChange={e => {
              setHasLocationAlert(e.target.checked);
              if (e.target.checked && locationLat === null) {
                selectPresetLocation('current');
              }
            }} 
          />
          <span className="slider round"></span>
        </label>
      </div>

      {hasLocationAlert && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: 'var(--bg-surface)', borderRadius: 8, marginTop: -4, border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          {/* Selector de Presets */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => selectPresetLocation('current')}
              style={{
                flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                background: selectedPreset === 'current' ? 'var(--accent-glow)' : 'transparent',
                color: selectedPreset === 'current' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: selectedPreset === 'current' ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <MapPin size={12} strokeWidth={2.4} /> Actual
            </button>
            <button 
              type="button"
              onClick={() => selectPresetLocation('home')}
              style={{
                flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                background: selectedPreset === 'home' ? 'var(--accent-glow)' : 'transparent',
                color: selectedPreset === 'home' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: selectedPreset === 'home' ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <Home size={12} strokeWidth={2.4} /> Casa
            </button>
            <button 
              type="button"
              onClick={() => selectPresetLocation('work')}
              style={{
                flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                background: selectedPreset === 'work' ? 'var(--accent-glow)' : 'transparent',
                color: selectedPreset === 'work' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: selectedPreset === 'work' ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <Briefcase size={12} strokeWidth={2.4} /> Trabajo
            </button>
            <button 
              type="button"
              onClick={() => setSelectedPreset('custom')}
              style={{
                flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                background: selectedPreset === 'custom' ? 'var(--accent-glow)' : 'transparent',
                color: selectedPreset === 'custom' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: selectedPreset === 'custom' ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <Search size={12} strokeWidth={2.4} /> Buscar
            </button>
          </div>

          {/* Buscador de Nominatim si está seleccionado "custom" */}
          {selectedPreset === 'custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input 
                  type="text"
                  className="detail-select"
                  placeholder="Buscar dirección (ej: Mercadona, Sol, etc.)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddressSearch();
                    }
                  }}
                  style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent' }}
                />
                <button 
                  type="button"
                  onClick={handleAddressSearch}
                  disabled={isSearching}
                  style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent-glow)', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isSearching ? '...' : <Search size={14} />}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '150px', overflowY: 'auto' }}>
                  {searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(res)}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-subtle)' : 'none', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {res.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Detalle de la Ubicación Configurada */}
          {locationLat !== null && locationLng !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2 }}>
                  {locationAddress || 'Ubicación seleccionada'}
                </span>
                
                {/* Botón para guardar ubicación actual como Casa / Trabajo */}
                {(selectedPreset === 'current' || selectedPreset === 'custom') && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        saveHomeLocation({ lat: locationLat, lng: locationLng, address: locationAddress || 'Casa' });
                        showAlert('Ubicación guardada como Casa');
                      }}
                      style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Guardar Casa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        saveWorkLocation({ lat: locationLat, lng: locationLng, address: locationAddress || 'Trabajo' });
                        showAlert('Ubicación guardada como Trabajo');
                      }}
                      style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      Guardar Trab.
                    </button>
                  </div>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: 12, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                <span>Lat: {locationLat.toFixed(5)}</span>
                <span>Lng: {locationLng.toFixed(5)}</span>
              </div>

              <div className="detail-row" style={{ padding: '4px 0', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Radio de aviso</span>
                <select 
                  className="detail-select"
                  value={locationRadius}
                  onChange={e => setLocationRadius(Number(e.target.value))}
                  style={{ width: 'auto', border: 'none', background: 'transparent', paddingRight: 4 }}
                >
                  <option value={100}>100 metros</option>
                  <option value={250}>250 metros</option>
                  <option value={500}>500 metros</option>
                  <option value={1000}>1 kilómetro</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
