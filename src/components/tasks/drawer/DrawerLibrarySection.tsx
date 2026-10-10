import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Film, Tv, Music, Book, Bookmark, Star, Heart, CheckCircle2, Play, BookmarkCheck, XCircle, Sparkles, MessageSquare } from 'lucide-react';
import { SectionTrailing } from './SectionTrailing';
import { HapticService } from '../../../services/HapticService';
import type { TaskItem } from '../../../models/Task';

interface DrawerLibrarySectionProps {
  cardLibraryOpen: boolean;
  setCardLibraryOpen: (open: boolean) => void;
  mediaType?: TaskItem['mediaType'];
  setMediaType: (type: TaskItem['mediaType']) => void;
  mediaStatus?: TaskItem['mediaStatus'];
  setMediaStatus: (status: TaskItem['mediaStatus']) => void;
  mediaRating?: number;
  setMediaRating: (rating?: number) => void;
  mediaPlatform?: string;
  setMediaPlatform: (platform: string) => void;
  mediaSeasonEpisode?: string;
  setMediaSeasonEpisode: (val: string) => void;
  mediaRecommendedBy?: string;
  setMediaRecommendedBy: (val: string) => void;
  mediaNotes?: string;
  setMediaNotes: (val: string) => void;
}

const COMMON_VIDEO_PLATFORMS = ['Netflix', 'HBO Max', 'Prime Video', 'Disney+', 'Apple TV+', 'Filmin', 'Movistar+'];
const COMMON_AUDIO_PLATFORMS = ['Spotify', 'Apple Music', 'YouTube'];
const COMMON_BOOK_PLATFORMS = ['Kindle', 'Audible', 'Papel', 'Biblioteca'];

export const DrawerLibrarySection: React.FC<DrawerLibrarySectionProps> = ({
  cardLibraryOpen,
  setCardLibraryOpen,
  mediaType = 'movie',
  setMediaType,
  mediaStatus = 'want_to_watch',
  setMediaStatus,
  mediaRating = 0,
  setMediaRating,
  mediaPlatform = '',
  setMediaPlatform,
  mediaSeasonEpisode = '',
  setMediaSeasonEpisode,
  mediaRecommendedBy = '',
  setMediaRecommendedBy,
  mediaNotes = '',
  setMediaNotes
}) => {
  const isAudio = mediaType === 'music' || mediaType === 'podcast';
  const isBook = mediaType === 'book';

  const typeLabel = mediaType === 'movie' ? 'Película' :
    mediaType === 'series' ? 'Serie' :
    mediaType === 'music' ? 'Música' :
    mediaType === 'book' ? 'Libro' : 'Recuerda';

  const statusLabel = mediaStatus === 'favorite' ? 'Favorito' :
    mediaStatus === 'completed' ? (isAudio ? 'Escuchado' : isBook ? 'Leído' : 'Visto') :
    mediaStatus === 'in_progress' ? (isAudio ? 'Escuchando' : isBook ? 'Leyendo' : 'En curso') :
    mediaStatus === 'dropped' ? 'Abandonado' :
    (isAudio ? 'Por escuchar' : isBook ? 'Por leer' : 'Por ver');

  const summary = `${typeLabel} · ${statusLabel}${mediaRating && mediaRating > 0 ? ` · ${mediaRating}★` : ''}`;

  const platformSuggestions = isAudio ? COMMON_AUDIO_PLATFORMS : isBook ? COMMON_BOOK_PLATFORMS : COMMON_VIDEO_PLATFORMS;

  return (
    <div id="drawer-library-section" className="section-card">
      <button
        type="button"
        className="section-card-header"
        onClick={() => setCardLibraryOpen(!cardLibraryOpen)}
        aria-expanded={cardLibraryOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Film size={15} color="var(--accent-primary)" />
          Biblioteca de Vida
        </span>
        <SectionTrailing open={cardLibraryOpen} summary={summary} />
      </button>

      <AnimatePresence>
        {cardLibraryOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }}
            style={{ overflow: 'hidden' }}
          >
            <div className="section-card-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 1. Selector de Tipo de Obra */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Tipo de contenido
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { id: 'movie' as const, label: 'Película', icon: Film },
                    { id: 'series' as const, label: 'Serie', icon: Tv },
                    { id: 'music' as const, label: 'Música', icon: Music },
                    { id: 'book' as const, label: 'Libro', icon: Book },
                    { id: 'other' as const, label: 'Recuerda', icon: Bookmark },
                  ].map(t => {
                    const Icon = t.icon;
                    const isSelected = mediaType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          HapticService.selection();
                          setMediaType(t.id);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 4px',
                          borderRadius: 10,
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                          background: isSelected ? 'color-mix(in srgb, var(--accent-primary) 12%, var(--bg-surface))' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
                        }}
                      >
                        <Icon size={16} />
                        <span style={{ fontSize: '0.70rem', fontWeight: isSelected ? 700 : 500 }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Selector de Estado de Consumo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  Estado
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {[
                    { id: 'want_to_watch' as const, label: isAudio ? 'Por escuchar' : isBook ? 'Por leer' : 'Por ver', icon: BookmarkCheck, color: '#af52de' },
                    { id: 'in_progress' as const, label: isAudio ? 'Escuchando' : isBook ? 'Leyendo' : 'En curso', icon: Play, color: '#ff9500' },
                    { id: 'completed' as const, label: isAudio ? 'Escuchado' : isBook ? 'Leído' : 'Visto', icon: CheckCircle2, color: '#30d158' },
                    { id: 'favorite' as const, label: 'Favorito', icon: Heart, color: '#ff2d55' },
                    { id: 'dropped' as const, label: 'Abandonado', icon: XCircle, color: '#8e8e93' },
                  ].map(s => {
                    const Icon = s.icon;
                    const isSelected = mediaStatus === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          HapticService.selection();
                          setMediaStatus(s.id);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 4px',
                          borderRadius: 10,
                          border: isSelected ? `1px solid ${s.color}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                          background: isSelected ? `color-mix(in srgb, ${s.color} 14%, var(--bg-surface))` : 'var(--bg-surface)',
                          color: isSelected ? s.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
                        }}
                      >
                        <Icon size={15} />
                        <span style={{ fontSize: '0.67rem', fontWeight: isSelected ? 700 : 500, textAlign: 'center', lineHeight: 1.15 }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Valoración Personal (Estrellas) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Tu valoración
                  </label>
                  {mediaRating > 0 && (
                    <button
                      type="button"
                      onClick={() => setMediaRating(0)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '0.72rem', cursor: 'pointer', padding: 0 }}
                    >
                      Quitar nota
                    </button>
                  )}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))' }}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const filled = star <= mediaRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          HapticService.selection();
                          setMediaRating(star === mediaRating ? 0 : star);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', transition: 'transform 0.1s ease' }}
                        aria-label={`${star} estrellas`}
                      >
                        <Star
                          size={22}
                          fill={filled ? '#ffcc00' : 'none'}
                          stroke={filled ? '#ffcc00' : 'var(--border-subtle, #8e8e93)'}
                          strokeWidth={1.75}
                        />
                      </button>
                    );
                  })}
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: mediaRating > 0 ? '#ffcc00' : 'var(--text-tertiary)', marginLeft: 6 }}>
                    {mediaRating > 0 ? `${mediaRating} / 5` : 'Sin puntuar'}
                  </span>
                </div>
              </div>

              {/* 4. Plataforma y Progreso */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {/* Plataforma */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    Plataforma / Dónde
                  </label>
                  <input
                    type="text"
                    value={mediaPlatform}
                    onChange={e => setMediaPlatform(e.target.value)}
                    placeholder="Ej. Netflix, Spotify, Kindle..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.86rem'
                    }}
                  />
                  {/* Chips sugeridos */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {platformSuggestions.slice(0, 4).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          HapticService.selection();
                          setMediaPlatform(p);
                        }}
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 7px',
                          borderRadius: 6,
                          border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                          background: mediaPlatform === p ? 'var(--accent-primary)' : 'var(--bg-surface)',
                          color: mediaPlatform === p ? '#fff' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progreso (Temporada/Episodio o Página) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                    {isBook ? 'Páginas / Capítulo' : mediaType === 'series' ? 'Temporada / Episodio' : 'Edición / Versión'}
                  </label>
                  <input
                    type="text"
                    value={mediaSeasonEpisode}
                    onChange={e => setMediaSeasonEpisode(e.target.value)}
                    placeholder={isBook ? 'Ej. Pág. 140 / 350' : mediaType === 'series' ? 'Ej. T3 E7' : 'Ej. Directores cut'}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.86rem'
                    }}
                  />
                </div>
              </div>

              {/* 5. Recomendado por */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  <Sparkles size={12} color="var(--accent-primary)" /> Recomendado por
                </label>
                <input
                  type="text"
                  value={mediaRecommendedBy}
                  onChange={e => setMediaRecommendedBy(e.target.value)}
                  placeholder="Ej. Carlos, podcast de cine, Twitter..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem'
                  }}
                />
              </div>

              {/* 6. Tus notas y comentarios */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 650, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                  <MessageSquare size={12} /> Comentarios personales
                </label>
                <textarea
                  value={mediaNotes}
                  onChange={e => setMediaNotes(e.target.value)}
                  placeholder="Tus impresiones, qué te ha parecido, frases que te gustaron..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.86rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.4
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
