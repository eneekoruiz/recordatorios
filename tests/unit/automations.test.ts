import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';
import { getAutomationsSnapshot } from '../../server/routes/automations.js';

let server: any;
let base: string;
let prisma: any;

const get = (path: string, token?: string) =>
  fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-with-enough-length';
  process.env.BCRYPT_COST = '4';
  delete process.env.VERCEL;
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = 'test';
  prisma = createMemoryPrisma();
  await new Promise<void>((resolve) => {
    server = createApp({ prisma }).listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

describe('Antigravity Automations API & Integration', () => {
  it('devuelve la lista completa de automatizaciones periódicas de Antigravity', async () => {
    expect((await get('/api/automations')).status).toBe(401);
    expect((await get('/automations')).status).toBe(401);
    const registration = await fetch(base + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'automation-fixture@example.com', password: 'Password123!' })
    });
    expect(registration.status).toBe(200);
    const { token } = await registration.json();
    const res = await get('/api/automations', token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.verification).toBe('catalog-only');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(Array.isArray(body.automations)).toBe(true);
    expect(body.automations.length).toBeGreaterThanOrEqual(3);

    const ids = body.automations.map((a: any) => a.id);
    expect(ids).toContain('egela_sync');
    expect(ids).toContain('icloud_photos');
    expect(ids).toContain('clean_temp_downloads');
    expect(ids).toContain('quota_battery_watchdog');

    const egela = body.automations.find((a: any) => a.id === 'egela_sync');
    expect(egela.cron).toBe('0 5 * * 1');
    expect(egela.daemon).toContain('Antigravity Cron');
    expect(egela.ntfyAlerts).toBeNull();

    const icloud = body.automations.find((a: any) => a.id === 'icloud_photos');
    expect(icloud.cron).toBe('0 3 * * 0');
    expect(icloud.daemon).toContain('Antigravity Cron');
    expect(icloud.ntfyAlerts).toBeNull();
  });

  it('getAutomationsSnapshot devuelve un catálogo sin datos locales ni afirmaciones de ejecución', () => {
    const list = getAutomationsSnapshot();
    expect(list.length).toBe(4);
    for (const item of list) {
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.schedule).toBeDefined();
      expect(item.status).toBe('unverified');
      expect(item).not.toHaveProperty('lastOutput');
      expect(item).not.toHaveProperty('targetScript');
      expect(item.ntfyAlerts).toBeNull();
    }
  });

  it('reconoce palabras clave de automatización en tareas técnicas para delegar a IA', () => {
    const regex = /winget\b|upgrade\s+all|cach[eé]|temporales|temp\b|egela|moodle|dependabot|icloud\b|fotos\b|descargas\b|download\b/i;
    expect(regex.test('Sincronizar eGela y apuntes')).toBe(true);
    expect(regex.test('Organizar fotos de iCloud')).toBe(true);
    expect(regex.test('Limpiar temporales y descargas')).toBe(true);
    expect(regex.test('Comprar pan y leche')).toBe(false);
  });
});
