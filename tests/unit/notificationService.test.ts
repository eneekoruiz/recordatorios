import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../src/services/NotificationService';

afterEach(() => {
  NotificationService.getInstance().hasPermission = false;
  vi.unstubAllGlobals();
});

describe('weekly briefing browser notifications', () => {
  it('stays quiet when the browser does not expose notifications, even with cached permission', () => {
    vi.stubGlobal('Notification', undefined);
    const service = NotificationService.getInstance();
    service.hasPermission = true;
    expect(() => service.checkAndSendWeeklyNotification(2, 3)).not.toThrow();
  });

  it('does not send without permission', () => {
    const construct = vi.fn();
    vi.stubGlobal('Notification', Object.assign(construct, { permission: 'default' }));
    NotificationService.getInstance().checkAndSendWeeklyNotification(2, 3);
    expect(construct).not.toHaveBeenCalled();
  });
});
