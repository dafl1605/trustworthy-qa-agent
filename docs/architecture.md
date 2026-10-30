# Architecture — QA-01 scaffold

This note is the as-built skeleton. Observable product behavior still lives in `docs/spec.md`. Domain names live in `docs/architecture-contracts.md`. Foundation choices live in `docs/adr/0001-runtime-foundations.md`.

## Layout

| Path | Role in QA-01 |
|---|---|
| `apps/storefront` | React + Vite placeholder. No catalog, cart, or checkout |
| `apps/api` | Loopback Node.js server. `GET /health` only. SQLite schema applicator |
| `packages/shared` | Zod schemas and inferred types for the MVP contracts |
| `tests/contract` | Schema, migration, health, config, and log checks |
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
| `pnpm --filter @tqa/api start` | Listen on `127.0.0.1` and `PORT` (default 3001) |
| `pnpm --filter @tqa/storefront dev` | Vite dev server |

`pnpm typecheck` builds `@tqa/shared` before `@tqa/api` because the API resolves shared types from `dist`.

## HTTP

`createApp()` does not listen by itself. `listen()` binds `127.0.0.1`. `GET /health` returns JSON validated by `HealthResponseSchema`. Every other method and path, including `/api/products`, `/api/checkout`, and `/api/orders/:orderId`, returns 404. Those routes are QA-02.

## SQLite

`apps/api/db/schema.sql` is the initial schema. `applySchema()` executes that file and is idempotent (`IF NOT EXISTS`). It does not seed products and it does not delete rows.

`orders`: `order_id`, `run_id`, `total_cents` (>= 0), `currency` (`USD`), `created_at`.

`order_items`: `order_item_id`, `order_id` (foreign key), `sku`, `quantity` (> 0), `unit_price_cents` (>= 0).

Column names are snake_case. Shared order objects are camelCase. QA-02 owns the mapping and the server-side total. Presence of an `orders` row means persisted. Absence is not represented by a status column.

## Shared contracts

`packages/shared/src/contracts.ts` implements the TypeScript shapes in `docs/architecture-contracts.md` as Zod schemas:

- scenarios: `NORMAL`, `GHOST_SUCCESS`, `VERIFICATION_UNAVAILABLE`
- verification: `CONFIRMED`, `DEFECT`, `UNKNOWN`
- gate: `ALLOW`, `BLOCK`, `HOLD`
- diagnosis: `SUCCESS`, `ORDER_NOT_PERSISTED`, `INCONCLUSIVE`, `OTHER`
- `EvidenceRecord`, `AgentDiagnosis`, `GateDecision`
- `OrderRecord` aligned with the table: integer cents, currency `USD`, 1 to 3 line items, UUID `runId` and `orderId`

Each diagnosis claim needs at least one `evidenceId`. `UNKNOWN` is its own verification status. Nothing in this package decides the gate. The decision matrix stays policy for QA-12.

## Harness and faults

No fault-injection route is registered. ADR 0001 records the loopback plus test-process secret rules QA-05 must implement.

## Explicitly absent

Checkout persistence, ghost success, verification outages, the evidence collector, the runtime agent, the independent validator, the quality gate, Playwright, the golden dataset, authentication, payments, and deployment.
