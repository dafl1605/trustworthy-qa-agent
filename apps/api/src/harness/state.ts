import { TestScenarioSchema, type TestScenario } from '@tqa/shared';
import type { SqliteDatabase } from '../db/open.js';
import { isSqliteError, OrderReadUnavailableError } from '../orders/sqlite-store.js';

const VERIFICATION_UNAVAILABLE = 'VERIFICATION_UNAVAILABLE';

interface ScenarioRow {
  scenario: string;
}

interface RunRow {
  run_id: string;
}

interface CountRow {
  count: number;
}

export interface ActiveHarness {
  readonly token: string;
  scenarioFor(runId: string): TestScenario;
  setScenario(runId: string, scenario: TestScenario): void;
  recordCheckout(input: {
    orderId: string;
    runId: string;
    scenario: TestScenario;
    persisted: boolean;
  }): void;
  reset(runId: string): number;
}

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && error.message === 'The database connection is not open';
}

function parseScenario(value: unknown): TestScenario {
  const parsed = TestScenarioSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error('Stored harness scenario is invalid');
  }
  return parsed.data;
}

function readOrUnavailable<T>(read: () => T): T {
  try {
    return read();
  } catch (error) {
    if (isSqliteError(error) || isClosedDatabaseError(error)) {
      throw new OrderReadUnavailableError();
    }
    throw error;
  }
}

export function harnessTablesPresent(db: SqliteDatabase): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM sqlite_master
       WHERE type = 'table' AND name IN ('harness_runs', 'harness_checkouts')`,
    )
    .get() as CountRow;
  if (row.count === 0) {
    return false;
  }
  if (row.count !== 2) {
    throw new Error('Harness tables are incomplete');
  }
  return true;
}

function ensureHarnessTables(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS harness_runs (
      run_id TEXT PRIMARY KEY,
      scenario TEXT NOT NULL CHECK (
        scenario IN ('NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE')
      )
    );

    CREATE TABLE IF NOT EXISTS harness_checkouts (
      order_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      scenario TEXT NOT NULL CHECK (
        scenario IN ('NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE')
      ),
      persisted INTEGER NOT NULL CHECK (persisted IN (0, 1))
    );

    CREATE INDEX IF NOT EXISTS idx_harness_checkouts_run_id ON harness_checkouts (run_id);
  `);
}

function scenarioFor(db: SqliteDatabase, runId: string): TestScenario {
  const row = db.prepare('SELECT scenario FROM harness_runs WHERE run_id = ?').get(runId) as
    | ScenarioRow
    | undefined;
  if (row === undefined) {
    return 'NORMAL';
  }
  return parseScenario(row.scenario);
}

/**
 * Authoritative reads are blocked only when this run's current scenario is
 * VERIFICATION_UNAVAILABLE. A missing harness table means the mode is off.
 * This does not decide 404 versus a persisted row; callers do that next.
 */
export function readBlockedByHarness(db: SqliteDatabase, orderId: string): boolean {
  return readOrUnavailable(() => {
    if (!harnessTablesPresent(db)) {
      return false;
    }
    const issued = db
      .prepare('SELECT run_id FROM harness_checkouts WHERE order_id = ?')
      .get(orderId) as RunRow | undefined;
    if (issued !== undefined && scenarioFor(db, issued.run_id) === VERIFICATION_UNAVAILABLE) {
      return true;
    }
    const stored = db.prepare('SELECT run_id FROM orders WHERE order_id = ?').get(orderId) as
      | RunRow
      | undefined;
    return stored !== undefined && scenarioFor(db, stored.run_id) === VERIFICATION_UNAVAILABLE;
  });
}

export function createHarness(db: SqliteDatabase, token: string): ActiveHarness {
  if (token.length === 0) {
    throw new Error('Harness token is empty');
  }
  ensureHarnessTables(db);

  const upsertScenario = db.prepare(
    `INSERT INTO harness_runs (run_id, scenario)
     VALUES (?, ?)
     ON CONFLICT(run_id) DO UPDATE SET scenario = excluded.scenario`,
  );
  const upsertCheckout = db.prepare(
    `INSERT INTO harness_checkouts (order_id, run_id, scenario, persisted)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(order_id) DO UPDATE SET
       run_id = excluded.run_id,
       scenario = excluded.scenario,
       persisted = excluded.persisted`,
  );
  const deleteItems = db.prepare(
    `DELETE FROM order_items
     WHERE order_id IN (SELECT order_id FROM orders WHERE run_id = ?)`,
  );
  const deleteOrders = db.prepare('DELETE FROM orders WHERE run_id = ?');
  const deleteCheckouts = db.prepare('DELETE FROM harness_checkouts WHERE run_id = ?');
  const deleteRun = db.prepare('DELETE FROM harness_runs WHERE run_id = ?');
  const resetRun = db.transaction((runId: string): number => {
    deleteItems.run(runId);
    const deletedOrders = deleteOrders.run(runId).changes;
    deleteCheckouts.run(runId);
    deleteRun.run(runId);
    return deletedOrders;
  });

  return {
    token,
    scenarioFor(runId: string): TestScenario {
      return readOrUnavailable(() => scenarioFor(db, runId));
    },
    setScenario(runId: string, scenario: TestScenario): void {
      const parsed = TestScenarioSchema.parse(scenario);
      readOrUnavailable(() => {
        upsertScenario.run(runId, parsed);
      });
    },
    recordCheckout(input): void {
      const scenario = TestScenarioSchema.parse(input.scenario);
      readOrUnavailable(() => {
        upsertCheckout.run(input.orderId, input.runId, scenario, input.persisted ? 1 : 0);
      });
    },
    reset(runId: string): number {
      return readOrUnavailable(() => resetRun(runId));
    },
  };
}
