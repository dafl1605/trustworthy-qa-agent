# Implementation plan — QA-02

Task ID: QA-02  
Spec IDs: S-001 persistence half only (API confirmation plus a real SQLite row and authoritative read). S-002 and S-003 are not implemented.  
Status: ACCEPTED for the happy-path API. Fault-mode behavior stays QA-05.

## Objective and why

`docs/intent.md` needs a checkout whose confirmation can be checked against a real order row. QA-01 left `GET /api/products`, `POST /api/checkout`, and `GET /api/orders/:orderId` unimplemented. This task adds those routes on the existing schema. A passing confirmation still does not, by itself, prove persistence; the tests read SQLite and `GET /api/orders/:orderId` separately.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `docs/architecture.md`, `.claude/skills/backend-typescript-engineering/SKILL.md`
- Change: `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/api/src/orders/**`, `tests/contract/checkout.test.ts`, `tests/contract/health.test.ts`, `docs/architecture.md`, `README.md`, this plan, `docs/progress/2026-10-31.md`
- Explicitly not change: `AGENTS.md`, sprint-plan hours, skills, `.env.example`, shared scenario enums, storefront UI, fault-harness routes, validator package, gate package

## Dependencies and design alternatives

- Prerequisite: QA-01 merged on `origin/main` at `b9ad97629fbbe8360f2750aa655f78cd3604890b`. No open PR and no `feature/QA-02*` branch existed
- HTTP stays on `node:http`. No new dependency
- Prices stay in `PRODUCT_FIXTURES`. A products table was rejected because the architecture contract says products are fixtures
- `createApp({ database })` owns the write connection. The public package root still does not export `openDatabase` or `applySchema`
- Rejected for this task: mounting `GHOST_SUCCESS` or `VERIFICATION_UNAVAILABLE` as request modes. QA-01's progress note and the sprint assign that harness to QA-05. The skill checklist mentions those modes because the same skill also covers QA-05

## Risk review

- Confirmation without a committed row would be an accidental ghost success. The handler returns `CheckoutConfirmation` only after `persist()` returns
- A SQLite read error must not become 404. The handler maps `SqliteError` to `OrderLookupResult` `UNAVAILABLE`
- A stored row that fails `OrderRecordSchema` is 500, not `ABSENT`
- No public scenario toggle. `?scenario=GHOST_SUCCESS` is ignored and the order is still written
- Required human approval: none for this scope. Changing fault semantics later still needs human approval. An LLM claim never authorizes `ALLOW`

## Tests before implementation

- Positive: catalog of three SKUs; checkout of mug x2 + sticker persists total 2997 cents; a second checkout for the same `runId` gets a new `orderId`; quantity 99 uses the catalog price
- Negative: invalid UUID, empty items, four items, duplicate SKU, quantity outside 1..99, unknown SKU, non-JSON body, oversized body, SQL-looking SKU, wrong method. None of those insert a row. A failed item insert rolls back the order. Non-UUID order ids are 400, not 404
- Unavailable: no database, and a closed database, return 503 `UNAVAILABLE` or `persistence_unavailable`, never a confirmation and never `ABSENT`. An order row with no items returns 500

## Implementation steps

1. Price line items from `PRODUCT_FIXTURES` only
2. Persist `orders` and `order_items` in one transaction and map snake_case rows back through `OrderRecordSchema`
3. Mount the three routes on the loopback server and apply the schema at process start
4. Lock the behavior with contract tests, including the ignored public ghost query

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm db:migrate` against a temp file
- Loopback `curl` for products, checkout, found order, and absent order

## Exit criteria and independent review

- Normal checkout persists the server-calculated total and the order lookup agrees with SQLite
- Ghost success and scenario reset are not mounted
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution (filled after running)

- Commands run and result: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, and `pnpm test` exited 0. `pnpm test` reported tests 30, pass 30, fail 0, duration_ms 320.119982. Two migrates against `/tmp/tqa-qa02.sqlite` exited 0. Live curl on `127.0.0.1:3001` persisted total 2997 cents despite a client total of 1, and `?scenario=GHOST_SUCCESS` still wrote a row. Details are in `docs/progress/2026-10-31.md`.
- Artifact paths: `docs/progress/2026-10-31.md`
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR is open. Not DONE
