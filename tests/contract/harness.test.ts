import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { describe, it } from 'node:test';
import { CheckoutConfirmationSchema, OrderLookupResultSchema, type TestScenario } from '@tqa/shared';
import { createApp, harnessTokensMatch, isLoopbackAddress, listen, readHarnessConfig } from '@tqa/api';
import { applySchema, openDatabase } from '@tqa/api/migrate';
import { verifyPersistedOrder } from '@tqa/api/verify';

const token = 'tqa-test-token';
const runA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const runB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const missingId = '44444444-4444-4444-8444-444444444444';

type ApiDatabase = ReturnType<typeof openDatabase>;

async function withHarness(
  run: (baseUrl: string, db: ApiDatabase) => Promise<void>,
  options?: { harness?: boolean },
): Promise<void> {
  const db = openDatabase(':memory:');
  applySchema(db);
  const server: Server = createApp(
    options?.harness === false ? { database: db } : { database: db, harness: { token } },
  );
  await listen(server, 0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a loopback TCP address');
  }
  try {
    assert.equal(address.address, '127.0.0.1');
    await run(`http://127.0.0.1:${address.port}`, db);
  } finally {
    server.close();
    await once(server, 'close');
    if (db.open) {
      db.close();
    }
  }
}

function orderCount(db: ApiDatabase, runId?: string): number {
  if (runId === undefined) {
    const row = db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) AS count FROM orders WHERE run_id = ?').get(runId) as {
    count: number;
  };
  return row.count;
}

function itemCount(db: ApiDatabase, runId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM order_items
       WHERE order_id IN (SELECT order_id FROM orders WHERE run_id = ?)`,
    )
    .get(runId) as { count: number };
  return row.count;
}

async function postCheckout(baseUrl: string, runId: string, search = ''): Promise<Response> {
  return fetch(`${baseUrl}/api/checkout${search}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      runId,
      items: [{ sku: 'SKU-MUG', quantity: 1 }],
      scenario: 'GHOST_SUCCESS',
      totalCents: 1,
    }),
  });
}

async function setScenario(
  baseUrl: string,
  runId: string,
  scenario: TestScenario,
  header: string | null = token,
): Promise<Response> {
  return fetch(`${baseUrl}/harness/runs/${runId}/scenario`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(header === null ? {} : { 'x-tqa-harness-token': header }),
    },
    body: JSON.stringify({ scenario }),
  });
}

async function resetRun(baseUrl: string, runId: string): Promise<Response> {
  return fetch(`${baseUrl}/harness/runs/${runId}/reset`, {
    method: 'POST',
    headers: { 'x-tqa-harness-token': token },
  });
}

async function captureStdout(run: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

describe('fault harness', () => {
  it('keeps the harness disabled unless both controls are present', () => {
    assert.equal(readHarnessConfig({}), undefined);
    assert.equal(readHarnessConfig({ TQA_HARNESS: '1' }), undefined);
    assert.equal(readHarnessConfig({ TQA_HARNESS: '1', TQA_HARNESS_TOKEN: '' }), undefined);
    assert.equal(readHarnessConfig({ TQA_HARNESS: 'true', TQA_HARNESS_TOKEN: token }), undefined);
    assert.equal(readHarnessConfig({ TQA_HARNESS: '0', TQA_HARNESS_TOKEN: token }), undefined);
    assert.deepEqual(readHarnessConfig({ TQA_HARNESS: '1', TQA_HARNESS_TOKEN: token }), { token });
    assert.equal(harnessTokensMatch(token, token), true);
    assert.equal(harnessTokensMatch('short', token), false);
    assert.equal(harnessTokensMatch(`${token}-extra-characters`, token), false);
    assert.equal(isLoopbackAddress('127.0.0.1'), true);
    assert.equal(isLoopbackAddress('::1'), true);
    assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackAddress('8.8.8.8'), false);
    assert.equal(isLoopbackAddress(undefined), false);
  });

  it('does not mount harness routes or skip persistence when the harness is off', async () => {
    await withHarness(async (baseUrl, db) => {
      const hidden = await setScenario(baseUrl, runA, 'GHOST_SUCCESS');
      assert.equal(hidden.status, 404);
      assert.deepEqual(await hidden.json(), { error: 'not_found' });

      const response = await postCheckout(baseUrl, runA, '?scenario=GHOST_SUCCESS');
      const confirmation = CheckoutConfirmationSchema.parse(await response.json());
      assert.equal(confirmation.totalCents, 1299);
      assert.equal(orderCount(db, runA), 1);
      const lookup = OrderLookupResultSchema.parse(
        await (await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`)).json(),
      );
      assert.equal(lookup.code, 'FOUND');
      assert.equal(verifyPersistedOrder(db, confirmation.orderId).code, 'CONFIRMED');
    }, { harness: false });
  });

  it('rejects a missing, wrong, or query-string token without changing the run', async () => {
    await withHarness(async (baseUrl, db) => {
      const logs = await captureStdout(async () => {
        const missing = await setScenario(baseUrl, runA, 'GHOST_SUCCESS', null);
        assert.equal(missing.status, 401);
        assert.deepEqual(await missing.json(), { error: 'unauthorized' });

        const wrong = await setScenario(baseUrl, runA, 'GHOST_SUCCESS', 'not-the-token');
        assert.equal(wrong.status, 401);

        const fromQuery = await fetch(
          `${baseUrl}/harness/runs/${runA}/scenario?token=${encodeURIComponent(token)}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ scenario: 'GHOST_SUCCESS' }),
          },
        );
        assert.equal(fromQuery.status, 401);
        assert.equal(JSON.stringify(await fromQuery.json()).includes(token), false);
      });
      assert.equal(logs.includes(token), false);
      assert.equal(logs.includes('x-tqa-harness-token'), false);

      const current = await fetch(`${baseUrl}/harness/runs/${runA}`, {
        headers: { 'x-tqa-harness-token': token },
      });
      assert.equal(current.status, 200);
      assert.deepEqual(await current.json(), { runId: runA, scenario: 'NORMAL' });
      assert.equal(orderCount(db), 0);

      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all() as Array<{ name: string }>;
      assert.deepEqual(
        tables.map((table) => table.name),
        ['harness_checkouts', 'harness_runs', 'order_items', 'orders'],
      );
      const columns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
      assert.equal(
        columns.some((column) => column.name === 'scenario'),
        false,
      );
    });
  });

  it('persists NORMAL, skips rows for GHOST_SUCCESS, and blocks reads for VERIFICATION_UNAVAILABLE', async () => {
    await withHarness(async (baseUrl, db) => {
      assert.equal((await setScenario(baseUrl, runA, 'NORMAL')).status, 200);
      const normal = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runA)).json());
      assert.equal(normal.message, 'Order confirmed');
      assert.equal(normal.totalCents, 1299);
      assert.equal(orderCount(db, runA), 1);
      const normalLookup = OrderLookupResultSchema.parse(
        await (await fetch(`${baseUrl}/api/orders/${normal.orderId}`)).json(),
      );
      assert.equal(normalLookup.code, 'FOUND');
      const confirmed = verifyPersistedOrder(db, normal.orderId);
      assert.equal(confirmed.code, 'CONFIRMED');
      if (confirmed.code !== 'CONFIRMED') {
        return;
      }
      assert.equal(confirmed.order.totalCents, 1299);

      assert.equal((await setScenario(baseUrl, runB, 'GHOST_SUCCESS')).status, 200);
      let ghostLogs = '';
      let ghostBody: unknown;
      ghostLogs = await captureStdout(async () => {
        const response = await postCheckout(baseUrl, runB);
        assert.equal(response.status, 200);
        ghostBody = await response.json();
      });
      const ghost = CheckoutConfirmationSchema.parse(ghostBody);
      assert.equal(ghost.message, 'Order confirmed');
      assert.equal(ghost.totalCents, 1299);
      assert.equal('scenario' in ghost, false);
      assert.equal(orderCount(db, runB), 0);
      assert.equal(itemCount(db, runB), 0);
      const ghostMeta = db
        .prepare('SELECT persisted FROM harness_checkouts WHERE order_id = ?')
        .get(ghost.orderId) as { persisted: number };
      assert.equal(ghostMeta.persisted, 0);
      const ghostLookup = await fetch(`${baseUrl}/api/orders/${ghost.orderId}`);
      assert.equal(ghostLookup.status, 404);
      assert.deepEqual(OrderLookupResultSchema.parse(await ghostLookup.json()), {
        code: 'ABSENT',
        status: 404,
        orderId: ghost.orderId,
      });
      assert.deepEqual(verifyPersistedOrder(db, ghost.orderId), {
        code: 'DEFECT',
        orderId: ghost.orderId,
        reason: 'not_persisted',
      });
      assert.match(ghostLogs, /"event":"harness\.fault"/);
      assert.match(ghostLogs, /"persisted":false/);
      assert.equal(ghostLogs.includes('"event":"api.checkout_persisted"'), false);
      assert.equal(ghostLogs.includes(token), false);

      const stillNormal = OrderLookupResultSchema.parse(
        await (await fetch(`${baseUrl}/api/orders/${normal.orderId}`)).json(),
      );
      assert.equal(stillNormal.code, 'FOUND');

      assert.equal((await setScenario(baseUrl, runA, 'VERIFICATION_UNAVAILABLE')).status, 200);
      const unavailableLogs = await captureStdout(async () => {
        const response = await postCheckout(baseUrl, runA);
        assert.equal(response.status, 200);
        const unavailable = CheckoutConfirmationSchema.parse(await response.json());
        assert.equal(orderCount(db, runA), 2);
        const stored = db
          .prepare('SELECT total_cents FROM orders WHERE order_id = ?')
          .get(unavailable.orderId) as { total_cents: number };
        assert.equal(stored.total_cents, 1299);

        const lookup = await fetch(`${baseUrl}/api/orders/${unavailable.orderId}`);
        assert.equal(lookup.status, 503);
        assert.deepEqual(OrderLookupResultSchema.parse(await lookup.json()), {
          code: 'UNAVAILABLE',
          status: 503,
          orderId: unavailable.orderId,
          reason: 'service_unavailable',
        });
        const reading = verifyPersistedOrder(db, unavailable.orderId);
        assert.deepEqual(reading, {
          code: 'UNKNOWN',
          orderId: unavailable.orderId,
          reason: 'verification_unavailable',
        });
        assert.equal(JSON.stringify(reading).includes('1299'), false);
        assert.equal(JSON.stringify(reading).includes('SKU-MUG'), false);

        const previous = await fetch(`${baseUrl}/api/orders/${normal.orderId}`);
        assert.equal(previous.status, 503);
        assert.equal(verifyPersistedOrder(db, normal.orderId).code, 'UNKNOWN');

        const absent = await fetch(`${baseUrl}/api/orders/${missingId}`);
        assert.equal(absent.status, 404);
        assert.equal(OrderLookupResultSchema.parse(await absent.json()).code, 'ABSENT');
        assert.equal(verifyPersistedOrder(db, missingId).code, 'DEFECT');

        const ghostStillAbsent = await fetch(`${baseUrl}/api/orders/${ghost.orderId}`);
        assert.equal(ghostStillAbsent.status, 404);
      });
      assert.match(unavailableLogs, /"scenario":"VERIFICATION_UNAVAILABLE"/);
      assert.equal(unavailableLogs.includes('"event":"api.checkout_persisted"'), false);

      assert.equal((await setScenario(baseUrl, runA, 'NORMAL')).status, 200);
      const restored = await fetch(`${baseUrl}/api/orders/${normal.orderId}`);
      assert.equal(restored.status, 200);
      assert.equal(verifyPersistedOrder(db, normal.orderId).code, 'CONFIRMED');
    });
  });

  it('resets one run idempotently and leaves the other run in place', async () => {
    await withHarness(async (baseUrl, db) => {
      await setScenario(baseUrl, runA, 'NORMAL');
      await setScenario(baseUrl, runB, 'GHOST_SUCCESS');
      const kept = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runA)).json());
      const ghost = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runB)).json());
      assert.equal(orderCount(db, runA), 1);
      assert.equal(orderCount(db, runB), 0);

      const first = await resetRun(baseUrl, runB);
      assert.equal(first.status, 200);
      assert.deepEqual(await first.json(), { runId: runB, deletedOrders: 0, scenario: 'NORMAL' });
      const second = await resetRun(baseUrl, runB);
      assert.deepEqual(await second.json(), { runId: runB, deletedOrders: 0, scenario: 'NORMAL' });

      const removed = await resetRun(baseUrl, runA);
      assert.deepEqual(await removed.json(), { runId: runA, deletedOrders: 1, scenario: 'NORMAL' });
      const again = await resetRun(baseUrl, runA);
      assert.deepEqual(await again.json(), { runId: runA, deletedOrders: 0, scenario: 'NORMAL' });

      assert.equal(orderCount(db, runA), 0);
      assert.equal(itemCount(db, runA), 0);
      const gone = await fetch(`${baseUrl}/api/orders/${kept.orderId}`);
      assert.equal(gone.status, 404);
      const ghostGone = await fetch(`${baseUrl}/api/orders/${ghost.orderId}`);
      assert.equal(ghostGone.status, 404);

      const current = await fetch(`${baseUrl}/harness/runs/${runA}`, {
        headers: { 'x-tqa-harness-token': token },
      });
      assert.deepEqual(await current.json(), { runId: runA, scenario: 'NORMAL' });
      const againNormal = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runA)).json());
      assert.equal(orderCount(db, runA), 1);
      assert.equal(
        OrderLookupResultSchema.parse(await (await fetch(`${baseUrl}/api/orders/${againNormal.orderId}`)).json())
          .code,
        'FOUND',
      );
    });
  });

  it('does not let the other run observe a reset or a verification outage', async () => {
    await withHarness(async (baseUrl, db) => {
      await setScenario(baseUrl, runA, 'VERIFICATION_UNAVAILABLE');
      await setScenario(baseUrl, runB, 'NORMAL');
      const hidden = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runA)).json());
      const visible = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runB)).json());
      assert.equal((await fetch(`${baseUrl}/api/orders/${hidden.orderId}`)).status, 503);
      assert.equal((await fetch(`${baseUrl}/api/orders/${visible.orderId}`)).status, 200);
      assert.equal(verifyPersistedOrder(db, visible.orderId).code, 'CONFIRMED');

      await resetRun(baseUrl, runA);
      assert.equal(orderCount(db, runA), 0);
      assert.equal(orderCount(db, runB), 1);
      assert.equal(itemCount(db, runB), 1);
      assert.equal((await fetch(`${baseUrl}/api/orders/${visible.orderId}`)).status, 200);
      assert.equal((await fetch(`${baseUrl}/api/orders/${hidden.orderId}`)).status, 404);
    });
  });

  it('ignores a public scenario field and rejects bad harness input', async () => {
    await withHarness(async (baseUrl, db) => {
      const response = await postCheckout(baseUrl, runA, '?scenario=GHOST_SUCCESS');
      const confirmation = CheckoutConfirmationSchema.parse(await response.json());
      assert.equal(orderCount(db, runA), 1);
      assert.equal(
        OrderLookupResultSchema.parse(await (await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`)).json())
          .code,
        'FOUND',
      );

      const badScenario = await fetch(`${baseUrl}/harness/runs/${runA}/scenario`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tqa-harness-token': token,
        },
        body: JSON.stringify({ scenario: 'BLOCK' }),
      });
      assert.equal(badScenario.status, 400);

      const badRun = await fetch(`${baseUrl}/harness/runs/not-a-uuid/reset`, {
        method: 'POST',
        headers: { 'x-tqa-harness-token': token },
      });
      assert.equal(badRun.status, 400);
      assert.equal(orderCount(db, runA), 1);

      const apiShaped = await fetch(`${baseUrl}/api/harness/runs/${runA}/scenario`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tqa-harness-token': token,
        },
        body: JSON.stringify({ scenario: 'GHOST_SUCCESS' }),
      });
      assert.equal(apiShaped.status, 404);

      const wrongMethod = await fetch(`${baseUrl}/harness/runs/${runA}/reset`, {
        headers: { 'x-tqa-harness-token': token },
      });
      assert.equal(wrongMethod.status, 405);
      assert.equal(wrongMethod.headers.get('allow'), 'POST');
    });
  });

  it('reports a closed database and an invalid id without calling a missing order confirmed', async () => {
    await withHarness(async (baseUrl, db) => {
      const confirmation = CheckoutConfirmationSchema.parse(await (await postCheckout(baseUrl, runA)).json());
      assert.throws(() => verifyPersistedOrder(db, 'order-1'), /UUID/);
      db.close();
      const lookup = await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`);
      assert.equal(lookup.status, 503);
      assert.equal(OrderLookupResultSchema.parse(await lookup.json()).code, 'UNAVAILABLE');
    });
  });
});
