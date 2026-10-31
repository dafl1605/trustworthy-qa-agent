import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CheckoutConfirmationSchema,
  OrderLookupResultSchema,
  ProductSchema,
} from '@tqa/shared';
import { createApp, listen } from '@tqa/api';
import { applySchema, openDatabase } from '@tqa/api/migrate';

const runId = '11111111-1111-4111-8111-111111111111';
const otherRunId = '33333333-3333-4333-8333-333333333333';

type ApiDatabase = ReturnType<typeof openDatabase>;

async function withApi(run: (baseUrl: string, db: ApiDatabase) => Promise<void>): Promise<void> {
  const db = openDatabase(':memory:');
  applySchema(db);
  const server: Server = createApp({ database: db });
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

function orderCount(db: ApiDatabase): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number };
  return row.count;
}

function rawRequest(port: number, requestTarget: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.write(`GET ${requestTarget} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    const chunks: Buffer[] = [];
    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    socket.on('error', reject);
    socket.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
  });
}

function postCheckout(baseUrl: string, body: unknown, search = ''): Promise<Response> {
  return fetch(`${baseUrl}/api/checkout${search}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('checkout API', () => {
  it('lists the three fixture products without a products table', async () => {
    await withApi(async (baseUrl, db) => {
      const response = await fetch(`${baseUrl}/api/products`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      const body = (await response.json()) as { products: unknown };
      assert.ok(Array.isArray(body.products));
      const products = body.products.map((product) => ProductSchema.parse(product));
      assert.deepEqual(
        products.map((product) => product.sku),
        ['SKU-MUG', 'SKU-TEE', 'SKU-STK'],
      );
      assert.deepEqual(
        products.map((product) => product.priceCents),
        [1299, 2499, 399],
      );

      const tables = db
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all() as Array<{ name: string }>;
      assert.deepEqual(
        tables.map((table) => table.name),
        ['order_items', 'orders'],
      );
    });
  });

  it('persists a checkout and returns the stored order with the server total', async () => {
    await withApi(async (baseUrl, db) => {
      const response = await postCheckout(baseUrl, {
        runId,
        items: [
          { sku: 'SKU-MUG', quantity: 2, priceCents: 1 },
          { sku: 'SKU-STK', quantity: 1 },
        ],
        totalCents: 1,
      });
      assert.equal(response.status, 200);
      const confirmation = CheckoutConfirmationSchema.parse(await response.json());
      assert.equal(confirmation.runId, runId);
      assert.equal(confirmation.totalCents, 2997);
      assert.equal(confirmation.message, 'Order confirmed');
      assert.equal(orderCount(db), 1);

      const stored = db
        .prepare('SELECT order_id, run_id, total_cents, currency FROM orders WHERE order_id = ?')
        .get(confirmation.orderId) as
        | { order_id: string; run_id: string; total_cents: number; currency: string }
        | undefined;
      assert.ok(stored);
      assert.equal(stored.run_id, runId);
      assert.equal(stored.total_cents, 2997);
      assert.equal(stored.currency, 'USD');

      const items = db
        .prepare(
          `SELECT sku, quantity, unit_price_cents
           FROM order_items WHERE order_id = ? ORDER BY order_item_id`,
        )
        .all(confirmation.orderId) as Array<{ sku: string; quantity: number; unit_price_cents: number }>;
      assert.deepEqual(items, [
        { sku: 'SKU-MUG', quantity: 2, unit_price_cents: 1299 },
        { sku: 'SKU-STK', quantity: 1, unit_price_cents: 399 },
      ]);

      const lookup = await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`);
      assert.equal(lookup.status, 200);
      const found = OrderLookupResultSchema.parse(await lookup.json());
      assert.equal(found.code, 'FOUND');
      if (found.code !== 'FOUND') {
        return;
      }
      assert.equal(found.order.orderId, confirmation.orderId);
      assert.equal(found.order.totalCents, 2997);
      assert.equal(found.order.runId, runId);
      assert.deepEqual(
        found.order.items.map((item) => item.unitPriceCents),
        [1299, 399],
      );
    });
  });

  it('keeps a second checkout for the same runId as a distinct persisted order', async () => {
    await withApi(async (baseUrl, db) => {
      const first = CheckoutConfirmationSchema.parse(
        await (await postCheckout(baseUrl, { runId, items: [{ sku: 'SKU-TEE', quantity: 1 }] })).json(),
      );
      const second = CheckoutConfirmationSchema.parse(
        await (await postCheckout(baseUrl, { runId, items: [{ sku: 'SKU-MUG', quantity: 99 }] })).json(),
      );
      assert.notEqual(first.orderId, second.orderId);
      assert.equal(first.totalCents, 2499);
      assert.equal(second.totalCents, 128601);
      assert.equal(orderCount(db), 2);
    });
  });

  it('still persists when a caller asks for GHOST_SUCCESS on the public checkout route', async () => {
    await withApi(async (baseUrl, db) => {
      const response = await postCheckout(
        baseUrl,
        { runId: otherRunId, items: [{ sku: 'SKU-STK', quantity: 2 }] },
        '?scenario=GHOST_SUCCESS',
      );
      const confirmation = CheckoutConfirmationSchema.parse(await response.json());
      assert.equal(confirmation.totalCents, 798);
      assert.equal(orderCount(db), 1);
      const lookup = OrderLookupResultSchema.parse(
        await (await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`)).json(),
      );
      assert.equal(lookup.code, 'FOUND');
    });
  });

  it('returns 404 ABSENT for a missing order and 400 for a non-UUID id', async () => {
    await withApi(async (baseUrl, db) => {
      const missingId = '44444444-4444-4444-8444-444444444444';
      const missing = await fetch(`${baseUrl}/api/orders/${missingId}`);
      assert.equal(missing.status, 404);
      assert.deepEqual(OrderLookupResultSchema.parse(await missing.json()), {
        code: 'ABSENT',
        status: 404,
        orderId: missingId,
      });

      const invalid = await fetch(`${baseUrl}/api/orders/order-1`);
      assert.equal(invalid.status, 400);
      assert.deepEqual(await invalid.json(), { error: 'invalid_request' });
      assert.equal(orderCount(db), 0);
    });
  });

  it('rejects invalid checkout bodies without writing rows', async () => {
    await withApi(async (baseUrl, db) => {
      const cases: unknown[] = [
        { runId: 'not-a-uuid', items: [{ sku: 'SKU-MUG', quantity: 1 }] },
        { runId, items: [] },
        {
          runId,
          items: [
            { sku: 'SKU-MUG', quantity: 1 },
            { sku: 'SKU-TEE', quantity: 1 },
            { sku: 'SKU-STK', quantity: 1 },
            { sku: 'SKU-MUG-2', quantity: 1 },
          ],
        },
        {
          runId,
          items: [
            { sku: 'SKU-MUG', quantity: 1 },
            { sku: 'SKU-MUG', quantity: 1 },
          ],
        },
        { runId, items: [{ sku: 'SKU-MUG', quantity: 0 }] },
        { runId, items: [{ sku: 'SKU-MUG', quantity: 100 }] },
        { runId, items: [{ sku: 'SKU-MUG', quantity: 1.5 }] },
        null,
        [],
      ];

      for (const body of cases) {
        const response = await postCheckout(baseUrl, body);
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: 'invalid_request' });
      }

      const unknown = await postCheckout(baseUrl, {
        runId,
        items: [{ sku: 'sku-mug', quantity: 1 }],
      });
      assert.equal(unknown.status, 400);
      assert.deepEqual(await unknown.json(), { error: 'unknown_sku', sku: 'sku-mug' });

      const injected = await postCheckout(baseUrl, {
        runId,
        items: [{ sku: "SKU-MUG'; DROP TABLE orders;--", quantity: 1 }],
      });
      assert.equal(injected.status, 400);
      assert.deepEqual(await injected.json(), {
        error: 'unknown_sku',
        sku: "SKU-MUG'; DROP TABLE orders;--",
      });

      const plain = await fetch(`${baseUrl}/api/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ runId, items: [{ sku: 'SKU-MUG', quantity: 1 }] }),
      });
      assert.equal(plain.status, 400);

      const malformed = await fetch(`${baseUrl}/api/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      });
      assert.equal(malformed.status, 400);

      const oversized = await postCheckout(baseUrl, {
        runId,
        items: [{ sku: 'SKU-MUG', quantity: 1 }],
        pad: 'x'.repeat(70_000),
      });
      assert.equal(oversized.status, 400);

      assert.equal(orderCount(db), 0);
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders'`)
        .all() as Array<{ name: string }>;
      assert.deepEqual(tables, [{ name: 'orders' }]);
    });
  });

  it('rolls back the order when an item write fails', async () => {
    await withApi(async (baseUrl, db) => {
      db.exec(`
        CREATE TRIGGER qa02_fail_items BEFORE INSERT ON order_items
        BEGIN
          SELECT RAISE(ABORT, 'injected item failure');
        END;
      `);
      const response = await postCheckout(baseUrl, {
        runId,
        items: [{ sku: 'SKU-TEE', quantity: 1 }],
      });
      assert.equal(response.status, 500);
      const failureBody: unknown = await response.json();
      assert.deepEqual(failureBody, { error: 'internal_error' });
      assert.equal(CheckoutConfirmationSchema.safeParse(failureBody).success, false);
      assert.equal(orderCount(db), 0);
      const items = db.prepare('SELECT COUNT(*) AS count FROM order_items').get() as { count: number };
      assert.equal(items.count, 0);
    });
  });

  it('reports a dropped orders table as 503 UNAVAILABLE rather than 404 ABSENT', async () => {
    await withApi(async (baseUrl, db) => {
      const confirmation = CheckoutConfirmationSchema.parse(
        await (await postCheckout(baseUrl, { runId, items: [{ sku: 'SKU-STK', quantity: 1 }] })).json(),
      );
      db.exec('DROP TABLE order_items; DROP TABLE orders;');
      const lookup = await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`);
      assert.equal(lookup.status, 503);
      assert.deepEqual(OrderLookupResultSchema.parse(await lookup.json()), {
        code: 'UNAVAILABLE',
        status: 503,
        orderId: confirmation.orderId,
        reason: 'service_unavailable',
      });
    });
  });

  it('does not confirm a checkout when the database connection is closed', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'tqa-closed-db-'));
    const filename = join(directory, 'orders.sqlite');
    const db = openDatabase(filename);
    applySchema(db);
    assert.equal(orderCount(db), 0);
    const server: Server = createApp({ database: db });
    await listen(server, 0);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a loopback TCP address');
    }
    db.close();
    try {
      assert.equal(address.address, '127.0.0.1');
      const response = await postCheckout(`http://127.0.0.1:${address.port}`, {
        runId,
        items: [{ sku: 'SKU-MUG', quantity: 1 }],
      });
      assert.equal(response.status, 503);
      const body: unknown = await response.json();
      assert.deepEqual(body, { error: 'persistence_unavailable' });
      assert.equal(CheckoutConfirmationSchema.safeParse(body).success, false);
    } finally {
      server.close();
      await once(server, 'close');
    }

    const reader = openDatabase(filename);
    try {
      assert.equal(orderCount(reader), 0);
      const items = reader.prepare('SELECT COUNT(*) AS count FROM order_items').get() as { count: number };
      assert.equal(items.count, 0);
    } finally {
      reader.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports a closed database as 503 UNAVAILABLE rather than 404 ABSENT', async () => {
    await withApi(async (baseUrl, db) => {
      const confirmation = CheckoutConfirmationSchema.parse(
        await (await postCheckout(baseUrl, { runId, items: [{ sku: 'SKU-MUG', quantity: 1 }] })).json(),
      );
      assert.equal(orderCount(db), 1);
      db.close();

      const lookup = await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`);
      assert.equal(lookup.status, 503);
      assert.deepEqual(OrderLookupResultSchema.parse(await lookup.json()), {
        code: 'UNAVAILABLE',
        status: 503,
        orderId: confirmation.orderId,
        reason: 'service_unavailable',
      });
    });
  });

  it('returns 500 for a stored order that fails the contract, not 404', async () => {
    await withApi(async (baseUrl, db) => {
      const orderId = '55555555-5555-4555-8555-555555555555';
      db.prepare(
        `INSERT INTO orders (order_id, run_id, total_cents, currency, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(orderId, runId, 100, 'USD', '2026-10-31T00:00:00.000Z');

      const response = await fetch(`${baseUrl}/api/orders/${orderId}`);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'internal_error' });
    });
  });

  it('does not confirm a checkout when the API has no database', async () => {
    const server = createApp();
    await listen(server, 0);
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a loopback TCP address');
    }
    try {
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const products = await fetch(`${baseUrl}/api/products`);
      assert.equal(products.status, 200);

      const checkout = await postCheckout(baseUrl, {
        runId,
        items: [{ sku: 'SKU-MUG', quantity: 1 }],
      });
      assert.equal(checkout.status, 503);
      const checkoutBody: unknown = await checkout.json();
      assert.deepEqual(checkoutBody, { error: 'persistence_unavailable' });
      assert.equal(CheckoutConfirmationSchema.safeParse(checkoutBody).success, false);

      const lookup = await fetch(`${baseUrl}/api/orders/${otherRunId}`);
      assert.equal(lookup.status, 503);
      assert.equal(OrderLookupResultSchema.parse(await lookup.json()).code, 'UNAVAILABLE');
    } finally {
      server.close();
      await once(server, 'close');
    }
  });

  it('returns 400 invalid_request for a malformed request target', async () => {
    await withApi(async (baseUrl) => {
      const health = await fetch(`${baseUrl}/health`);
      assert.equal(health.status, 200);

      const port = Number(new URL(baseUrl).port);
      const raw = await rawRequest(port, '//[');
      const [head, body = ''] = raw.split('\r\n\r\n');
      assert.match(head ?? '', /^HTTP\/1\.1 400\b/);
      assert.match(head ?? '', /content-type: application\/json/i);
      assert.deepEqual(JSON.parse(body), { error: 'invalid_request' });
    });
  });

  it('rejects the wrong method and unknown paths', async () => {
    await withApi(async (baseUrl) => {
      const postProducts = await fetch(`${baseUrl}/api/products`, { method: 'POST' });
      assert.equal(postProducts.status, 405);
      assert.equal(postProducts.headers.get('allow'), 'GET');

      const getCheckout = await fetch(`${baseUrl}/api/checkout`);
      assert.equal(getCheckout.status, 405);
      assert.equal(getCheckout.headers.get('allow'), 'POST');

      const missing = await fetch(`${baseUrl}/api/unknown`);
      assert.equal(missing.status, 404);
      assert.deepEqual(await missing.json(), { error: 'not_found' });
    });
  });
});
