import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import { HealthResponseSchema } from '@tqa/shared';
import { createApp, listen } from '@tqa/api';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server: Server = createApp();
  await listen(server, 0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a loopback TCP address');
  }
  try {
    assert.equal(address.address, '127.0.0.1');
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

describe('api scaffold', () => {
  it('serves GET /health on loopback and leaves unknown paths unmatched', async () => {
    await withServer(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);
      assert.match(health.headers.get('content-type') ?? '', /application\/json/);
      assert.deepEqual(HealthResponseSchema.parse(await health.json()), {
        status: 'ok',
        service: 'trustworthy-qa-api',
      });

      const missing = await fetch(`${baseUrl}/no-such-route`);
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: 'not_found' });
    });
  });
});
