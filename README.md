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
