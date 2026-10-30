export type LogLevel = 'info' | 'error';

export type LogValue = string | number | boolean | null;

export type LogFields = Record<string, LogValue>;

const SECRET_KEY = /api[_-]?key|secret|token|password|authorization/i;

export function formatLog(level: LogLevel, event: string, fields: LogFields = {}): string {
  const safeFields: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'ts' || key === 'level' || key === 'event') {
      continue;
    }
    safeFields[key] = SECRET_KEY.test(key) ? '[redacted]' : value;
  }
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...safeFields,
  });
}

export function log(level: LogLevel, event: string, fields?: LogFields): void {
  process.stdout.write(`${formatLog(level, event, fields)}\n`);
}
