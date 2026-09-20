// Backend local sin PostgreSQL (datos en memoria). Uso: node tests/support/memory-server.js
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from './memoryPrisma.js';

const PORT = process.env.PORT || 3001;
createApp({ prisma: createMemoryPrisma() }).listen(PORT, '0.0.0.0', () => {
  console.log(`🧪 Backend en memoria escuchando en ${PORT}`);
});
