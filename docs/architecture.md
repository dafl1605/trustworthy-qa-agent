# Architecture — Trustworthy QA Agent MVP

**Status:** Initial record for QA-01 (scaffolding). Update when routes, fault injection, or packages change.

## Monorepo layout

| Path | Role |
| --- | --- |
| `apps/storefront` | React + Vite demo storefront (UI tasks QA-03+) |
| `apps/api` | Node.js HTTP API + SQLite persistence (QA-02+) |
| `packages/shared` | Zod-validated domain contracts shared across apps |
| `packages/evidence-collector` | Planned EP-03 |
| `packages/qa-agent` | Planned EP-04 |
| `packages/validators` | Planned EP-05 |
| `packages/quality-gate` | Planned EP-05 |
| `tests/e2e`, `tests/evals` | Playwright and eval harnesses (later sprints) |
| `fixtures/golden-dataset` | 12 labeled cases (QA-13) |

Authoritative behavioral contracts remain in `docs/architecture-contracts.md` and `packages/shared`.

## ADR-001 — HTTP server (2026-10-30)

**Context:** QA-01 needs a minimal, auditable API shell without committing to a heavy framework before checkout routes exist.

**Decision:** Use Node.js built-in `node:http` for the API entrypoint. Add routing modules per resource in QA-02 rather than importing Express/Fastify/Hono upfront.

**Consequences:** More manual routing, but zero HTTP framework dependency and a clear upgrade path if complexity warrants a router library later.

## ADR-002 — SQLite access (2026-10-30)

**Context:** MVP requires real local persistence with deterministic fault injection (GHOST_SUCCESS) in later tasks.

**Decision:** Use `better-sqlite3` with SQL migrations applied from `apps/api/src/db/schema.sql` via `migrateDatabase()`.

**Consequences:** Native addon build step on install; acceptable for local/demo use per intent. Database file path comes from `DATABASE_PATH` (see `.env.example`).

## ADR-003 — TypeScript strictness (2026-10-30)

**Decision:** Single root `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Apps extend with environment-specific module resolution (NodeNext vs Bundler for Vite).

## Initial SQLite schema (v1)

- `orders(order_id, run_id, total_cents, created_at)`
- `order_items(id, order_id, sku, quantity, unit_price_cents)`
- `schema_migrations(version, applied_at)`

Checkout and fault modes populate these tables starting in QA-02/QA-05.

## Verification (QA-01)

From repository root after `pnpm install`:

- `pnpm typecheck` — all workspace packages
- `pnpm build` — `@tqa/shared`, `@tqa/api`, `@tqa/storefront`

Optional smoke: `pnpm --filter @tqa/api start` then `curl -s http://127.0.0.1:3001/health`.
