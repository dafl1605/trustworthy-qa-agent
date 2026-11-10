import { randomUUID } from 'node:crypto';
import { OrderLookupResultSchema, OrderRecordSchema, VerificationResultSchema } from '@tqa/shared';
import type { VerificationResult } from '@tqa/shared';
import { AuthoritativeReadError, ValidatorInputError } from './errors.js';
import { openReadonlyDatabase, readRow, readRows } from './reader.js';

const RUN_PROBE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CLOCK_PROBE = '2026-11-10T00:00:00.000Z';
const DEFAULT_READ_BUDGET_MS = 1000;
const MAX_READ_BUDGET_MS = 5000;
const VERIFICATION_UNAVAILABLE = 'VERIFICATION_UNAVAILABLE';
const KNOWN_SCENARIOS = new Set(['NORMAL', 'GHOST_SUCCESS', VERIFICATION_UNAVAILABLE]);

const DETAILS = {
  timeout:
    'Authoritative read timed out before the order row was read. This is not an absent order.',
  unavailable: 'Authoritative read is unavailable. This is not an absent order.',
  blocked: 'Authoritative read is blocked for this run. This is not an absent order.',
  absent: 'No stored order row exists for this order id. The absence was read from the order table.',
  mismatchedRun: 'The stored order belongs to a different run.',
  inconsistent: 'The stored order does not satisfy the order contract.',
  total: 'The stored total does not equal the sum of its line items.',
} as const;

export interface VerifyOrderInput {
  databasePath: string;
  orderId: string;
  runId: string;
  checkedAt?: string;
  readBudgetMs?: number;
  /**
   * Accepted and ignored. A model diagnosis cannot change this result.
   */
  agentDiagnosis?: unknown;
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

function assertOrderId(orderId: string): void {
  const parsed = OrderLookupResultSchema.safeParse({
    code: 'ABSENT',
    status: 404,
    orderId,
  });
  if (!parsed.success || parsed.data.code !== 'ABSENT') {
    throw new ValidatorInputError('orderId must be a UUID');
  }
}

function assertRunId(runId: string): void {
  const parsed = VerificationResultSchema.safeParse({
    verificationId: 'run-probe',
    runId,
    status: 'UNKNOWN',
    checkedAt: CLOCK_PROBE,
    details: 'probe',
  });
  if (!parsed.success) {
    throw new ValidatorInputError('runId must be a UUID');
  }
}

function assertCheckedAt(checkedAt: string): void {
  const parsed = VerificationResultSchema.safeParse({
    verificationId: 'clock-probe',
    runId: RUN_PROBE,
    status: 'UNKNOWN',
    checkedAt,
    details: 'probe',
  });
  if (!parsed.success) {
    throw new ValidatorInputError('checkedAt must be an ISO datetime');
  }
}

function assertDatabasePath(databasePath: string): void {
  if (databasePath.trim() === '') {
    throw new ValidatorInputError('databasePath is required');
  }
  const lowered = databasePath.toLowerCase();
  if (lowered === ':memory:' || lowered.startsWith('file:') || lowered.includes('mode=memory')) {
    throw new ValidatorInputError('databasePath must be an existing database file');
  }
}

function assertReadBudget(readBudgetMs: number): void {
  if (!Number.isInteger(readBudgetMs) || readBudgetMs < 0 || readBudgetMs > MAX_READ_BUDGET_MS) {
    throw new ValidatorInputError('readBudgetMs must be an integer from 0 to 5000');
  }
}

function finish(
  runId: string,
  status: VerificationResult['status'],
  checkedAt: string,
  details: string,
): VerificationResult {
  const parsed = VerificationResultSchema.safeParse({
    verificationId: randomUUID(),
    runId,
    status,
    checkedAt,
    details,
  });
  if (!parsed.success) {
    throw new Error('Validator produced a result outside VerificationResultSchema');
  }
  return parsed.data;
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

function scenarioFor(db: ReturnType<typeof openReadonlyDatabase>, runId: string): string {
  const row = readRow(db, 'SELECT scenario FROM harness_runs WHERE run_id = ?', [runId]);
  if (row === undefined) {
    return 'NORMAL';
  }
  if (
    typeof row !== 'object' ||
    row === null ||
    typeof (row as { scenario?: unknown }).scenario !== 'string'
  ) {
    throw new AuthoritativeReadError();
  }
  const scenario = (row as { scenario: string }).scenario;
  if (!KNOWN_SCENARIOS.has(scenario)) {
    throw new AuthoritativeReadError();
  }
  return scenario;
}

/**
 * A run left in VERIFICATION_UNAVAILABLE blocks the read before line items load.
 * Missing harness tables mean the mode is off. A partial harness cannot be skipped.
 */
function readBlocked(db: ReturnType<typeof openReadonlyDatabase>, orderId: string): boolean {
  const names = readRows(
    db,
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name IN ('harness_runs', 'harness_checkouts')`,
    [],
  );
  const present = names.filter(
    (row) =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as { name?: unknown }).name === 'string',
  );
  if (present.length === 0) {
    return false;
  }
  if (present.length !== 2) {
    throw new AuthoritativeReadError();
  }
  const issued = readRow(db, 'SELECT run_id FROM harness_checkouts WHERE order_id = ?', [orderId]);
  if (isRunRow(issued) && scenarioFor(db, issued.run_id) === VERIFICATION_UNAVAILABLE) {
    return true;
  }
  const stored = readRow(db, 'SELECT run_id FROM orders WHERE order_id = ?', [orderId]);
  return isRunRow(stored) && scenarioFor(db, stored.run_id) === VERIFICATION_UNAVAILABLE;
}

function isRunRow(value: unknown): value is { run_id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { run_id?: unknown }).run_id === 'string'
  );
}

function lineSum(items: readonly ItemRow[]): number | undefined {
  let sum = 0;
  for (const item of items) {
    const line = item.quantity * item.unit_price_cents;
    if (!Number.isSafeInteger(line) || !Number.isSafeInteger(sum + line)) {
      return undefined;
    }
    sum += line;
  }
  return sum;
}

function confirmedOrDefect(
  db: ReturnType<typeof openReadonlyDatabase>,
  orderId: string,
  runId: string,
  checkedAt: string,
): VerificationResult {
  const row = readRow(
    db,
    `SELECT order_id, run_id, total_cents, currency, created_at
     FROM orders
     WHERE order_id = ?`,
    [orderId],
  );
  if (row === undefined) {
    return finish(runId, 'DEFECT', checkedAt, DETAILS.absent);
  }
  if (!isOrderRow(row)) {
    return finish(runId, 'DEFECT', checkedAt, DETAILS.inconsistent);
  }
  if (row.run_id !== runId) {
    return finish(runId, 'DEFECT', checkedAt, DETAILS.mismatchedRun);
  }
  const itemRows = readRows(
    db,
    `SELECT sku, quantity, unit_price_cents
     FROM order_items
     WHERE order_id = ?
     ORDER BY order_item_id ASC`,
    [orderId],
  );
  if (!itemRows.every(isItemRow)) {
    return finish(runId, 'DEFECT', checkedAt, DETAILS.inconsistent);
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
    return finish(runId, 'DEFECT', checkedAt, DETAILS.inconsistent);
  }
  const sum = lineSum(itemRows);
  if (sum === undefined || sum !== parsed.data.totalCents) {
    return finish(runId, 'DEFECT', checkedAt, DETAILS.total);
  }
  return finish(
    runId,
    'CONFIRMED',
    checkedAt,
    `The stored order matches this run. Line items sum to ${parsed.data.totalCents} cents.`,
  );
}

/**
 * Reads `orders` and `order_items` on a private read-only connection.
 * Checkout JSON and `agentDiagnosis` are not inputs to the status.
 */
export function verifyOrder(input: VerifyOrderInput): VerificationResult {
  assertDatabasePath(input.databasePath);
  assertOrderId(input.orderId);
  assertRunId(input.runId);
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  assertCheckedAt(checkedAt);
  const readBudgetMs = input.readBudgetMs ?? DEFAULT_READ_BUDGET_MS;
  assertReadBudget(readBudgetMs);
  void input.agentDiagnosis;

  if (readBudgetMs === 0) {
    return finish(input.runId, 'UNKNOWN', checkedAt, DETAILS.timeout);
  }

  let db: ReturnType<typeof openReadonlyDatabase>;
  try {
    db = openReadonlyDatabase(input.databasePath, readBudgetMs);
  } catch (error) {
    if (error instanceof AuthoritativeReadError) {
      return finish(input.runId, 'UNKNOWN', checkedAt, DETAILS.unavailable);
    }
    throw error;
  }

  try {
    if (readBlocked(db, input.orderId)) {
      return finish(input.runId, 'UNKNOWN', checkedAt, DETAILS.blocked);
    }
    return confirmedOrDefect(db, input.orderId, input.runId, checkedAt);
  } catch (error) {
    if (error instanceof AuthoritativeReadError) {
      return finish(input.runId, 'UNKNOWN', checkedAt, DETAILS.unavailable);
    }
    throw error;
  } finally {
    db.close();
  }
}
