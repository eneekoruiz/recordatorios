import React from 'react';
import { Film, Tv, Book, Music, Star, Play, CheckCircle2, Bookmark, XCircle, Heart, MessageSquare, Sparkles } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { HapticService } from '../../services/HapticService';

export interface MediaTrackerFieldsProps {
  task: TaskItem;
  onUpdate: (updates: Partial<TaskItem>) => void;
  isCompact?: boolean;
}

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  'Netflix': { bg: 'rgba(229, 9, 20, 0.14)', color: '#E50914' },
  'HBO Max': { bg: 'rgba(110, 48, 209, 0.14)', color: '#9d65ff' },
  'Prime Video': { bg: 'rgba(0, 168, 225, 0.14)', color: '#00A8E1' },
  'Disney+': { bg: 'rgba(17, 60, 207, 0.14)', color: '#3b71fe' },
  'Apple TV+': { bg: 'rgba(255, 255, 255, 0.12)', color: 'var(--text-primary, #ffffff)' },
  'Filmin': { bg: 'rgba(0, 208, 156, 0.14)', color: '#00D09C' },
  'Movistar+': { bg: 'rgba(0, 122, 255, 0.14)', color: '#007AFF' },
  'Spotify': { bg: 'rgba(30, 215, 96, 0.14)', color: '#1ED760' },
  'Apple Music': { bg: 'rgba(250, 45, 72, 0.14)', color: '#FA2D48' },
  'YouTube': { bg: 'rgba(255, 0, 0, 0.14)', color: '#FF0000' }
};

const COMMON_VIDEO_PLATFORMS = ['Netflix', 'HBO Max', 'Prime Video', 'Disney+', 'Apple TV+', 'Filmin', 'Movistar+'];
const COMMON_AUDIO_PLATFORMS = ['Spotify', 'Apple Music', 'YouTube'];
const COMMON_BOOK_PLATFORMS = ['Kindle', 'Audible', 'Papel', 'Biblioteca'];

export const MediaTrackerFields: React.FC<MediaTrackerFieldsProps> = ({
  task,
  onUpdate,
  isCompact = false
}) => {
  const currentType = task.mediaType || 'other';
  const currentStatus = task.mediaStatus || 'want_to_watch';
  const currentRating = task.mediaRating || 0;
  const currentPlatform = task.mediaPlatform || '';

  const isAudio = currentType === 'music' || currentType === 'podcast';
  const isBook = currentType === 'book';

  const handleStatusChange = (status: TaskItem['mediaStatus']) => {
    HapticService.selection();
    onUpdate({ mediaStatus: status });
  };

  const handleRatingChange = (rating: number) => {
    HapticService.selection();
    onUpdate({ mediaRating: rating === currentRating ? 0 : rating });
  };

  const getStatusLabel = (status: TaskItem['mediaStatus']) => {
    switch (status) {
      case 'want_to_watch':
        if (isAudio) return 'Por escuchar';
        if (isBook) return 'Por leer';
        if (currentType === 'series' || currentType === 'movie') return 'Por ver';
        return 'Pendiente';
      case 'in_progress':
        if (isAudio) return 'Escuchando';
        if (isBook) return 'Leyendo';
        return 'En curso';
      case 'completed':
        if (isAudio) return 'Escuchado';
        if (isBook) return 'Leído';
        if (currentType === 'series' || currentType === 'movie') return 'Visto';
        return 'Completado';
      case 'favorite':
        return 'Favorito';
      case 'dropped':
        return 'Abandonado';
      default:
        return 'Pendiente';
    }
  };

  if (isCompact) {
    const hasAnyMediaInfo = Boolean(
      currentPlatform ||
      task.mediaStatus ||
      task.mediaSeasonEpisode ||
      task.mediaRecommendedBy ||
      task.mediaNotes ||
      currentRating > 0 ||
      task.mediaType
    );
    if (!hasAnyMediaInfo) return null;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
        {/* Badge de Plataforma */}
        {currentPlatform && (
          <span
            style={{
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: PLATFORM_COLORS[currentPlatform]?.bg || 'rgba(255,255,255,0.08)',
              color: PLATFORM_COLORS[currentPlatform]?.color || 'var(--text-secondary)'
            }}
          >
            {currentPlatform}
          </span>
        )}

        {/* Badge de Estado */}
        {currentStatus === 'favorite' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: 'rgba(255, 45, 85, 0.16)',
              color: '#ff2d55'
            }}
          >
            <Heart size={10} fill="currentColor" /> Favorito
          </span>
        )}

        {currentStatus === 'in_progress' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 650,
              background: 'rgba(255, 149, 0, 0.14)',
              color: '#ff9500'
            }}
          >
            <Play size={10} fill="currentColor" /> {getStatusLabel('in_progress')}
          </span>
        )}

        {currentStatus === 'completed' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 650,
              background: 'rgba(48, 209, 88, 0.14)',
              color: '#30d158'
            }}
          >
            <CheckCircle2 size={10} /> {getStatusLabel('completed')}
          </span>
        )}

        {currentStatus === 'want_to_watch' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 650,
              background: 'rgba(94, 92, 230, 0.12)',
              color: '#af52de'
            }}
          >
            <Bookmark size={10} /> {getStatusLabel('want_to_watch')}
          </span>
        )}

        {currentStatus === 'dropped' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 650,
              background: 'rgba(255, 59, 48, 0.12)',
              color: '#ff3b30'
            }}
          >
            <XCircle size={10} /> Abandonado
          </span>
        )}

        {/* Progreso (temporada/capítulo/página) */}
        {task.mediaSeasonEpisode && (
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 6,
              fontSize: '0.72rem',
              fontWeight: 600,
              background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
              color: 'var(--text-secondary)'
            }}
          >
            {task.mediaSeasonEpisode}
          </span>
        )}

        {/* Recomendado por */}
        {task.mediaRecommendedBy && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 6,
              fontSize: '0.70rem',
              fontWeight: 600,
              background: 'rgba(0, 122, 255, 0.10)',
              color: '#007AFF'
            }}
            title={`Recomendado por ${task.mediaRecommendedBy}`}
          >
            <Sparkles size={9} /> {task.mediaRecommendedBy}
          </span>
        )}

        {/* Estrellas de puntuación */}
        {currentRating > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: '0.72rem', color: '#ffcc00' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={11}
                fill={star <= currentRating ? '#ffcc00' : 'none'}
                stroke={star <= currentRating ? '#ffcc00' : 'var(--text-tertiary, #8e8e93)'}
              />
            ))}
          </span>
        )}
      </div>
    );
  }

  const platforms = isAudio
    ? COMMON_AUDIO_PLATFORMS
    : isBook
    ? COMMON_BOOK_PLATFORMS
    : COMMON_VIDEO_PLATFORMS;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 16,
        background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        marginTop: 8
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--text-tertiary)' }}>
          Biblioteca de Vida
        </span>
        {/* Selector de tipo */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { id: 'series', label: 'Serie', icon: Tv },
            { id: 'movie', label: 'Película', icon: Film },
            { id: 'music', label: 'Música', icon: Music },
            { id: 'book', label: 'Libro', icon: Book },
            { id: 'other', label: 'Recuerda', icon: Bookmark },
          ].map(item => {
            const Icon = item.icon;
            const isSelected = currentType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onUpdate({ mediaType: item.id as any })}
                style={{
                  border: 'none',
                  padding: '4px 8px',
                  borderRadius: 8,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: isSelected ? 'var(--accent-primary, #0a84ff)' : 'transparent',
                  color: isSelected ? '#ffffff' : 'var(--text-secondary)'
                }}
              >
                <Icon size={12} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Estados de consumo */}
      <div>
        <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Estado
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'want_to_watch', label: getStatusLabel('want_to_watch'), icon: Bookmark, color: 'var(--text-secondary)' },
            { id: 'in_progress', label: getStatusLabel('in_progress'), icon: Play, color: '#ff9500' },
            { id: 'completed', label: getStatusLabel('completed'), icon: CheckCircle2, color: '#30d158' },
            { id: 'favorite', label: '⭐ Favorito', icon: Heart, color: '#ff2d55' },
            { id: 'dropped', label: 'Abandonado', icon: XCircle, color: '#8e8e93' }
          ].map(st => {
            const isSelected = currentStatus === st.id;
            const Icon = st.icon;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => handleStatusChange(st.id as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 10px',
                  borderRadius: 10,
                  fontSize: '0.80rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  border: isSelected ? `1px solid ${st.color}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                  background: isSelected ? `color-mix(in srgb, ${st.color} 15%, transparent)` : 'var(--bg-elevated, #ffffff)',
                  color: isSelected ? st.color : 'var(--text-secondary)'
                }}
              >
                <Icon size={12} fill={st.id === 'favorite' && isSelected ? 'currentColor' : 'none'} />
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Valoración / Estrellas */}
      <div>
        <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
          Valoración personal
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(star)}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: star <= currentRating ? '#ffcc00' : 'var(--text-tertiary, #8e8e93)',
                transition: 'transform 0.12s ease',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title={`${star} estrellas`}
            >
              <Star
                size={20}
                fill={star <= currentRating ? '#ffcc00' : 'none'}
                stroke="currentColor"
              />
            </button>
          ))}
          {currentRating > 0 && (
            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#ffcc00', marginLeft: 6 }}>
              {currentRating}/5
            </span>
          )}
        </div>
      </div>

      {/* Plataforma & Progreso tracker */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            Plataforma / Dónde
          </label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {platforms.map(plat => (
              <button
                key={plat}
                type="button"
                onClick={() => onUpdate({ mediaPlatform: currentPlatform === plat ? undefined : plat })}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: currentPlatform === plat ? '1px solid currentColor' : '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                  background: PLATFORM_COLORS[plat]?.bg || 'rgba(0,0,0,0.05)',
                  color: PLATFORM_COLORS[plat]?.color || 'inherit',
                  transition: 'background 0.15s ease, border-color 0.15s ease'
                }}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: 140 }}>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
            {isAudio ? 'Pista / Minuto' : isBook ? 'Página / Cap.' : 'Temporada / Cap.'}
          </label>
          <input
            type="text"
            placeholder={isAudio ? 'Pista 4 / Single' : isBook ? 'Pág. 120' : 'T1 E4'}
            value={task.mediaSeasonEpisode || ''}
            onChange={e => onUpdate({ mediaSeasonEpisode: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Quién te la recomendó y Notas personales */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Sparkles size={11} color="var(--accent-primary)" /> Quién te la recomendó / Origen
          </label>
          <input
            type="text"
            placeholder="Ej: Recomendado por mi hermano, oído en la radio..."
            value={task.mediaRecommendedBy || ''}
            onChange={e => onUpdate({ mediaRecommendedBy: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <MessageSquare size={11} color="var(--text-tertiary)" /> Comentario personal o notas
          </label>
          <textarea
            placeholder="Apunta lo que te ha parecido, detalles para acordarte..."
            rows={2}
            value={task.mediaNotes || ''}
            onChange={e => onUpdate({ mediaNotes: e.target.value })}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              boxSizing: 'border-box',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>
    </div>
  );
};
