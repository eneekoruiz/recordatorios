# Recordatorios Élite

[![CI & Quality Assurance](https://github.com/eneekoruiz/recordatorios/actions/workflows/ci.yml/badge.svg)](https://github.com/eneekoruiz/recordatorios/actions/workflows/ci.yml)

PWA de recordatorios inspirada en Recordatorios de Apple: listas y carpetas, ciclos (diario/semanal/mensual/anual), hábitos con contador, caducidades de tarjetas y suscripciones, diario «Qué he hecho», lenguaje natural en español y asistente IA. Funciona sin conexión y se sincroniza entre dispositivos.

## Características

- **Offline-first:** todo el estado vive en el dispositivo (Zustand + IndexedDB) y se sincroniza en segundo plano cuando hay conexión.
- **Sincronización multi-dispositivo:** push/pull incremental con Last-Write-Wins por versión, en cliente y servidor. Los datos de cada cuenta están aislados.
- **Lenguaje natural:** `Reunión mañana a las 10:00 !alta @Trabajo` crea el recordatorio con fecha, hora, prioridad y lista.
- **Listas compartidas de solo lectura** mediante enlace (menú de la lista → *Compartir enlace*).
- **Servidor MCP** (`/api/mcp`) para que un asistente IA lea y cree recordatorios en tu cuenta (requiere token de sesión).
- **Instalable** en iOS, Android y escritorio como PWA.

## Puesta en marcha local

Requisitos: Node.js 20+ y una base de datos PostgreSQL (Neon, Supabase, Railway, local…).

```bash
cp .env.example .env          # rellena DATABASE_URL y JWT_SECRET
npm install
npx prisma db push            # crea las tablas
npm run dev                   # frontend (Vite, :5173) + API (Express, :3001)
```

¿Sin PostgreSQL a mano? `node tests/support/memory-server.js` levanta la API con datos en memoria.

## Despliegue en Vercel

1. Conecta el repositorio en Vercel (detecta Vite automáticamente; `/api` se sirve como función).
2. Añade las variables de entorno: `DATABASE_URL`, `JWT_SECRET` (obligatoria), `APP_URL` y, para recuperar contraseñas por email, `RESEND_API_KEY` y `MAIL_FROM`. Ver `.env.example`.
3. Tras cambios en `prisma/schema.prisma`, ejecuta `npx prisma db push` contra la base de datos de producción.

> En Vercel no hay tiempo real por SSE (las funciones son efímeras); la app sincroniza cada 30 s, al volver a la pestaña y tras cada cambio.

## Avisos con la app cerrada

La app avisa sin saturar: **un resumen al día** a las 9:00 de tu zona horaria («Completa tus recordatorios diarios», «Hoy te tocan los recordatorios semanales» en tu día semanal, «Hoy toca la ronda mensual» el día 1, la revisión anual el 1 de enero) y **las alertas con hora** que pongas en un recordatorio, agrupadas si coinciden. Se activan en el menú del perfil → *Avisos con la app cerrada* (en iPhone, con la app añadida a la pantalla de inicio).

Para ponerlo en marcha:

1. `npx web-push generate-vapid-keys` y guarda `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Vercel.
2. Define `CRON_SECRET` en Vercel. `vercel.json` ya programa una llamada diaria a `/api/cron/notify` (vale para el resumen, también en el plan gratuito).
3. Para que las alertas con hora lleguen puntuales, añade en GitHub los secretos `APP_URL` y `CRON_SECRET`: el flujo `.github/workflows/notify.yml` llama cada 10 minutos.
4. `npx prisma db push` contra producción para crear la tabla de suscripciones (y los índices).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Frontend + API en local |
| `npm test` | Tests unitarios (API, sincronización, NLP) con Vitest |
| `npm run test:e2e` | Tests end-to-end con Playwright (`E2E_MEMORY_DB=1` para no necesitar PostgreSQL) |
| `npm run lint` / `npm run typecheck` | Calidad estática |
| `npm run build` | Build de producción |

## Estructura

- `server/` — API Express: autenticación, sincronización, listas compartidas y MCP (`app.js`), utilidades puras de sincronización (`syncUtils.js`), email (`mail.js`).
- `api/index.js` — punto de entrada de la función serverless de Vercel.
- `src/store/` — estado global (Zustand) persistido en IndexedDB.
- `src/sync/` — motor de sincronización (`syncManager.ts`) y lógica de fusión testeable (`merge.ts`).
- `src/components/` — interfaz por dominios (layout, tasks, auth, share, ai…).
- `src/styles/polish.css` — capa final del sistema visual (paleta clara/oscura, tipografía, barra lateral).
- `tests/unit/` — Vitest · `tests/*.spec.ts` — Playwright.

Más detalle técnico en [ARCHITECTURE.md](ARCHITECTURE.md).
