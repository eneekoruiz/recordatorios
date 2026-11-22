# Recordatorios

Offline-first Progressive Web Application for managing tasks, habits, and recurring reminders with natural-language input and multi-device synchronization.

Live demo: [recordatorios-delta.vercel.app](https://recordatorios-delta.vercel.app)

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, Framer Motion, Lucide Icons
- **Storage & PWA:** IndexedDB (`idb`), Service Workers, Vite Plugin PWA
- **Backend API:** Express, Prisma ORM, PostgreSQL, bcryptjs, jsonwebtoken, rate-limiting
- **Testing & Tooling:** Vitest, Playwright (including `@axe-core/playwright` accessibility audits), Oxlint

## Architecture & Key Decisions

- **Offline-First Persistence:** Application state is stored locally in IndexedDB via Zustand. Mutations apply optimistically in the browser before queueing for background synchronization.
- **Incremental Multi-Device Sync:** Push/pull synchronization protocol with Last-Write-Wins (LWW) versioning between client and PostgreSQL backend.
- **Natural Language Parsing:** Fast local text tokenizer extracting title, due date, time, priority, and target list from single-line inputs (e.g., `Meeting tomorrow at 10:00 !high @Work`).
- **Distributed Rate Limiting:** Authentication and recovery endpoints persist rate-limit buckets in PostgreSQL, preventing abuse across ephemeral serverless instances.
- **MCP Endpoint:** Embedded Model Context Protocol interface (`/api/mcp`) exposing task reads and creations to authorized AI agents.

## Local Setup

### Prerequisites

- Node.js 22+
- PostgreSQL instance (local, Supabase, Neon, or Railway)

### Installation

```bash
# Clone and install dependencies
git clone https://github.com/eneekoruiz/recordatorios.git
cd recordatorios
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and set DATABASE_URL and JWT_SECRET

# Initialize database schema
npx prisma db push

# Start frontend (port 5173) and backend API (port 3001) concurrently
npm run dev
```

### Verification

```bash
# Run type check and linter
npm run validate

# Run unit tests
npm test

# Run end-to-end tests
npm run test:e2e
```
