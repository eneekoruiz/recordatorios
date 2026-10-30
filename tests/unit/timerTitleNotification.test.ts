// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  setRestCountdownTitle, 
  notifyRestFinished, 
  restoreDocumentTitle 
} from '../../src/utils/timerTitleNotification';
import { SoundService } from '../../src/services/SoundService';

vi.mock('../../src/services/SoundService', () => ({
  SoundService: {
    playRestEnd: vi.fn(),
  }
}));

vi.mock('../../src/services/NotificationService', () => ({
  NotificationService: {
    getInstance: () => ({
      show: vi.fn(),
    })
  }
}));

describe('timerTitleNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreDocumentTitle();
  });

  afterEach(() => {
    restoreDocumentTitle();
  });

  it('updates document title with countdown formatted properly', () => {
    setRestCountdownTitle(90, false);
    expect(document.title).toContain('⏳ 01:30 · Descanso');

    setRestCountdownTitle(125, true);
    expect(document.title).toContain('⏳ 02:05 · Descanso ej.');
  });

  it('triggers sound and updates title when rest finishes', () => {
    notifyRestFinished('Press banca');
    expect(SoundService.playRestEnd).toHaveBeenCalledTimes(1);
    expect(document.title).toContain('🔔 ¡A entrenar! Press banca');
  });

  it('restores document title', () => {
    setRestCountdownTitle(30);
    expect(document.title).toContain('⏳');
    restoreDocumentTitle();
    expect(document.title).toBe('Recordatorios');
  });
});
