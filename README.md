# Recordatorios · PWA Offline-First y Asistente Multi-dispositivo

Aplicación progresiva (PWA) de gestión de tareas, hábitos y rutinas periódicas inspirada en Recordatorios de Apple, con sincronización multi-dispositivo, procesamiento de lenguaje natural y servidor MCP integrado.

- **Demo en vivo:** [recordatorios-delta.vercel.app](https://recordatorios-delta.vercel.app)
- **Documentación de arquitectura:** [DeepWiki - recordatorios](https://deepwiki.com/eneekoruiz/recordatorios)

## Propósito y Valor del Producto

Desarrollada para ofrecer una experiencia de productividad ágil y resiliente, Recordatorios combina la inmediatez de una app nativa en el dispositivo con la capacidad de sincronizar de forma segura entre múltiples navegadores y dispositivos sin depender de conexión constante a la red.

- **Arquitectura Offline-First:** Todo el estado de la aplicación reside en el dispositivo mediante Zustand e IndexedDB (`idb`). Las operaciones de creación, edición y marcado son instantáneas y se aplican de forma optimista, encolándose para sincronización en segundo plano.
- **Sincronización Incremental (LWW):** Protocolo de push/pull diferencial con versionado y resolución de conflictos por última escritura (Last-Write-Wins) tanto en cliente como en el servidor PostgreSQL.
- **Entrada en Lenguaje Natural:** Parser sintáctico local en español que analiza entradas rápidas en una sola línea (por ejemplo: `Reunión mañana a las 10:00 !alta @Trabajo`), extrayendo automáticamente fecha, hora, nivel de prioridad y asignación a lista.
- **Gestión Avanzada de Rutinas y Hábitos:** Soporte para ciclos recurrentes (diario, semanal, mensual y anual), control de caducidades de tarjetas y suscripciones con alertas anticipadas, y vista de calendario consolidada.
- **Servidor MCP Integrado (`/api/mcp`):** Expone un endpoint compatible con el Model Context Protocol para que agentes de inteligencia artificial autorizados puedan consultar y programar recordatorios de forma programática.
- **Alertas y Notificaciones Web Push:** Notificaciones push configuradas mediante claves VAPID y ejecuciones cron serverless protegidas con bloqueos distribuidos (`CronLease`).

## Stack Técnico

- **Frontend & UI:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide Icons
- **Persistencia Local & PWA:** IndexedDB (`idb`), Service Workers, Vite Plugin PWA
- **Backend API & ORM:** Node.js, Express, Prisma ORM, PostgreSQL
- **Seguridad & Rate Limiting:** `bcryptjs`, `jsonwebtoken`, buckets de limitación de tasa distribuidos en base de datos para entornos serverless
- **Calidad y Testing:** Vitest (unitarios y componentes), Playwright (E2E y accesibilidad WCAG con `@axe-core/playwright`), Oxlint

## Estructura del Proyecto

```
├── src/                # Frontend React 18 + TypeScript
│   ├── components/     # Vistas de calendario, hábitos, cajón de tareas y auth
│   ├── lib/            # Parser de lenguaje natural, sincronización y almacén IndexedDB
│   └── stores/         # Estado global y mutaciones optimistas con Zustand
├── server/             # API en Express, endpoints REST, autenticación y servidor MCP
├── prisma/             # Esquema de base de datos relacional y migraciones PostgreSQL
└── tests/              # Suites de pruebas unitarias, mocks y tests E2E con Playwright
```

## Puesta en Marcha Local

### Prerrequisitos

- Node.js 22+
- Instancia de PostgreSQL (local, Supabase, Neon o Railway)

### Instalación y Configuración

```bash
git clone https://github.com/eneekoruiz/recordatorios.git
cd recordatorios
npm install

# Configurar variables de entorno
cp .env.example .env
# Rellenar DATABASE_URL y JWT_SECRET en .env

# Aplicar esquema a la base de datos
npx prisma db push

# Iniciar frontend (puerto 5173) y API Express (puerto 3001) concurrentemente
npm run dev
```

*Nota para desarrollo sin base de datos externa:* Puedes ejecutar `npx tsx tests/support/memory-server.js` para levantar la API con almacenamiento volátil en memoria.

### Verificación y Calidad

```bash
# Comprobación de tipos TypeScript y análisis estático con Oxlint
npm run validate

# Ejecutar suite de pruebas unitarias
npm test

# Ejecutar pruebas End-to-End y auditoría de accesibilidad
npm run test:e2e
```
