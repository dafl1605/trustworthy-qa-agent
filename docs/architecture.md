# Architecture — QA-01 scaffold, QA-02 checkout API, QA-03 storefront shell, QA-04 commerce UI, QA-05 fault harness, QA-06 Playwright oracle, QA-07 evidence collector, QA-08 read-only tools

This note is the as-built skeleton. Observable product behavior still lives in `docs/spec.md`. Domain names live in `docs/architecture-contracts.md`. Foundation choices live in `docs/adr/0001-runtime-foundations.md`.

Requires Node.js `>=22.13.0` (this VM: `22.23.4`) and pnpm `10.33.4`. `runId` and `orderId` are UUIDs validated by Zod `z.uuid()` at shared contract boundaries.

## Layout

| Path | Role |
|---|---|
| `apps/storefront` | React + Vite catalog, cart, checkout, and confirmation. The page calls `GET /api/products` and `POST /api/checkout` through the Vite `/api` proxy. It does not call `GET /api/orders/:orderId` |
| `apps/api` | Loopback Node.js server. `GET /health`, fixture catalog, checkout, order lookup, and the local fault harness. Schema apply lives on `@tqa/api/migrate`. The independent order read lives on `@tqa/api/verify`. Neither is exported from the package root |
| `packages/shared` | Zod schemas and inferred types for the MVP contracts, including deferred `VerificationResult` and `EvalCase` |
| `packages/evidence-collector` | In-memory `EvidenceRecord` index. Correlates `runId` and `orderId`. Does not open SQLite and does not decide a gate |
| `packages/qa-agent` | Five read-only investigation tools. No LLM adapter, no gate, no SQLite |
| `tests/contract` | Schema, migration, health, checkout persistence, order lookup, config, and log checks |
| `tests/e2e` | Playwright UI coverage, independent order oracle, and JSON evidence (QA-06) |
| `tests/evals` | Reserved for the eval runner (QA-14). Empty |
| `fixtures/golden-dataset` | Reserved for 12 labeled cases (QA-13). Empty |

`@tqa/qa-agent` is the QA-08 tool package. It does not yet contain the provider adapter or the actor loop. Later packages from the contract doc are not created yet: `validators` and `quality-gate`. `@tqa/evidence-collector` is the QA-07 package.

## Workspace

pnpm workspaces (`pnpm-workspace.yaml`). Package names: `@tqa/storefront`, `@tqa/api`, `@tqa/shared`, `@tqa/evidence-collector`, `@tqa/qa-agent`. TypeScript strict settings, including `noUncheckedIndexedAccess`, live in `tsconfig.base.json`. `@tqa/api` and `@tqa/evidence-collector` depend on `@tqa/shared`. `@tqa/qa-agent` depends on both. The storefront does not, so the UI bundle does not pull Zod in before it has a UI contract to use.

Supported commands from the repository root:

| Command | Effect |
|---|---|
| `pnpm typecheck` | Build shared, evidence collector, read-only tools, and API declarations, typecheck the storefront, `tests/contract`, and `tests/e2e` |
| `pnpm build` | `tsc` for shared, evidence collector, read-only tools, and API, Vite production build for the storefront |
| `pnpm test` | Build, typecheck contract tests, run them with `node:test`. This does not run Playwright |
| `pnpm test:e2e` | Build, then the Playwright regression project. The ghost UI case does not check persistence. A separate characterization test expects the injected ghost order to stay absent |
| `pnpm test:e2e:ghost-oracle` | Build, then the persistence oracle on `GHOST_SUCCESS`. A non-zero exit is the expected negative result |
| `pnpm demo:false-pass` | Replays the limited ghost UI and five failing oracle lookups. Exit 0 means the false PASS was reproduced |
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
| `POST /api/checkout` | 200 `CheckoutConfirmation`. `totalCents` is `quantity * catalog price`. Extra client money fields are ignored. The message `Order confirmed` is the superficial confirmation and is not itself proof of persistence. With the harness off, or with the run in `NORMAL`, that response is sent only after `orders` and `order_items` commit | 400 invalid body or unknown SKU. 500 `{ error: "internal_error" }` when a `SqliteError` is thrown, including a failed item insert or a dropped table. 503 `{ error: "persistence_unavailable" }` when no database was configured or the connection is not open. A failed write does not return an `orderId` |
| `GET /api/orders/:orderId` | 200 `OrderLookupResult` `FOUND` from a separate `SELECT` | 404 `ABSENT` when the UUID is well formed and no row exists. 400 when the id is not a UUID. 503 `UNAVAILABLE` / `service_unavailable` when SQLite throws or no store is configured. 500 when a row exists but does not satisfy `OrderRecordSchema`. A read failure is never reported as `ABSENT` |

Query parameters and extra JSON fields cannot select a scenario. `?scenario=GHOST_SUCCESS` and a JSON `scenario` field still follow the run's harness scenario, which is `NORMAL` until a harness call changes it. The public API does not accept a fault toggle.

A request-target that cannot be parsed as a URL, such as `//[`, returns 400 `{ error: "invalid_request" }` before any route runs. Valid paths and query strings keep their existing responses. A closed database during checkout returns 503 `{ error: "persistence_unavailable" }`, with no confirmation and no new rows. That 503 means persistence was unavailable. It is not a confirmed absence of an order. Decision D-01 option B is applied. A `SqliteError` during the write stays 500 `{ error: "internal_error" }`.

## Checkout persistence

Column names are snake_case. Shared order objects are camelCase. The mapping lives in `apps/api/src/orders/sqlite-store.ts`. Inserts use bound parameters inside one `better-sqlite3` transaction. A trigger or constraint failure rolls the transaction back, and the HTTP response is 500 `{ error: "internal_error" }` with no confirmation body.

`GET /api/orders/:orderId` reads the committed rows. It does not echo the checkout response. When the run's current harness scenario is `VERIFICATION_UNAVAILABLE`, this route returns 503 before it returns the row. `verifyPersistedOrder` is a separate `SELECT` with the same rule. The independent validator package is still QA-11 and is not this route. QA-11 must keep its own read-only connection rather than trusting the confirmation JSON or this adapter's object.

Startup (`apps/api/src/main.ts`) creates the parent directory for `DATABASE_PATH`, opens SQLite, applies `schema.sql`, and then listens. `pnpm db:migrate` remains the explicit apply command. Apply stays idempotent and does not delete rows.

## SQLite

`apps/api/db/schema.sql` is the initial schema. `applySchema()` executes that file and is idempotent (`IF NOT EXISTS`). It does not seed products and it does not delete rows. The public `@tqa/api` entry exports `createApp`, `listen`, the port and database readers, `readHarnessConfig`, the loopback and token helpers, and `formatLog`. It does not export `openDatabase`, `applySchema`, or `verifyPersistedOrder`. Schema apply and `openDatabase` stay on `@tqa/api/migrate`. The order read stays on `@tqa/api/verify`.

`orders`: `order_id`, `run_id`, `total_cents` (>= 0), `currency` (`USD`), `created_at`.

`order_items`: `order_item_id`, `order_id` (foreign key), `sku`, `quantity` (> 0), `unit_price_cents` (>= 0).

Presence of an `orders` row means persisted. Absence is not represented by a status column. `VERIFICATION_UNAVAILABLE` is not a column on `orders`.

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

The harness is disabled unless `TQA_HARNESS=1` and `TQA_HARNESS_TOKEN` is a non-empty process secret. `createApp()` without that token does not mount the control routes. Those routes are `/harness/runs/:runId`, `POST /harness/runs/:runId/scenario`, and `POST /harness/runs/:runId/reset`. They are not under `/api/*` and the storefront does not call them.

A mounted harness still accepts a request only from a loopback peer and only when `x-tqa-harness-token` matches the process secret. The comparison hashes both sides and uses `timingSafeEqual`. A query-string token does not authorize. The token is not written to logs. A missing or wrong token is 401 `{ error: "unauthorized" }`. When the harness is disabled, the same paths are 404.

Scenario state is per `runId`. The default is `NORMAL`. Setting a scenario does not insert an order. `POST /harness/runs/:runId/reset` deletes `orders`, `order_items`, and harness metadata for that `runId` only, then returns the run to `NORMAL`. Repeating the reset deletes zero rows and still returns `NORMAL`.

| Scenario | Checkout response | `orders` / `order_items` | Authoritative read |
|---|---|---|---|
| `NORMAL` | 200 `Order confirmed` after commit | Row stored with the server total | `GET /api/orders/:orderId` is 200 `FOUND`. `verifyPersistedOrder` is `CONFIRMED` |
| `GHOST_SUCCESS` | Same 200 confirmation. The log event is `harness.fault` with `persisted: false`, not `api.checkout_persisted` | No business row. A `harness_checkouts` row records the issued id and `persisted = 0`. That row is not an order | 404 `ABSENT`. `verifyPersistedOrder` is `DEFECT` / `not_persisted` |
| `VERIFICATION_UNAVAILABLE` | Same 200 confirmation. The log event is `harness.fault` with `persisted: true` | The order is committed | 503 `UNAVAILABLE` / `service_unavailable`, including orders already stored for that run. `verifyPersistedOrder` is `UNKNOWN` and does not return line items or the total. A different unknown id stays 404 `ABSENT` / `DEFECT` |

`verifyPersistedOrder` (`@tqa/api/verify`) runs its own `SELECT` against `orders` and `order_items`. It does not echo the checkout JSON. `VERIFICATION_UNAVAILABLE` is decided before those line items are loaded. This adapter reports `CONFIRMED`, `DEFECT`, or `UNKNOWN`. It does not emit `ALLOW`, `BLOCK`, or `HOLD`. The package `packages/validators` and the gate remain QA-11 and QA-12.

Harness tables are created only when the harness is mounted. They are not part of `schema.sql` and they are not columns on `orders`. A database that already contains `harness_runs` still blocks authoritative reads for a run left in `VERIFICATION_UNAVAILABLE`, even if a later process starts without the token. New checkouts ghost only while the harness is mounted. Clearing a stuck outage requires mounting the harness again and calling reset. The mode uses 503 `service_unavailable`. It does not simulate a timeout. Both results are `UNKNOWN`, not a confirmed missing order.

Direct SQL is a test inspection of the business tables. It is not the authoritative verification path.

## Evidence collector (QA-07)

`@tqa/evidence-collector` keeps an in-memory index of `EvidenceRecord` values from `@tqa/shared`. The shared record still has `evidenceId`, `runId`, `source`, `observedAt`, `kind`, `summary`, and an optional `artifactUri`. It does not grow an `orderId` field. The order link lives beside the record: `correlationForOrder(orderId)` returns the `runId` and the evidence ids observed for that order. One `orderId` cannot be linked to two `runId` values. One `runId` can still have more than one order, which matches the API.

The collector does not open SQLite, spawn a shell, or return `ALLOW`, `BLOCK`, or `HOLD`. A caller can pass a checkout confirmation, an `OrderLookupResult`, a supplied `orders` row count of 0 or 1, a log line, an artifact path, or the JSON object written by `tests/e2e/evidence.ts`. `ingestCheckoutEvidenceJson` parses that text and does not execute it. Summaries are capped at 280 characters. A trace or screenshot is stored as `artifactUri` plus a short summary. The file body is not copied. Log text is prefixed as untrusted data. UI confirmation text and checkout response messages are wrapped as `[UNTRUSTED_TEXT:…]`. A `[` or `]` inside that text is escaped, so the message cannot close the marker. Assignments of `TQA_HARNESS_TOKEN`, `x-tqa-harness-token`, bearer values, `Authorization: Basic`, any other `Authorization: <scheme> <token>` header, and keys named token, secret, password, api key, authorization, or cookie are replaced with `[redacted]`. A quoted value is removed in full, including spaces and an escaped quote. A `cookie` or `Set-Cookie` header whose first token contains `=` or `;` is removed through the end of that line, so a later pair does not remain. An unquoted value that is not one of those headers stops at the first whitespace. A bare `sk-` key of at least 8 characters is replaced the same way. Ordinary words, including a password-reset sentence and `SKU-MUG`, stay in the text.

A supplied row count is stored with `source: 'db'` and `kind: 'orders-row-count'`. That source is the caller's observation. It is not the QA-11 authoritative read. The summary already says so. Renaming `source` or `kind` stays deferred to QA-11.

A UI confirmation summary says the screen is not proof the order was saved. A clean 404 artifact becomes `order-lookup-absent` and does not mention 503. A clean 503 artifact becomes `order-lookup-unavailable` and does not mention 404. A direct `recordOrderLookup` of reason `timeout` keeps that reason. If the artifact's HTTP status, code, and file label disagree, the API record kind is `order-lookup-inconsistent`. The original free-text `summary` on the QA-06 file is not copied, so an instruction hidden there does not become the record. A limited UI file with `consulted: false` produces only the UI record and says the order lookup was not consulted.

`citation([])` is `UNVERIFIED`. `citation` of an id that is not in the index is `UNKNOWN_IDS` and does not invent a record. `RESOLVED` means every cited id exists. It does not mean the claim text is true, and it does not authorize a gate `ALLOW`. Repeating the same checkout artifact returns the existing records.

Playwright still writes `test-results/evidence/*.json` itself. The collector is not called by the e2e runner. `redactText`, `boundSummary`, and `prepareSummary` are exported so the read-only tools use the same redaction. Their replacement rules are unchanged.

## Read-only tools (QA-08)

`@tqa/qa-agent` exposes `ReadOnlyToolSession`. The only tool names it executes are `get_test_result`, `list_evidence`, `get_network_events`, `lookup_order`, and `get_application_logs`. Any other name, including a shell, a database write, a gate approval, or a browse request, returns `DENIED` and is not executed. The package source does not start a process, open SQLite, or call `fetch`.

Inputs are strict objects. An unknown field, a bad UUID, or a limit outside 1–20 is `INVALID_INPUT`. The raw argument is not copied into the result or the call log. A secret-shaped evidence id, log id, event id, or network path is rejected when the session is constructed. Log text and UI messages may contain secrets; those strings are redacted on the way out and labeled as untrusted data. An instruction inside a log does not add a tool or change the next decision.

`maxRecords` is 1–20 and defaults to 20. `maxCalls` is 1–5 and defaults to 5. `timeoutMs` is 1–5000 and defaults to 1000. The call after the budget returns `LIMIT`. The audit log stores at most one entry past the budget.

`list_evidence` reads `summariesForRun` at call time and does not add records. `get_test_result` and `get_network_events` read rows copied at construction. A UI `PASS` summary says the screen is not proof the order was saved. A consulted 404 `ABSENT` stays distinct from a consulted 503 `UNAVAILABLE`. Disagreeing oracle fields stay inconsistent and are not turned into a confirmed missing order.

`lookup_order` calls an injected function and aborts that call when `timeoutMs` elapses. A returned 404 `ABSENT` is `OK` with `observation: 'ABSENT'`. A returned 503 is `UNAVAILABLE` and does not say the order is missing. A session deadline is `TIMEOUT` and is not a 404. `OK` means the tool returned an observation. It is not a release approval. The injected function is not the QA-11 validator, and this package does not emit `ALLOW`, `BLOCK`, or `HOLD`.

The provider adapter, the bounded actor loop, and retries are QA-09. Diagnosis claims are QA-10. There is no automatic retry in this package.

## Explicitly absent

The LLM provider, the actor loop, the independent validator package, the quality gate, the golden dataset, authentication, payments, and deployment. The read-only tool session is present and is not that agent. The storefront still has no scenario control and does not call `GET /api/orders/:orderId`. A ghost confirmation can appear on that page; the page still does not decide whether the order was saved.

## Playwright (QA-06)

`tests/e2e` starts the built API on `127.0.0.1:3011` with a temporary SQLite file and a generated harness token, then starts `vite preview` on `127.0.0.1:4174` with `TQA_API_ORIGIN` pointed at that API. Teardown deletes that SQLite directory only when it is `<tmpdir>/tqa-qa06-<pid>`. The browser never receives the token. Scenario setup uses `POST /harness/runs/:runId/scenario` from Playwright's API client.

The limited UI tests assert the confirmation heading and the text `Order confirmed` for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. They do not call `GET /api/orders/:orderId`. Their JSON evidence sets `oracle.assertion` to `NOT_CONSULTED`.

The NORMAL oracle requires 200 `FOUND`, the same `runId`, and the catalog total for one mug. The unavailable test requires 503 `UNAVAILABLE` / `service_unavailable` and records `UNKNOWN`. It asserts the status is not 404. The ghost oracle uses the same 200 persistence expectation as NORMAL. On `GHOST_SUCCESS` that expectation fails, the evidence records 404 `ABSENT` / `DEFECT`, and the Playwright project `expected-negative` exits non-zero. `pnpm test` and `pnpm test:e2e` do not include that project. `pnpm test:e2e` does include `fault-ghost-characterization.spec.ts`, which expects 404 `ABSENT` as a control that the injected absence is still there. A green result on that control is not the oracle passing.

Five consecutive NORMAL browser checkouts in `repeatability.spec.ts` keep distinct `runId` and `orderId` values, confirm each row, and reset each run twice. Traces, screenshots, and `playwright-report.json` are written under the repository `test-results/` directory. Traces and screenshots are kept for passing tests only when `TQA_E2E_DEMO=1`. Ordinary regression retains traces on failure. JSON files under `test-results/evidence/` are still written by the QA-06 helper. They are not produced by `@tqa/evidence-collector`, and they are not a gate decision. The collector can normalize that JSON shape when a caller passes it in. Playwright is not wired to the package.

## Storefront shell (QA-03) and commerce UI (QA-04)

`apps/storefront` renders an accessible shell: skip link, header, section navigation, main, and a status region. The four sections are Catalog, Cart, Checkout, and Confirmation. Changing sections is local button state. There is no router package and no fault-mode control. A sentence in the page says a message on the screen is not proof that an order was saved.

QA-04 fills those sections. On load the page requests `GET /api/products` and renders the returned name, description, and integer-cent price. The cart stores at most 3 distinct SKUs, each with quantity 1–99. Checkout posts `{ runId, items: [{ sku, quantity }] }` to `POST /api/checkout`. The correlation id is a UUID generated in the browser for the attempt that is about to be sent. A failed attempt retires that id, and the next attempt receives a new one. Starting checkout clears any confirmation already on screen. The API still stores a second order when a client repeats a `runId`; this page does not depend on that. The form has no name, address, or payment fields. The catalog estimate is display-only. The confirmation renders `message`, `orderId`, `runId`, and `totalCents` from the response, then says that message is not proof the order was saved. `persistenceChecked` on that view is always false.

The storefront does not call `GET /api/orders/:orderId`. A later `GHOST_SUCCESS` response can reuse the same confirmation shape; this page will show it and still will not decide whether the order exists. A failed catalog load or a failed checkout leaves the confirmation empty. Copy for a checkout 503 says the failure is not proof that an order is missing. The API can be down and the shell still renders the error state.

Dev and preview proxy `/api` to `TQA_API_ORIGIN`, or to `http://127.0.0.1:3001` when that variable is unset. The API process still binds loopback only. No CORS header was added. The variable is read by the Vite config, not by the browser bundle.

Section labels live in `apps/storefront/src/shell-model.ts`. Cart and checkout transitions live in `apps/storefront/src/commerce-model.ts`. HTTP lives in `apps/storefront/src/api-client.ts`. `tests/contract/storefront-shell.test.ts` and `tests/contract/storefront-commerce.test.ts` lock this behavior without a browser. The static shell copy still has `placesOrder: false` because the copy itself does not submit an order. An unknown section id still says no order was placed.
