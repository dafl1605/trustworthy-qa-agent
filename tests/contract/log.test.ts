import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatLog, readDatabasePath, readPort } from '@tqa/api';

describe('diagnostics and config', () => {
  it('redacts secret-like fields and keeps the event name', () => {
    const parsed = JSON.parse(
      formatLog('info', 'db.schema_applied', {
        databasePath: './data/demo.sqlite',
        apiKey: 'not-a-real-key',
      }),
    ) as { event: string; databasePath: string; apiKey: string; level: string };

    assert.equal(parsed.event, 'db.schema_applied');
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.databasePath, './data/demo.sqlite');
    assert.equal(parsed.apiKey, '[redacted]');
  });

  it('reads the documented port and database defaults and rejects empty paths', () => {
    assert.equal(readPort({}), 3001);
    assert.equal(readPort({ PORT: '3001' }), 3001);
    assert.throws(() => readPort({ PORT: '0' }));
    assert.throws(() => readPort({ PORT: 'abc' }));
    assert.equal(readDatabasePath({}), './data/demo.sqlite');
    assert.throws(() => readDatabasePath({ DATABASE_PATH: '   ' }));
  });
});
