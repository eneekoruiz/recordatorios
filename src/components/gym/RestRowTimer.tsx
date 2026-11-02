import { useEffect, useState } from 'react';
import { Play, Square, Timer } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';

interface RestRowTimerProps {
  title: string;
  minutes: number;
  onChangeMinutes: (minutes: number) => void;
}

const STEPS = [1, 1.5, 2, 3, 5];
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const label = (min: number) => (min % 1 ? `${Math.floor(min)}:30` : `${min} min`);

/**
 * Fila de descanso entre ejercicios: cuánto dura (toca para cambiarlo) y un cronómetro que se pone
 * en marcha con un toque. La hora de fin es absoluta, así que sigue bien si la pantalla se apaga.
 */
export function RestRowTimer({ title, minutes, onChangeMinutes }: RestRowTimerProps) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
  const running = endsAt !== null && left > 0;
  const finished = endsAt !== null && left === 0;

  useEffect(() => {
    if (!endsAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const done = window.setTimeout(() => {
      SoundService.playComplete();
      HapticService.notification('success');
    }, Math.max(0, endsAt - Date.now()));
    // Tras avisar, vuelve a su estado normal.
    const reset = window.setTimeout(() => setEndsAt(null), Math.max(0, endsAt - Date.now()) + 2500);
    return () => { window.clearInterval(tick); window.clearTimeout(done); window.clearTimeout(reset); };
  }, [endsAt]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    if (running) { setEndsAt(null); return; }
    const start = Date.now();
    setNow(start);
    setEndsAt(start + minutes * 60_000);
  };

  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    const i = STEPS.indexOf(minutes);
    onChangeMinutes(STEPS[(i + 1) % STEPS.length] ?? 2);
  };

  return (
    <div className={`rest-row${running ? ' is-running' : ''}${finished ? ' is-finished' : ''}`} data-testid="rest-row">
      <Timer size={15} strokeWidth={2.2} aria-hidden="true" className="rest-row-icon" />
      <span className="rest-row-title">{finished ? 'Descanso hecho' : /^descanso entre ejercicios$/i.test(title.trim()) ? 'Descanso' : title}</span>
      {running ? (
        <span className="rest-row-clock" role="timer" aria-label={`Quedan ${fmt(left)} de descanso`}>{fmt(left)}</span>
      ) : (
        <button type="button" className="rest-row-duration hit-44" onClick={cycle} aria-label={`Descanso de ${label(minutes)}. Cambiar duración`}>
          {label(minutes)}
        </button>
      )}
      <button type="button" className="rest-row-toggle" onClick={toggle} aria-label={running ? 'Parar el descanso' : 'Empezar el descanso'}>
        {running ? <Square size={12} fill="currentColor" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
      </button>
    </div>
  );
}
