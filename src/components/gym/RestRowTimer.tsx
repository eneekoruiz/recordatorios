import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Square, Timer, X, Minus, Plus } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { NotificationService } from '../../services/NotificationService';
import { formatRestSeconds } from '../../utils/seriesTasks';

interface RestRowTimerProps {
  title: string;
  minutes: number;
  autoStart?: boolean;
  onChangeMinutes: (minutes: number) => void;
  onFinished?: () => void;
}

const PRESET_SECONDS = [30, 45, 60, 75, 90, 120, 150, 180, 300];
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const label = (min: number) => formatRestSeconds(min * 60);

/**
 * Fila de descanso entre ejercicios: cuánto dura (toca para cambiarlo) y un cronómetro que se pone
 * en marcha con un toque (o auto-arranque tras una serie). Al tocar la duración se abre un selector directo.
 */
export function RestRowTimer({ title, minutes, autoStart = false, onChangeMinutes, onFinished }: RestRowTimerProps) {
  const [endsAt, setEndsAt] = useState<number | null>(() => autoStart ? Date.now() + minutes * 60_000 : null);
  const [now, setNow] = useState(() => Date.now());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const running = endsAt !== null && left > 0;
  const finished = endsAt !== null && left === 0;

  const currentSeconds = Math.max(15, Math.round(minutes * 60));

  // Arranque automático: una sola vez al montar (antes, al volver a cero se rearmaba solo y avisaba en bucle).
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);
  const notifiedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const done = window.setTimeout(() => {
      // Un aviso por descanso, aunque el componente se vuelva a pintar.
      if (notifiedForRef.current === endsAt) return;
      notifiedForRef.current = endsAt;
      SoundService.playComplete();
      HapticService.notification('success');
      // Notificación solo con la app en segundo plano y si llega a tiempo (con el móvil bloqueado los
      // temporizadores se paran y avisaría tarde, de golpe, al desbloquear).
      const late = Date.now() - endsAt > 5000;
      if (typeof document !== 'undefined' && document.hidden && !late) {
        try {
          NotificationService.getInstance().show('Descanso terminado', {
            body: title && !/^descanso/i.test(title.trim()) ? `Siguiente: ${title}` : 'Siguiente serie.',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'gym-rest',
          });
        } catch { /* sin permiso de notificaciones */ }
      }
      onFinishedRef.current?.();
    }, Math.max(0, endsAt - Date.now()));

    // Tras avisar, vuelve a su estado normal (sin volver a arrancar).
    const reset = window.setTimeout(() => setEndsAt(null), Math.max(0, endsAt - Date.now()) + 2500);
    return () => { window.clearInterval(tick); window.clearTimeout(done); window.clearTimeout(reset); };
  }, [endsAt, title]);

  useEffect(() => {
    if (!isPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPickerOpen]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    if (running) { setEndsAt(null); return; }
    const start = Date.now();
    setNow(start);
    setEndsAt(start + minutes * 60_000);
  };

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    setIsPickerOpen(true);
  };

  const applySeconds = (sec: number) => {
    HapticService.selection();
    const clamped = Math.max(15, Math.min(600, Math.round(sec)));
    onChangeMinutes(clamped / 60);
  };

  const selectPreset = (sec: number, e: React.MouseEvent) => {
    e.stopPropagation();
    applySeconds(sec);
    setIsPickerOpen(false);
  };

  const stepSeconds = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.impact('light');
    applySeconds(currentSeconds + delta);
  };

  return (
    <div className={`rest-row${running ? ' is-running' : ''}${finished ? ' is-finished' : ''}`} data-testid="rest-row">
      <Timer size={15} strokeWidth={2.2} aria-hidden="true" className="rest-row-icon" />
      <span className="rest-row-title">{finished ? 'Descanso hecho' : /^descanso entre ejercicios$/i.test(title.trim()) ? 'Descanso' : title}</span>
      {running ? (
        <span className="rest-row-clock" role="timer" aria-label={`Quedan ${fmt(left)} de descanso`}>{fmt(left)}</span>
      ) : (
        <button
          type="button"
          className="rest-row-duration hit-44"
          onClick={openPicker}
          aria-label={`Descanso de ${label(minutes)}. Abrir selector de tiempo`}
        >
          {label(minutes)}
        </button>
      )}
      <button type="button" className="rest-row-toggle" onClick={toggle} aria-label={running ? 'Parar el descanso' : 'Empezar el descanso'}>
        {running ? <Square size={12} fill="currentColor" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
      </button>

      {isPickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="rest-picker-backdrop"
          onClick={(e) => { e.stopPropagation(); setIsPickerOpen(false); }}
          role="presentation"
        >
          <div
            ref={modalRef}
            className="rest-picker-card"
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar tiempo de descanso"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rest-picker-header">
              <span className="rest-picker-title">Descanso entre ejercicios</span>
              <button
                type="button"
                className="rest-picker-close hit-44"
                onClick={(e) => { e.stopPropagation(); setIsPickerOpen(false); }}
                aria-label="Cerrar selector"
              >
                <X size={16} />
              </button>
            </div>

            {/* Stepper fino: sumar o restar 15 segundos */}
            <div className="rest-picker-stepper">
              <button
                type="button"
                className="rest-picker-step-btn hit-44"
                onClick={(e) => stepSeconds(-15, e)}
                disabled={currentSeconds <= 15}
                aria-label="Restar 15 segundos"
              >
                <Minus size={14} strokeWidth={2.5} />
                <span>15 s</span>
              </button>
              <span className="rest-picker-current-val">{formatRestSeconds(currentSeconds)}</span>
              <button
                type="button"
                className="rest-picker-step-btn hit-44"
                onClick={(e) => stepSeconds(15, e)}
                disabled={currentSeconds >= 600}
                aria-label="Sumar 15 segundos"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>15 s</span>
              </button>
            </div>

            {/* Presets rápidos */}
            <div className="rest-picker-grid">
              {PRESET_SECONDS.map((sec) => {
                const isActive = Math.abs(currentSeconds - sec) < 2;
                return (
                  <button
                    key={sec}
                    type="button"
                    className={`rest-picker-chip${isActive ? ' is-active' : ''}`}
                    onClick={(e) => selectPreset(sec, e)}
                    aria-pressed={isActive}
                  >
                    {formatRestSeconds(sec)}
                  </button>
                );
              })}
            </div>

            <div className="rest-picker-footer">
              <button
                type="button"
                className="rest-picker-done-btn hit-44"
                onClick={(e) => { e.stopPropagation(); setIsPickerOpen(false); }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
