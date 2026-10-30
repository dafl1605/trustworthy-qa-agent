import { migrateDatabase } from './db/migrate.js';
import { startServer } from './server.js';

migrateDatabase();
const server = startServer();

server.on('listening', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 'unknown';
  console.log(`@tqa/api listening on port ${port} (health: GET /health)`);
});
