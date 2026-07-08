# Recordatorios Elite

PWA de productividad de nivel Staff Engineer con arquitectura Cloud-Agnostic, diseño UX/UI matemáticamente exacto y soporte Offline-First absoluto.

## Características Clave
- **Cero Agobio Visual:** Revelación progresiva de opciones (Gestalt).
- **Sincronización Bulletproof:** Motor de tokens de sincronización (Push/Pull) sobre PostgreSQL.
- **Offline-First:** Dexie.js (IndexedDB) asume el control cuando no hay conexión.
- **Micro-interacciones:** Feedback háptico (`navigator.vibrate`) y transiciones sedosas de 200ms `ease-out`.
- **Almacenamiento Local-Proxy-to-Cloud:** Integración segura con Cloudflare R2 / AWS S3 sin exponer credenciales en el cliente.

## Requisitos Previos
- Node.js v18+
- Una base de datos PostgreSQL (ej. Neon, Supabase, Render, local).

---

## 🚀 Despliegue en 3 Pasos ("Copy & Paste")

### 1. Variables de Entorno
Duplica el archivo de ejemplo para configurar tus credenciales (opcionales si solo quieres correrlo en modo caché local).
```bash
cp .env.example .env
```
Rellena la variable `DATABASE_URL` en tu nuevo `.env` con la cadena de conexión de tu PostgreSQL.

### 2. Levantar la Base de Datos
Sincroniza el esquema relacional con tu base de datos de forma automática:
```bash
npm install
npx prisma db push --accept-data-loss
```
> *(Nota: Asegúrate de tener Prisma v7 y las credenciales de base de datos correctas).*

### 3. Levantar Frontend & Backend Local
Este comando levantará la interfaz de React (Vite) y activará las Serverless API Routes (que actuarán de proxy para la base de datos y AWS S3).
```bash
npm run dev
```

---

## Estructura de Directorios (Arquitectura)
- `/api`: Vercel Serverless Functions (`/sync/push`, `/sync/pull`, `/upload`).
- `/src/models`: Modelos de datos TypeScript (TaskItem, CustomCycle).
- `/src/store`: Gestor de estado global (Zustand) + Persistencia IndexedDB.
- `/src/db`: Base de datos de caché local (Dexie.js).
- `/src/sync`: Motor de reconciliación de datos en segundo plano (`SyncManager`).
- `/src/components`: UI components estructurados por Heurísticas de Nielsen.
- `/prisma`: Esquema `schema.prisma` declarativo.

## Compilación para Producción (Vercel)
Para subir este proyecto a Vercel, simplemente conéctalo a tu repositorio y Vercel detectará el marco de trabajo automáticamente.
El comando de build es:
```bash
npm run build
```
Vercel compilará la carpeta `dist/` para el FrontEnd y expondrá los archivos `/api` como funciones sin servidor (*Serverless Functions*). No olvides añadir las variables de entorno en el panel de Vercel.
