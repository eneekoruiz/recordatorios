import { NotificationService } from '../services/NotificationService';
import { SoundService } from '../services/SoundService';

const ORIGINAL_TITLE = 'Recordatorios';
let titleResetTimeout: number | null = null;

function formatMMSS(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Actualiza el título de la pestaña con la cuenta atrás si la pestaña está en segundo plano.
 */
export function setRestCountdownTitle(secondsLeft: number, isBetweenExercises: boolean = false): void {
  if (typeof document === 'undefined') return;
  
  if (titleResetTimeout) {
    window.clearTimeout(titleResetTimeout);
    titleResetTimeout = null;
  }

  const prefix = isBetweenExercises ? 'Descanso ej.' : 'Descanso';
  document.title = `⏳ ${formatMMSS(secondsLeft)} · ${prefix} | ${ORIGINAL_TITLE}`;
}

/**
 * Notifica que el descanso ha concluido mediante sonido, destello en el título y notificación push local.
 */
export function notifyRestFinished(nextExerciseTitle?: string): void {
  if (typeof document === 'undefined') return;

  SoundService.playRestEnd();

  const titleAlert = nextExerciseTitle
    ? `🔔 ¡A entrenar! ${nextExerciseTitle}`
    : '🔔 ¡Descanso terminado!';

  document.title = `${titleAlert} | ${ORIGINAL_TITLE}`;

  // Si la pestaña no está visible, enviar aviso mediante NotificationService
  if (document.hidden) {
    try {
      NotificationService.getInstance().show('Descanso completado', {
        body: nextExerciseTitle ? `Siguiente: ${nextExerciseTitle}` : 'Es hora de comenzar la siguiente serie.',
        icon: '/favicon.ico',
        tag: 'rest-timer-finished'
      });
    } catch {
      // Ignorar si el usuario bloqueó notificaciones
    }
  }

  // Restaurar el título original después de 8 segundos o cuando la pestaña se active
  if (titleResetTimeout) window.clearTimeout(titleResetTimeout);
  titleResetTimeout = window.setTimeout(() => {
    restoreDocumentTitle();
  }, 8000);
}

/**
 * Restaura el título estándar de la aplicación.
 */
export function restoreDocumentTitle(): void {
  if (typeof document === 'undefined') return;
  if (titleResetTimeout) {
    window.clearTimeout(titleResetTimeout);
    titleResetTimeout = null;
  }
  document.title = ORIGINAL_TITLE;
}
