# Architecture — QA-01 scaffold, QA-02 checkout API, QA-03 storefront shell, QA-04 commerce UI

This note is the as-built skeleton. Observable product behavior still lives in `docs/spec.md`. Domain names live in `docs/architecture-contracts.md`. Foundation choices live in `docs/adr/0001-runtime-foundations.md`.

Requires Node.js `>=22.13.0` (this VM: `22.23.4`) and pnpm `10.33.4`. `runId` and `orderId` are UUIDs validated by Zod `z.uuid()` at shared contract boundaries.

## Layout

| Path | Role |
|---|---|
| `apps/storefront` | React + Vite catalog, cart, checkout, and confirmation. The page calls `GET /api/products` and `POST /api/checkout` through the Vite `/api` proxy. It does not call `GET /api/orders/:orderId` |
| `apps/api` | Loopback Node.js server. `GET /health`, fixture catalog, normal checkout persistence, and order lookup. Schema apply lives on `@tqa/api/migrate` and the CLI, not the public package root |
| `packages/shared` | Zod schemas and inferred types for the MVP contracts, including deferred `VerificationResult` and `EvalCase` |
| `tests/contract` | Schema, migration, health, checkout persistence, order lookup, config, and log checks |
| `tests/e2e` | Reserved for Playwright (QA-06). Empty |
| `tests/evals` | Reserved for the eval runner (QA-14). Empty |
| `fixtures/golden-dataset` | Reserved for 12 labeled cases (QA-13). Empty |

Later packages from the contract doc are not created yet: `evidence-collector`, `qa-agent`, `validators`, and `quality-gate`.

## Workspace

pnpm workspaces (`pnpm-workspace.yaml`). Package names: `@tqa/storefront`, `@tqa/api`, `@tqa/shared`. TypeScript strict settings, including `noUncheckedIndexedAccess`, live in `tsconfig.base.json`. `@tqa/api` depends on `@tqa/shared`. The storefront does not, so the UI bundle does not pull Zod in before it has a UI contract to use.

Supported commands from the repository root:

| Command | Effect |
|---|---|
| `pnpm typecheck` | Build shared and API declarations, typecheck the storefront and `tests/contract` |
| `pnpm build` | `tsc` for shared and API, Vite production build for the storefront |
| `pnpm test` | Build, typecheck contract tests, run them with `node:test` |
| `pnpm db:migrate` | Apply `apps/api/db/schema.sql` to `DATABASE_PATH` or `./data/demo.sqlite` |
| `pnpm --filter @tqa/api start` | Apply the schema, then listen on `127.0.0.1` and `PORT` (default 3001) |
| `pnpm --filter @tqa/storefront dev` | Vite dev server |

`pnpm typecheck` builds `@tqa/shared` before `@tqa/api` because the API resolves shared types from `dist`.

## HTTP

`createApp()` does not listen by itself. `listen()` binds `127.0.0.1`. `GET /health` returns JSON validated by `HealthResponseSchema`.

QA-02 mounts the baseline business routes. `createApp({ database })` prepares an order store on that connection. `createApp()` without a database still serves health and the fixture catalog. Checkout and order lookup then return 503 and do not invent a confirmation, because there is no authoritative store.

| Route | Success | Failure |
|---|---|---|
| `GET /api/products` | 200 `{ products }` from `PRODUCT_FIXTURES`. Prices are integer cents. There is no products table | Other methods: 405 |
| `POST /api/checkout` | 200 `CheckoutConfirmation` only after `orders` and `order_items` commit. `totalCents` is `quantity * catalog price`. Extra client money fields are ignored. The message `Order confirmed` is the superficial confirmation and is not itself proof of persistence | 400 invalid body or unknown SKU. 500 `{ error: "internal_error" }` when a `SqliteError` is thrown, including a failed item insert or a dropped table. 503 `{ error: "persistence_unavailable" }` when no database was configured or the connection is not open. No `orderId` is returned unless the transaction committed |
| `GET /api/orders/:orderId` | 200 `OrderLookupResult` `FOUND` from a separate `SELECT` | 404 `ABSENT` when the UUID is well formed and no row exists. 400 when the id is not a UUID. 503 `UNAVAILABLE` / `service_unavailable` when SQLite throws or no store is configured. 500 when a row exists but does not satisfy `OrderRecordSchema`. A read failure is never reported as `ABSENT` |

Query parameters and extra JSON fields cannot select a scenario. `?scenario=GHOST_SUCCESS` still persists. The public API does not accept a fault toggle.

A request-target that cannot be parsed as a URL, such as `//[`, returns 400 `{ error: "invalid_request" }` before any route runs. Valid paths and query strings keep their existing responses. A closed database during checkout returns 503 `{ error: "persistence_unavailable" }`, with no confirmation and no new rows. That 503 means persistence was unavailable. It is not a confirmed absence of an order. Decision D-01 option B is applied. A `SqliteError` during the write stays 500 `{ error: "internal_error" }`.

## Checkout persistence

Column names are snake_case. Shared order objects are camelCase. The mapping lives in `apps/api/src/orders/sqlite-store.ts`. Inserts use bound parameters inside one `better-sqlite3` transaction. A trigger or constraint failure rolls the transaction back, and the HTTP response is 500 `{ error: "internal_error" }` with no confirmation body.

`GET /api/orders/:orderId` reads the committed rows. It does not echo the checkout response. That read is the API's authoritative lookup. The independent validator package is still QA-11 and is not this route. QA-11 must keep its own read-only connection rather than trusting the confirmation JSON.

Startup (`apps/api/src/main.ts`) creates the parent directory for `DATABASE_PATH`, opens SQLite, applies `schema.sql`, and then listens. `pnpm db:migrate` remains the explicit apply command. Apply stays idempotent and does not delete rows.

## SQLite

`apps/api/db/schema.sql` is the initial schema. `applySchema()` executes that file and is idempotent (`IF NOT EXISTS`). It does not seed products and it does not delete rows. The public `@tqa/api` entry exports `createApp`, `listen`, config readers, and `formatLog` only. Schema apply and `openDatabase` are CLI/test utilities on `@tqa/api/migrate`.

`orders`: `order_id`, `run_id`, `total_cents` (>= 0), `currency` (`USD`), `created_at`.

`order_items`: `order_item_id`, `order_id` (foreign key), `sku`, `quantity` (> 0), `unit_price_cents` (>= 0).

Presence of an `orders` row means persisted. Absence is not represented by a status column. `VERIFICATION_UNAVAILABLE` is still not a stored status.

## Shared contracts

`packages/shared/src/contracts.ts` implements the TypeScript shapes in `docs/architecture-contracts.md` as Zod schemas:

- scenarios: `NORMAL`, `GHOST_SUCCESS`, `VERIFICATION_UNAVAILABLE`
- verification: `CONFIRMED`, `DEFECT`, `UNKNOWN`
- gate: `ALLOW`, `BLOCK`, `HOLD`
- diagnosis: `SUCCESS`, `ORDER_NOT_PERSISTED`, `INCONCLUSIVE`, `OTHER`
- `EvidenceRecord`, `AgentDiagnosis`, `GateDecision`
- `VerificationResult` and `EvalCase` (minimal shapes only; no validator or eval runner)
- `OrderRecord` aligned with the table: integer cents, currency `USD`, 1 to 3 unique line items, UUID `runId` and `orderId`
- `CheckoutRequest`, `Product`, `CheckoutConfirmation`, and `OrderLookupResult` are the HTTP shapes used by the QA-02 routes. `OrderLookupResult` encodes FOUND/200, ABSENT/404, and UNAVAILABLE/503 so UNKNOWN cannot be stored as a missing order
- Checkout and order items reject duplicate SKUs, SKUs longer than 64 characters, and quantities outside 1–99
- `PRODUCT_FIXTURES` is three catalog SKUs with integer-cent prices. Products are not a SQLite table.

A diagnosis claim may have an empty `evidenceIds` array. That claim is UNVERIFIED. Claims that cite evidence still need those IDs to exist and to support the text. An LLM claim never independently authorizes `ALLOW`. `UNKNOWN` is its own verification status. Nothing in this package decides the gate. The decision matrix stays policy for QA-12.

Passing typecheck, build, or contract tests does not auto-approve merge and does not authorize a quality-gate `ALLOW`. A human decides merge.

## Harness and faults

No fault-injection route is registered. The harness stays disabled by default. ADR 0001 records the loopback, default-off, timing-safe token comparison, and never-log-token rules QA-05 must implement. Those controls are not implemented in QA-02.

QA-02 does not implement `GHOST_SUCCESS` or a scenario-selected `VERIFICATION_UNAVAILABLE` mode. The 503 lookup result exists so a broken or missing SQLite read is `UNAVAILABLE`, not a verified missing order. Turning that into the three demo scenarios, with an isolated reset, remains QA-05. The confirmation string is intentionally the same shape a later ghost response can reuse; today it is sent only after commit.

## Explicitly absent

Ghost success, scenario-selected verification outages, harness reset, the evidence collector, the runtime agent, the independent validator, the quality gate, Playwright, the golden dataset, authentication, payments, and deployment. The storefront checkout screen is present. It does not implement those fault modes and it does not look up the order it displays.

## Storefront shell (QA-03) and commerce UI (QA-04)

`apps/storefront` renders an accessible shell: skip link, header, section navigation, main, and a status region. The four sections are Catalog, Cart, Checkout, and Confirmation. Changing sections is local button state. There is no router package and no fault-mode control. A sentence in the page says a message on the screen is not proof that an order was saved.

QA-04 fills those sections. On load the page requests `GET /api/products` and renders the returned name, description, and integer-cent price. The cart stores at most 3 distinct SKUs, each with quantity 1–99. Checkout posts `{ runId, items: [{ sku, quantity }] }` to `POST /api/checkout`. The correlation id is a UUID generated in the browser for the attempt that is about to be sent. A failed attempt retires that id, and the next attempt receives a new one. Starting checkout clears any confirmation already on screen. The API still stores a second order when a client repeats a `runId`; this page does not depend on that. The form has no name, address, or payment fields. The catalog estimate is display-only. The confirmation renders `message`, `orderId`, `runId`, and `totalCents` from the response, then says that message is not proof the order was saved. `persistenceChecked` on that view is always false.

The storefront does not call `GET /api/orders/:orderId`. A later `GHOST_SUCCESS` response can reuse the same confirmation shape; this page will show it and still will not decide whether the order exists. A failed catalog load or a failed checkout leaves the confirmation empty. Copy for a checkout 503 says the failure is not proof that an order is missing. The API can be down and the shell still renders the error state.

Dev and preview proxy `/api` to `http://127.0.0.1:3001`. The API process still binds loopback only. No CORS header was added.

Section labels live in `apps/storefront/src/shell-model.ts`. Cart and checkout transitions live in `apps/storefront/src/commerce-model.ts`. HTTP lives in `apps/storefront/src/api-client.ts`. `tests/contract/storefront-shell.test.ts` and `tests/contract/storefront-commerce.test.ts` lock this behavior without a browser. The static shell copy still has `placesOrder: false` because the copy itself does not submit an order. An unknown section id still says no order was placed.
