import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applySchema, openDatabase } from '@tqa/api';

describe('sqlite schema', () => {
  it('creates orders and order_items and keeps rows when applied twice', () => {
    const db = openDatabase(':memory:');
    try {
      applySchema(db);
      applySchema(db);
      db.prepare(
        `INSERT INTO orders (order_id, run_id, total_cents, currency, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('order-1', 'run-1', 1500, 'USD', '2026-10-30T23:41:08.000Z');
      db.prepare(
        `INSERT INTO order_items (order_id, sku, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?)`,
      ).run('order-1', 'sku-1', 1, 1500);
      applySchema(db);

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

      const columns = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
      assert.deepEqual(
        columns.map((column) => column.name),
        ['order_id', 'run_id', 'total_cents', 'currency', 'created_at'],
      );

      const count = db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number };
      assert.equal(count.count, 1);
    } finally {
      db.close();
    }
  });

  it('rejects negative totals, non-USD currency, orphan items, and invalid item amounts', () => {
    const db = openDatabase(':memory:');
    try {
      applySchema(db);
      const insertOrder = db.prepare(
        `INSERT INTO orders (order_id, run_id, total_cents, currency, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      assert.throws(() => insertOrder.run('order-neg', 'run-1', -1, 'USD', '2026-10-30T00:00:00Z'));
      assert.throws(() => insertOrder.run('order-eur', 'run-1', 100, 'EUR', '2026-10-30T00:00:00Z'));
      insertOrder.run('order-ok', 'run-1', 100, 'USD', '2026-10-30T00:00:00Z');
      const insertItem = db.prepare(
        `INSERT INTO order_items (order_id, sku, quantity, unit_price_cents)
         VALUES (?, ?, ?, ?)`,
      );
      assert.throws(() => insertItem.run('missing-order', 'sku-1', 1, 100));
      assert.throws(() => insertItem.run('order-ok', 'sku-1', 0, 100));
      assert.throws(() => insertItem.run('order-ok', 'sku-1', 1, -1));
    } finally {
      db.close();
    }
  });
});
