import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

async function main() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:avisos@recordatorios.app';

  if (!publicKey || !privateKey) {
    console.error('Error: Faltan claves VAPID en .env');
    process.exit(1);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  const prisma = new PrismaClient();
  const subs = await prisma.pushSubscription.findMany();
  console.log(`Encontradas ${subs.length} suscripciones activas en Neon DB.`);

  if (subs.length === 0) {
    console.log('No hay dispositivos suscritos a Web Push aún.');
    await prisma.$disconnect();
    return;
  }

  const payload = JSON.stringify({
    title: '🔔 Helen & Recordatorios (Prueba Vercel)',
    body: '¡Funciona perfectamente! Recordatorio de prueba enviado a tu móvil.',
    tag: 'test-push',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: '/',
      timestamp: Date.now(),
    },
  });

  let sent = 0;
  let failed = 0;

  for (const s of subs) {
    const keys = s.keys;
    const subObj = {
      endpoint: s.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };

    try {
      console.log(`Enviando a endpoint: ${s.endpoint.slice(0, 50)}...`);
      const res = await webpush.sendNotification(subObj, payload, {
        TTL: 60,
        urgency: 'high',
      });
      console.log(`✅ Enviado con éxito (Status: ${res.statusCode})`);
      sent++;
    } catch (err) {
      console.error(`❌ Error enviando a ${s.endpoint.slice(0, 30)}:`, err.message || err);
      failed++;
    }
  }

  console.log(`\nResultado: ${sent} enviadas con éxito, ${failed} fallidas.`);
  await prisma.$disconnect();
}

main().catch(console.error);
