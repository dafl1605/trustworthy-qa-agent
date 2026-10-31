import { OrderRecordSchema, type OrderRecord } from '@tqa/shared';
import type { SqliteDatabase } from '../db/open.js';

export class CorruptOrderError extends Error {
  readonly orderId: string;

  constructor(orderId: string) {
    super('Stored order failed contract validation');
    this.name = 'CorruptOrderError';
    this.orderId = orderId;
  }
}

export class OrderReadUnavailableError extends Error {
  constructor() {
    super('Authoritative order read is unavailable');
    this.name = 'OrderReadUnavailableError';
  }
}

export class PersistenceUnavailableError extends Error {
  constructor() {
    super('Order persistence is unavailable');
    this.name = 'PersistenceUnavailableError';
  }
}

export function isSqliteError(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error) || error.name !== 'SqliteError') {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_');
}

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && error.message === 'The database connection is not open';
}

interface OrderRow {
  order_id: string;
  run_id: string;
  total_cents: number;
  currency: string;
  created_at: string;
}

interface ItemRow {
  sku: string;
  quantity: number;
  unit_price_cents: number;
}

export interface OrderStore {
  persist(order: OrderRecord): void;
  findById(orderId: string): OrderRecord | null;
}

function isOrderRow(value: unknown): value is OrderRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.order_id === 'string' &&
    typeof row.run_id === 'string' &&
    typeof row.total_cents === 'number' &&
    typeof row.currency === 'string' &&
    typeof row.created_at === 'string'
  );
}

function isItemRow(value: unknown): value is ItemRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.sku === 'string' &&
    typeof row.quantity === 'number' &&
    typeof row.unit_price_cents === 'number'
  );
}

function readOrder(
  orderId: string,
  selectOrder: { get: (id: string) => unknown },
  selectItems: { all: (id: string) => unknown },
): OrderRecord | null {
  const row = selectOrder.get(orderId);
  if (row === undefined) {
    return null;
  }
  if (!isOrderRow(row)) {
    throw new CorruptOrderError(orderId);
  }
  const itemRows = selectItems.all(orderId);
  if (!Array.isArray(itemRows) || !itemRows.every(isItemRow)) {
    throw new CorruptOrderError(orderId);
  }
  const parsed = OrderRecordSchema.safeParse({
    orderId: row.order_id,
    runId: row.run_id,
    totalCents: row.total_cents,
    currency: row.currency,
    createdAt: row.created_at,
    items: itemRows.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
  });
  if (!parsed.success) {
    throw new CorruptOrderError(orderId);
  }
  return parsed.data;
}

export function createSqliteOrderStore(db: SqliteDatabase): OrderStore {
  const insertOrder = db.prepare(
    `INSERT INTO orders (order_id, run_id, total_cents, currency, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, sku, quantity, unit_price_cents)
     VALUES (?, ?, ?, ?)`,
  );
  const selectOrder = db.prepare(
    `SELECT order_id, run_id, total_cents, currency, created_at
     FROM orders
     WHERE order_id = ?`,
  );
  const selectItems = db.prepare(
    `SELECT sku, quantity, unit_price_cents
     FROM order_items
     WHERE order_id = ?
     ORDER BY order_item_id ASC`,
  );
  const persistTx = db.transaction((order: OrderRecord) => {
    insertOrder.run(order.orderId, order.runId, order.totalCents, order.currency, order.createdAt);
    for (const item of order.items) {
      insertItem.run(order.orderId, item.sku, item.quantity, item.unitPriceCents);
    }
  });

  return {
    persist(order: OrderRecord): void {
      const parsed = OrderRecordSchema.parse(order);
      if (!db.open) {
        throw new PersistenceUnavailableError();
      }
      try {
        persistTx(parsed);
      } catch (error) {
        if (isClosedDatabaseError(error)) {
          throw new PersistenceUnavailableError();
        }
        throw error;
      }
    },
    findById(orderId: string): OrderRecord | null {
      if (!db.open) {
        throw new OrderReadUnavailableError();
      }
      try {
        return readOrder(
          orderId,
          { get: (id: string): unknown => selectOrder.get(id) },
          { all: (id: string): unknown => selectItems.all(id) },
        );
      } catch (error) {
        if (error instanceof CorruptOrderError) {
          throw error;
        }
        if (isSqliteError(error) || isClosedDatabaseError(error)) {
          throw new OrderReadUnavailableError();
        }
        throw error;
      }
    },
  };
}
