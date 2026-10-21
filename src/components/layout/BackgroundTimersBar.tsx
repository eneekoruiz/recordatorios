import { useEffect, useState } from 'react';
import { BackgroundTimers, useBackgroundTimers } from '../../services/BackgroundTimers';
import { formatDuration } from '../../utils/taskDuration';

/** Lo que sigue en marcha por su cuenta, visible en cualquier pantalla (no solo en el modo secuencia). */
export function BackgroundTimersBar() {
  const timers = useBackgroundTimers();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timers.length]);
  if (timers.length === 0) return null;
  return (
    <div className="background-timers" role="region" aria-label="Tareas que siguen en marcha">
      {timers.map((t) => {
        const secondsLeft = Math.max(0, Math.ceil((t.endsAt - now) / 1000));
        const finished = t.done || secondsLeft === 0;
        return (
          <div key={t.id} className="background-timer">
            <span className="background-timer-title">{t.title}</span>
            <span className="background-timer-time">{finished ? 'Terminó' : `quedan ${formatDuration(Math.ceil(secondsLeft / 60))}`}</span>
            <button type="button" className="background-timer-done" onClick={() => BackgroundTimers.finish(t.id)} aria-label={`${finished ? 'Quitar' : 'Dar por terminada'} «${t.title}»`}>
              {finished ? 'Vale' : 'Ya está'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
