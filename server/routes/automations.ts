import express from 'express';
import type { AppContext } from '../context.js';

export interface AutomationItem {
  id: string;
  title: string;
  schedule: string;
  cron: string;
  daemon: string;
  status: 'unverified';
  category: 'university' | 'media' | 'system' | 'telemetry';
  ntfyAlerts: null;
}

export function getAutomationsSnapshot(): AutomationItem[] {
  return [
    {
      id: 'egela_sync',
      title: 'Sincronización Semanal de eGela',
      schedule: 'Lunes a las 05:00',
      cron: '0 5 * * 1',
      daemon: 'Antigravity Cron (task-73)',
      status: 'unverified',
      category: 'university',
      ntfyAlerts: null
    },
    {
      id: 'icloud_photos',
      title: 'Triaje y Clasificación de Fotos iCloud',
      schedule: 'Domingos a las 03:00',
      cron: '0 3 * * 0',
      daemon: 'Antigravity Cron (task-75)',
      status: 'unverified',
      category: 'media',
      ntfyAlerts: null
    },
    {
      id: 'clean_temp_downloads',
      title: 'Limpieza de Temporales y Descargas',
      schedule: 'Día 1 de cada mes a las 04:00',
      cron: '0 4 1 * *',
      daemon: 'Antigravity Cron (task-77)',
      status: 'unverified',
      category: 'system',
      ntfyAlerts: null
    },
    {
      id: 'quota_battery_watchdog',
      title: 'Vigilancia de Batería, Cuotas y Salud CLI',
      schedule: 'Continuo / Eventos en tiempo real',
      cron: 'daemon',
      daemon: 'Windows Task Scheduler + ntfy',
      status: 'unverified',
      category: 'telemetry',
      ntfyAlerts: null
    }
  ];
}

export function createAutomationsRouter(context: AppContext) {
  const router = express.Router();
  const { apiLimiter, authenticateToken } = context;

  router.get('/automations', apiLimiter, authenticateToken, (_req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const automations = getAutomationsSnapshot();
    res.json({
      success: true,
      verification: 'catalog-only',
      automations,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
