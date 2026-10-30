export function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT ?? '3001';
  if (!/^\d+$/.test(raw)) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  const port = Number(raw);
  if (port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }
  return port;
}

export function readDatabasePath(env: NodeJS.ProcessEnv): string {
  const raw = env.DATABASE_PATH ?? './data/demo.sqlite';
  if (raw.trim() === '' || raw.includes('\0')) {
    throw new Error('DATABASE_PATH is invalid');
  }
  return raw;
}
