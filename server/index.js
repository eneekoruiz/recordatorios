import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { createApp, getJwtSecret } from './app.js';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) console.warn('⚠️ DATABASE_URL no está configurada en las variables de entorno.');
if (!getJwtSecret()) console.error('❌ JWT_SECRET no está configurado: el login quedará deshabilitado en producción.');

const prisma = new PrismaClient(dbUrl ? { datasourceUrl: dbUrl } : undefined);
const app = createApp({ prisma });
const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Recordatorios Backend running on port ${PORT}`);
  });
}

export default app;
