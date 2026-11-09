import { OrderLookupResultSchema, OrderRecordSchema, type OrderRecord } from '@tqa/shared';
import type { SqliteDatabase } from '../db/open.js';
import { readBlockedByHarness } from '../harness/state.js';
import {
  CorruptOrderError,
  isSqliteError,
  OrderReadUnavailableError,
} from './sqlite-store.js';

export type OrderPersistenceRead =
  | { code: 'CONFIRMED'; order: OrderRecord }
  | { code: 'DEFECT'; orderId: string; reason: 'not_persisted' }
  | { code: 'UNKNOWN'; orderId: string; reason: 'verification_unavailable' };

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

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && error.message === 'The database connection is not open';
}

function assertOrderId(orderId: string): void {
  const probe = OrderLookupResultSchema.safeParse({
    code: 'ABSENT',
    status: 404,
    orderId,
  });
  if (!probe.success || probe.data.code !== 'ABSENT') {
    throw new Error('orderId must be a UUID');
  }
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

/**
 * Independent read of `orders` and `order_items`.
 * The SQL lives here so a checkout response cannot satisfy this check.
 * VERIFICATION_UNAVAILABLE returns UNKNOWN before any line item is loaded.
 */
function readPersistedOrder(db: SqliteDatabase, orderId: string): OrderPersistenceRead {
  if (readBlockedByHarness(db, orderId)) {
    return { code: 'UNKNOWN', orderId, reason: 'verification_unavailable' };
  }

  const row = db
    .prepare(
      `SELECT order_id, run_id, total_cents, currency, created_at
       FROM orders
       WHERE order_id = ?`,
    )
    .get(orderId);
  if (row === undefined) {
    return { code: 'DEFECT', orderId, reason: 'not_persisted' };
  }
  if (!isOrderRow(row)) {
    throw new CorruptOrderError(orderId);
  }
  const itemRows = db
    .prepare(
      `SELECT sku, quantity, unit_price_cents
       FROM order_items
       WHERE order_id = ?
       ORDER BY order_item_id ASC`,
    )
    .all(orderId);
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
  return { code: 'CONFIRMED', order: parsed.data };
}

export function verifyPersistedOrder(db: SqliteDatabase, orderId: string): OrderPersistenceRead {
  assertOrderId(orderId);
  try {
    return readPersistedOrder(db, orderId);
  } catch (error) {
    if (error instanceof CorruptOrderError) {
      throw error;
    }
    if (
      error instanceof OrderReadUnavailableError ||
      isSqliteError(error) ||
      isClosedDatabaseError(error)
    ) {
      return { code: 'UNKNOWN', orderId, reason: 'verification_unavailable' };
    }
    throw error;
  }
}
