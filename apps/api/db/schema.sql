-- QA-01 initial schema. Applying this file must be idempotent.
-- A persisted checkout is a row in orders. Absence is not a status column.
-- VERIFICATION_UNAVAILABLE is a read-path failure and is not stored here.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orders (
  order_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL CHECK (currency = 'USD'),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  FOREIGN KEY (order_id) REFERENCES orders (order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_run_id ON orders (run_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
