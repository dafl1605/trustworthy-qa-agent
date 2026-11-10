# Architecture — QA-01 scaffold, QA-02 checkout API, QA-03 storefront shell, QA-04 commerce UI, QA-05 fault harness, QA-06 Playwright oracle, QA-07 evidence collector, QA-08 read-only tools, QA-09 investigation loop, QA-10 diagnosis check, QA-11 independent validator, QA-12 quality gate, QA-13 golden dataset, QA-14 eval runner

This note is the as-built skeleton. Observable product behavior still lives in `docs/spec.md`. Domain names live in `docs/architecture-contracts.md`. Foundation choices live in `docs/adr/0001-runtime-foundations.md`.

Requires Node.js `>=22.13.0` (this VM: `22.23.4`) and pnpm `10.33.4`. `runId` and `orderId` are UUIDs validated by Zod `z.uuid()` at shared contract boundaries.

## Layout

| Path | Role |
|---|---|
| `apps/storefront` | React + Vite catalog, cart, checkout, and confirmation. The page calls `GET /api/products` and `POST /api/checkout` through the Vite `/api` proxy. It does not call `GET /api/orders/:orderId` |
| `apps/api` | Loopback Node.js server. `GET /health`, fixture catalog, checkout, order lookup, and the local fault harness. Schema apply lives on `@tqa/api/migrate`. The independent order read lives on `@tqa/api/verify`. Neither is exported from the package root |
| `packages/shared` | Zod schemas and inferred types for the MVP contracts. `EvalCase` stays the decision-matrix schema. The twelve labels live in the golden dataset |
| `packages/evidence-collector` | In-memory `EvidenceRecord` index. Correlates `runId` and `orderId`. Does not open SQLite and does not decide a gate |
| `packages/qa-agent` | Five read-only investigation tools, one provider adapter, one bounded actor loop, and one diagnosis claim check. No gate and no SQLite |
| `packages/validators` | Independent read-only order check. Opens its own SQLite connection and returns `CONFIRMED`, `DEFECT`, or `UNKNOWN`. No gate |
| `packages/quality-gate` | Deterministic `ALLOW`, `BLOCK`, and `HOLD` from a `VerificationResult`. Policy `tqa-gate-1`. No SQLite and no model call |
| `tests/contract` | Schema, migration, health, checkout persistence, order lookup, config, log, validator, and quality-gate checks |
| `tests/e2e` | Playwright UI coverage, independent order oracle, and JSON evidence (QA-06) |
| `tests/evals` | Scores supplied observations against the twelve golden labels. Does not call a model and does not open SQLite |
| `fixtures/golden-dataset` | Twelve human-authored labels in `cases.json` (QA-13). Not a model score |

`@tqa/qa-agent` is the QA-08 tool package, the QA-09 investigation loop, and the QA-10 diagnosis check. The loop still does not parse a diagnosis. `checkModelDiagnosis` does, and it does not decide a gate. `@tqa/validators` is the QA-11 package. It does not decide a gate. `@tqa/quality-gate` is the QA-12 package. It decides from a `VerificationResult` and does not open the order file. `@tqa/evidence-collector` is the QA-07 package.

## Workspace

pnpm workspaces (`pnpm-workspace.yaml`). Package names: `@tqa/storefront`, `@tqa/api`, `@tqa/shared`, `@tqa/evidence-collector`, `@tqa/qa-agent`, `@tqa/validators`, `@tqa/quality-gate`. TypeScript strict settings, including `noUncheckedIndexedAccess`, live in `tsconfig.base.json`. `@tqa/api`, `@tqa/evidence-collector`, `@tqa/validators`, and `@tqa/quality-gate` depend on `@tqa/shared`. `@tqa/qa-agent` depends on shared and the evidence collector. `@tqa/validators` also depends on `better-sqlite3`. It does not depend on `@tqa/api`. `@tqa/quality-gate` does not depend on the API, the agent, the validator, or SQLite. The storefront does not depend on shared, so the UI bundle does not pull Zod in before it has a UI contract to use.

Supported commands from the repository root:

| Command | Effect |
|---|---|
| `pnpm typecheck` | Build shared, evidence collector, read-only tools, validator, quality gate, and API declarations, typecheck the storefront, `tests/contract`, `tests/evals`, and `tests/e2e` |
| `pnpm build` | `tsc` for shared, evidence collector, read-only tools, validator, quality gate, and API, Vite production build for the storefront |
| `pnpm test` | Build, typecheck contract and eval tests, run them and the node tests under `tests/e2e` with `node:test`. This does not run Playwright |
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

`GET /api/orders/:orderId` reads the committed rows. It does not echo the checkout response. When the run's current harness scenario is `VERIFICATION_UNAVAILABLE`, this route returns 503 before it returns the row. `verifyPersistedOrder` is a separate `SELECT` with the same rule. `@tqa/validators` is not this route and it does not call `verifyPersistedOrder`. It opens its own read-only connection on the database file.

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
- `VerificationResult` and `EvalCase`. QA-11 returns `VerificationResult`. QA-13 stores twelve `EvalCase` labels. The eval runner is still absent
- `OrderRecord` aligned with the table: integer cents, currency `USD`, 1 to 3 unique line items, UUID `runId` and `orderId`
- `CheckoutRequest`, `Product`, `CheckoutConfirmation`, and `OrderLookupResult` are the HTTP shapes used by the QA-02 routes. `OrderLookupResult` encodes FOUND/200, ABSENT/404, and UNAVAILABLE/503 so UNKNOWN cannot be stored as a missing order
- Checkout and order items reject duplicate SKUs, SKUs longer than 64 characters, and quantities outside 1–99
- `PRODUCT_FIXTURES` is three catalog SKUs with integer-cent prices. Products are not a SQLite table.

A diagnosis claim may have an empty `evidenceIds` array. That claim is UNVERIFIED. Claims that cite evidence still need those IDs to exist and to support the text. An LLM claim never independently authorizes `ALLOW`. `UNKNOWN` is its own verification status. Nothing in `@tqa/shared` decides the gate. The decision matrix is applied by `@tqa/quality-gate`.

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

`verifyPersistedOrder` (`@tqa/api/verify`) runs its own `SELECT` against `orders` and `order_items`. It does not echo the checkout JSON. `VERIFICATION_UNAVAILABLE` is decided before those line items are loaded. This adapter reports `CONFIRMED`, `DEFECT`, or `UNKNOWN`. It does not emit `ALLOW`, `BLOCK`, or `HOLD`. `@tqa/validators` repeats that read on a separate connection. `@tqa/quality-gate` is the policy step after that read.

Harness tables are created only when the harness is mounted. They are not part of `schema.sql` and they are not columns on `orders`. A database that already contains `harness_runs` still blocks authoritative reads for a run left in `VERIFICATION_UNAVAILABLE`, even if a later process starts without the token. New checkouts ghost only while the harness is mounted. Clearing a stuck outage requires mounting the harness again and calling reset. The mode uses 503 `service_unavailable`. It does not simulate a timeout. Both results are `UNKNOWN`, not a confirmed missing order.

Direct SQL is a test inspection of the business tables. It is not the authoritative verification path.

## Evidence collector (QA-07)

`@tqa/evidence-collector` keeps an in-memory index of `EvidenceRecord` values from `@tqa/shared`. The shared record still has `evidenceId`, `runId`, `source`, `observedAt`, `kind`, `summary`, and an optional `artifactUri`. It does not grow an `orderId` field. The order link lives beside the record: `correlationForOrder(orderId)` returns the `runId` and the evidence ids observed for that order. One `orderId` cannot be linked to two `runId` values. One `runId` can still have more than one order, which matches the API.

The collector does not open SQLite, spawn a shell, or return `ALLOW`, `BLOCK`, or `HOLD`. A caller can pass a checkout confirmation, an `OrderLookupResult`, a supplied `orders` row count of 0 or 1, a log line, an artifact path, or the JSON object written by `tests/e2e/evidence.ts`. `ingestCheckoutEvidenceJson` parses that text and does not execute it. Summaries are capped at 280 characters. A trace or screenshot is stored as `artifactUri` plus a short summary. The file body is not copied. Log text is prefixed as untrusted data. UI confirmation text and checkout response messages are wrapped as `[UNTRUSTED_TEXT:…]`. A `[` or `]` inside that text is escaped, so the message cannot close the marker. Assignments of `TQA_HARNESS_TOKEN`, `x-tqa-harness-token`, bearer values, `Authorization: Basic`, any other `Authorization: <scheme> <token>` header, and keys named token, secret, password, api key, authorization, or cookie are replaced with `[redacted]`. A quoted value is removed in full, including spaces and an escaped quote. A `cookie` or `Set-Cookie` header whose first token contains `=` or `;` is removed through the end of that line, so a later pair does not remain. An unquoted value that is not one of those headers stops at the first whitespace. A bare `sk-` key of at least 8 characters is replaced the same way. Ordinary words, including a password-reset sentence and `SKU-MUG`, stay in the text.

A supplied row count is stored with `source: 'db'` and `kind: 'orders-row-count'`. That source is the caller's observation. It is not the QA-11 authoritative read. The summary already says so. Renaming `source` or `kind` still needs a human decision. QA-11 does not rename them.

A UI confirmation summary says the screen is not proof the order was saved. A clean 404 artifact becomes `order-lookup-absent` and does not mention 503. A clean 503 artifact becomes `order-lookup-unavailable` and does not mention 404. A direct `recordOrderLookup` of reason `timeout` keeps that reason. If the artifact's HTTP status, code, and file label disagree, the API record kind is `order-lookup-inconsistent`. The original free-text `summary` on the QA-06 file is not copied, so an instruction hidden there does not become the record. A limited UI file with `consulted: false` produces only the UI record and says the order lookup was not consulted.

`citation([])` is `UNVERIFIED`. `citation` of an id that is not in the index is `UNKNOWN_IDS` and does not invent a record. `RESOLVED` means every cited id exists. It does not mean the claim text is true, and it does not authorize a gate `ALLOW`. Repeating the same checkout artifact returns the existing records.

Playwright still writes `test-results/evidence/*.json` itself. The collector is not called by the e2e runner. `redactText`, `boundSummary`, and `prepareSummary` are exported so the read-only tools use the same redaction. Their replacement rules are unchanged.

## Read-only tools (QA-08)

`@tqa/qa-agent` exposes `ReadOnlyToolSession`. The only tool names it executes are `get_test_result`, `list_evidence`, `get_network_events`, `lookup_order`, and `get_application_logs`. Any other name, including a shell, a database write, a gate approval, or a browse request, returns `DENIED` and is not executed. The tool session and the actor loop do not start a process, open SQLite, or call `fetch`. The provider module is the only file that calls `fetch`.

Inputs are strict objects. An unknown field, a bad UUID, or a limit outside 1–20 is `INVALID_INPUT`. The raw argument is not copied into the result or the call log. A secret-shaped evidence id, log id, event id, or network path is rejected when the session is constructed. Log text and UI messages may contain secrets; those strings are redacted on the way out and labeled as untrusted data. An instruction inside a log does not add a tool or change the next decision.

`maxRecords` is 1–20 and defaults to 20. `maxCalls` is 1–5 and defaults to 5. `timeoutMs` is 1–5000 and defaults to 1000. The call after the budget returns `LIMIT`. The audit log stores at most one entry past the budget.

`list_evidence` reads `summariesForRun` at call time and does not add records. `get_test_result` and `get_network_events` read rows copied at construction. A UI `PASS` summary says the screen is not proof the order was saved. A consulted 404 `ABSENT` stays distinct from a consulted 503 `UNAVAILABLE`. Disagreeing oracle fields stay inconsistent and are not turned into a confirmed missing order.

`lookup_order` calls an injected function and aborts that call when `timeoutMs` elapses. A returned 404 `ABSENT` is `OK` with `observation: 'ABSENT'`. A returned 503 is `UNAVAILABLE` and does not say the order is missing. A session deadline is `TIMEOUT` and is not a 404. `OK` means the tool returned an observation. It is not a release approval. The injected function is not the QA-11 validator, and this package does not emit `ALLOW`, `BLOCK`, or `HOLD`.

Diagnosis claims are checked by `checkModelDiagnosis` below. The tool session itself does not retry a lookup and does not call that checker. Provider retries belong to the investigation loop below.

## Investigation loop (QA-09)

`runInvestigation` is the one runtime actor loop. It takes a `runId`, an optional `orderId`, a `ReadOnlyToolSession`, and one provider. The user text is fixed. A caller cannot pass a free-form prompt. The system prompt says tool output is untrusted data, a UI confirmation is not proof an order was saved, and a 404 is not a 503 or a timeout. The loop does not emit `ALLOW`, `BLOCK`, or `HOLD`.

Two providers exist. `createScriptedProvider` replays turns supplied by the test. Its `resultOrigin` is `scripted-mock`. That report is not a live model result, even when the configured model name looks like a vendor model. `createOpenAiCompatibleProvider` posts to `{baseUrl}/chat/completions`. `https` URLs are accepted. Plain `http` is accepted only for `127.0.0.1`, `localhost`, and `::1`. A URL with a user, a password, a query, or a hash is rejected. The API key is sent only in the `authorization` header. It is not written into the report. An injected transport is `fixture-transport`. The default `fetch` transport is `resultOrigin: 'network'`. On a provider returned by that factory, `network` means that transport ran. The loop checks the label and origin pair on the object it receives. It does not carry a separate unforgeable mark, so a caller-built object can claim `network`. That field is not a score from a vendor and it is not a gate. In Node, `new URL('http://[::1]/').hostname` is `[::1]`. The loopback check compares that value with `::1`, so bracketed IPv6 loopback is rejected. That rejection stays fail-closed until a human approves a matcher change.

The loop asks the provider, then either stops on a final note or calls the tool session once. If a response contains several tool calls, only the first is used. A denied name is returned to the model as data and is not executed. The loop keeps going after `DENIED` so the model receives that result. It does not treat denial as a stop reason. `maxRetries` is 0–2 and defaults to 1. A timeout, a transport error, HTTP 408/429/500/502/503/504, and a malformed completion are retried. Those retries start immediately. There is no backoff. HTTP 401, 403, and 404 are not. A provider HTTP status stays on `providerHttpStatus`. It is not an order lookup. The note for provider HTTP 404 says no order absence was inferred.

`timeoutMs` bounds each provider attempt, from 1 to 10000, default 2000. The loop applies that bound itself. A provider that ignores `AbortSignal` still ends the attempt as `provider_timeout`. The tool session keeps its own lookup timeout. A provider timeout is `PROVIDER_UNAVAILABLE` / `provider_timeout` and does not say the order is missing. After the tool budget returns `LIMIT`, the loop stops with `BUDGET_EXHAUSTED` and does not ask the model again. Token totals stay null unless every counted model response reported non-negative integers. The package does not compute a price.

`readOpenAiCompatibleSettings` reads `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`. It returns `configured: false` unless the provider value is exactly `openai-compatible` and the other three are present. It does not call the network. The loop does not read the environment by itself. `.env.example` still has empty placeholders.

The report field `orderClassified` is always false. `gateDecision` is always null. `untrustedFinalText` is the model's note, redacted and wrapped as untrusted text. A secret-shaped model string is redacted before it is stored. This loop does not parse that note and does not decide whether a ghost checkout failed.

## Diagnosis check (QA-10)

`checkModelDiagnosis` parses one candidate with `AgentDiagnosisSchema` from `@tqa/shared`. The shared contract is unchanged. A string is parsed only when it is JSON and is not already wrapped as `[UNTRUSTED_TEXT:…]`. Prose, malformed JSON, an unknown field such as `decision` or `gate`, a bad diagnosis enum, or a blank claim returns `parseStatus: 'UNPARSEABLE'`. That result has no model label. It does not default to `SUCCESS`.

A parsed object whose `runId` differs from the supplied run is `RUN_MISMATCH`. Its checked label is null. Claim support is forced to `UNKNOWN`.

For a matching run, each claim is compared with `EvidenceCollector.citation`. An empty `evidenceIds` array is citation `UNVERIFIED` and support `UNVERIFIED`. An id that is not in the index is citation `UNKNOWN_IDS` and support `UNKNOWN`. That unknown id is not treated as a missing order. A cited record from another `runId` is also `UNKNOWN`.

Support uses the record `kind`, not the summary sentence. `order-lookup-found` agrees with model label `SUCCESS`. `order-lookup-absent` agrees with `ORDER_NOT_PERSISTED`. Those claims are support `CITED` only when the claim text does not name `ALLOW`, `BLOCK`, or `HOLD` and does not tell the reader to ignore previous instructions. A claim that does is `UNVERIFIED`. The sentence is not otherwise parsed as a fact. A UI confirmation, a checkout response, a log line, or a caller `orders-row-count` does not agree with either label, so the claim stays `UNVERIFIED` even when the id exists. `order-lookup-unavailable`, `order-lookup-inconsistent`, and `order-lookup-run-mismatch` are `UNKNOWN`, including a 503 `service_unavailable` and a 503 `timeout`. A summary that says `404 ABSENT` does not override an unavailable kind. A claim that cites both a found kind and an absent kind is `UNKNOWN`.

`checkedDiagnosis` keeps the model's label only when every claim is `CITED`. Otherwise a parsed diagnosis is `INCONCLUSIVE`. The checker does not rewrite a model `SUCCESS` into `ORDER_NOT_PERSISTED`, and it does not rewrite an abstention into `SUCCESS`. `needsHumanReview` stays true when the model asked for it, when any claim is not `CITED`, or when the parse did not match the run. `releaseAuthorized` is false. `gateDecision` is null. Nothing in this function emits `ALLOW`, `BLOCK`, or `HOLD`.

Secrets in the summary, the claim text, and echoed evidence ids are redacted before they are stored. The investigation loop does not call this function. A scripted object passed to it is fixture input, not a live model result.

## Independent validator (QA-11)

`verifyOrder` in `@tqa/validators` takes a database file path, an `orderId`, and a `runId`. It opens `better-sqlite3` with `readonly: true`, `fileMustExist: true`, and `query_only`. It does not import `@tqa/api` and it does not accept a confirmation object as the fact. `agentDiagnosis` is an optional argument and is ignored, including a success label on a missing row and a missing-order label on a stored row.

A stored order whose `run_id` matches, whose row satisfies `OrderRecordSchema`, and whose line items sum to `total_cents` is `CONFIRMED`. The details name that cent total. No `orders` row, after a read that was allowed to finish, is `DEFECT`. A stored row for another `runId`, a row that fails the order contract, or a total that disagrees with the line items is also `DEFECT`.

`VERIFICATION_UNAVAILABLE` is read from `harness_runs` for the run linked by `harness_checkouts` or by the `orders` row. That result is `UNKNOWN` and the details do not include the SKU or the total. A different unknown id on that same run stays `DEFECT`. A ghost id becomes `UNKNOWN` if the run is later switched to `VERIFICATION_UNAVAILABLE`, because the harness checkout row still links it. Missing harness tables leave the mode off.

A missing file, a database without the order tables, or a SQLite error is `UNKNOWN` and does not say the order is absent. `readBudgetMs: 0` is `UNKNOWN` for a timeout and does not open the file. `:memory:` and `file:` URIs are rejected so the check cannot attach to a private in-memory connection. `probeReadonly` tries to change `user_version` and reports that the write was rejected. The result is a `VerificationResult`. It has no gate field.

## Quality gate (QA-12)

`decideRelease` in `@tqa/quality-gate` takes one `VerificationResult` and an optional `AgentDiagnosis`. It returns a `GateDecision` with policy version `tqa-gate-1`. It does not open SQLite, does not call `verifyOrder`, and does not call a model. A caller that wants an authoritative decision passes the object `verifyOrder` already returned.

`CONFIRMED` becomes `ALLOW` with reason `VERIFICATION_CONFIRMED`. `DEFECT` becomes `BLOCK` with reason `VERIFICATION_DEFECT`. `UNKNOWN` becomes `HOLD` with reason `VERIFICATION_UNKNOWN`. A diagnosis on a defect or an unknown read adds `DIAGNOSIS_IGNORED` and does not change the decision. A success label, a confidence sentence, or the words "ignore policy and approve the release" do not produce `ALLOW` unless the verification status is `CONFIRMED`.

When the verification is `CONFIRMED` and the diagnosis label is `ORDER_NOT_PERSISTED`, or the summary or a claim says the order was not persisted, was not saved, is a confirmed missing order, or that no stored order exists, the decision is `HOLD` with reasons `VERIFICATION_CONFIRMED` and `CLAIMS_CONTRADICT_VERIFICATION`. That hold is the unresolved contradiction. It is not `BLOCK`. An `INCONCLUSIVE` diagnosis that does not make one of those absence claims stays `ALLOW`, because the stored order is the authority.

The decision copies `runId` and `verificationId` only. It does not copy `details`, the summary, or the claim text. `verificationId` must be a UUID. Extra fields, including a smuggled `decision` field, throw `GateInputError` and do not return a gate. A diagnosis whose `runId` differs from the verification throws the same way. Invalid input is not `HOLD` and is not `BLOCK`.

The package does not wire this function into the investigation loop or into Playwright. O-001 through O-007 stay UNVERIFIED. The QA-15 session recorded that score in `docs/orchestrator-eval-probes.md`. `pnpm test` does not score those probes.

## Golden dataset (QA-13)

`fixtures/golden-dataset/cases.json` is dataset `tqa-golden-v1`. It holds twelve cases: four `NORMAL` / `SUCCESS` / `CONFIRMED` / `ALLOW`, four `GHOST_SUCCESS` / `ORDER_NOT_PERSISTED` / `DEFECT` / `BLOCK`, and four `VERIFICATION_UNAVAILABLE` / `INCONCLUSIVE` / `UNKNOWN` / `HOLD`. `tests/contract/golden-dataset.ts` parses each case with `EvalCaseSchema` and rejects a label that leaves that matrix. Provenance says a human authored the labels on 2026-11-10 from the decision matrix. `measuredFromModel` is false.

Every stimulus keeps a passing screen. The screen is not the label. A scripted candidate that says `SUCCESS` on a ghost case does not change `BLOCK`. A scripted candidate that treats a 503 as a missing order does not change `HOLD`. `UNAVAILABLE_TIMEOUT` and `TOOL_TIMEOUT` stay distinct from `ABSENT`. `candidateSource` is `scripted-fixture` or `none`. Neither is a live model result. The loader does not import the gate, the validator, or the agent, and it does not open SQLite.

The QA-12 contradiction, a `CONFIRMED` result with an `ORDER_NOT_PERSISTED` diagnosis, stays out of this file. That `HOLD` is gate policy. It is not an `EvalCase`.

## Eval runner (QA-14)

`scoreEval` in `tests/evals/runner.ts` takes the parsed golden dataset and one observation per case. An observation has a diagnosis or a null abstention, cited evidence ids, the subset of those ids the caller resolved, a verification status, and a gate. The passing screen is not a field. Distractor text is not read and is not copied into the report.

The report version is `tqa-eval-report-1`. It lists every case and counts classification, evidence coverage, abstention, critical-defect detection, verification match, gate match, and gate consistency. Classification compares the diagnosis with the label. Gate match compares the supplied gate with the label. Gate consistency asks `decideRelease` whether that same gate follows policy `tqa-gate-1`. A `claimsAbsence` flag sends the fixed phrase `order was not persisted` into that policy call. The report does not copy caller text. Those counts stay separate. A null diagnosis is `abstained`, not a match for `INCONCLUSIVE`. Abstaining on `VERIFICATION_UNAVAILABLE` is appropriate. Abstaining on `NORMAL` or `GHOST_SUCCESS` is not. A ghost diagnosis of `ORDER_NOT_PERSISTED` is a detected critical defect. Any other ghost diagnosis, including abstention, is missed. An empty citation or an unresolved id is uncovered. Abstention is not an evidence miss.

`scoreCheckedInStimuli` loads `tqa-golden-v1` and builds observations from `authoritativeLookup` and `scriptedCandidateDiagnosis`. `FOUND` is `CONFIRMED`, `ABSENT` is `DEFECT`, and `UNAVAILABLE_503`, `UNAVAILABLE_TIMEOUT`, and `TOOL_TIMEOUT` are `UNKNOWN`. The gate is the policy decision, not a copy of `expectedGate`. `GD-GHOST-03` cites `ev-fabricated`, which is not resolved. The other stimuli name no evidence id. `measuredFromModel` is true only when every supplied source is `live-model`. `modelInvoked` and `authorityExecuted` stay false, because this function does not call a provider and does not open SQLite. `generalizes` stays false. The limitation says n=12 is not a reliability rate.

The loader stays in `tests/contract/golden-dataset.ts`. The runner imports it. O-001 through O-007 stay UNVERIFIED. The QA-15 session recorded that score in `docs/orchestrator-eval-probes.md`. `pnpm test` does not score those probes.

## Explicitly absent

Authentication, payments, and deployment. The investigation report is not a diagnosis and not a gate. `checkedDiagnosis` is not a gate either. `verifyOrder` is not a gate. The golden dataset is not a gate and not a measured accuracy report. The eval report is not a release decision. The storefront still has no scenario control and does not call `GET /api/orders/:orderId`. A ghost confirmation can appear on that page; the page still does not decide whether the order was saved.

## Playwright (QA-06)

`tests/e2e` starts the built API on `127.0.0.1:3011` with a temporary SQLite file and a generated harness token, then starts `vite preview` on `127.0.0.1:4174` with `TQA_API_ORIGIN` pointed at that API. Teardown deletes that SQLite directory only when it is `<tmpdir>/tqa-qa06-<pid>`. The browser never receives the token. Scenario setup uses `POST /harness/runs/:runId/scenario` from Playwright's API client.

The limited UI tests assert the confirmation heading and the text `Order confirmed` for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. They do not call `GET /api/orders/:orderId`. Their JSON evidence sets `oracle.assertion` to `NOT_CONSULTED`.

The NORMAL oracle requires 200 `FOUND`, the same `runId`, and the catalog total for one mug. The unavailable test requires 503 `UNAVAILABLE` / `service_unavailable` and records `UNKNOWN`. It asserts the status is not 404. The ghost oracle uses the same 200 persistence expectation as NORMAL. On `GHOST_SUCCESS` that expectation fails, the evidence records 404 `ABSENT` / `DEFECT`, and the Playwright project `expected-negative` exits non-zero. `pnpm test` and `pnpm test:e2e` do not include that project. `pnpm test:e2e` does include `fault-ghost-characterization.spec.ts`, which expects 404 `ABSENT` as a control that the injected absence is still there. A green result on that control is not the oracle passing.

Five consecutive NORMAL browser checkouts in `repeatability.spec.ts` keep distinct `runId` and `orderId` values, confirm each row, and reset each run twice. That test is one case inside a regression run. It is not, by itself, five executions of the regression project. Traces, screenshots, and `playwright-report.json` are written under the repository `test-results/` directory. Traces and screenshots are kept for passing tests only when `TQA_E2E_DEMO=1`. Ordinary regression retains traces on failure. JSON files under `test-results/evidence/` are still written by the QA-06 helper. They are not produced by `@tqa/evidence-collector`, and they are not a gate decision. The collector can normalize that JSON shape when a caller passes it in. Playwright is not wired to the package.

## Regression baseline (QA-15)

`tests/e2e/regression-baseline.ts` turns a Playwright JSON report into a list of file names, titles, and statuses. It keeps the spec file's base name and drops the rest of the path. It does not copy error text, order ids, or log lines. `freezeFunctionalBaseline` accepts that list only when there are five `pnpm test:e2e` runs and five `pnpm test:e2e:ghost-oracle` runs, the start timestamps are all different, and every regression test is the same passing inventory: the three limited UI checks, the NORMAL oracle, the 503 oracle, the ghost absence control, and the five-checkout repeatability test.

The ghost oracle has to stay an unexpected failure. The test is still written to expect a pass, the observed status is `failed`, and the process exit is 1. Each ghost-oracle observation also stores the HTTP status read from that report, and the freeze accepts only 404. A 503 or a timeout is not stored as a missing order. A run that passes, or a run whose expected status was changed to `failed` so Playwright can exit 0, is not frozen. A 503 oracle that fails is not frozen and is not relabeled as a missing order. One miss among five otherwise green runs is flaky and is not frozen. The committed file is `fixtures/regression-baseline/baseline.json`. It stores each sanitized run, including the spec base name, title, project, and statuses. `loadMeasuredBaseline` parses those runs and requires the bytes to match the canonical freeze. It does not fill in a passing status that the file omitted. The module does not spawn a browser. Five local runs are not a release decision and not a flakiness rate for another machine.

## Storefront shell (QA-03) and commerce UI (QA-04)

`apps/storefront` renders an accessible shell: skip link, header, section navigation, main, and a status region. The four sections are Catalog, Cart, Checkout, and Confirmation. Changing sections is local button state. There is no router package and no fault-mode control. A sentence in the page says a message on the screen is not proof that an order was saved.

QA-04 fills those sections. On load the page requests `GET /api/products` and renders the returned name, description, and integer-cent price. The cart stores at most 3 distinct SKUs, each with quantity 1–99. Checkout posts `{ runId, items: [{ sku, quantity }] }` to `POST /api/checkout`. The correlation id is a UUID generated in the browser for the attempt that is about to be sent. A failed attempt retires that id, and the next attempt receives a new one. Starting checkout clears any confirmation already on screen. The API still stores a second order when a client repeats a `runId`; this page does not depend on that. The form has no name, address, or payment fields. The catalog estimate is display-only. The confirmation renders `message`, `orderId`, `runId`, and `totalCents` from the response, then says that message is not proof the order was saved. `persistenceChecked` on that view is always false.

The storefront does not call `GET /api/orders/:orderId`. A later `GHOST_SUCCESS` response can reuse the same confirmation shape; this page will show it and still will not decide whether the order exists. A failed catalog load or a failed checkout leaves the confirmation empty. Copy for a checkout 503 says the failure is not proof that an order is missing. The API can be down and the shell still renders the error state.

Dev and preview proxy `/api` to `TQA_API_ORIGIN`, or to `http://127.0.0.1:3001` when that variable is unset. The API process still binds loopback only. No CORS header was added. The variable is read by the Vite config, not by the browser bundle.

Section labels live in `apps/storefront/src/shell-model.ts`. Cart and checkout transitions live in `apps/storefront/src/commerce-model.ts`. HTTP lives in `apps/storefront/src/api-client.ts`. `tests/contract/storefront-shell.test.ts` and `tests/contract/storefront-commerce.test.ts` lock this behavior without a browser. The static shell copy still has `placesOrder: false` because the copy itself does not submit an order. An unknown section id still says no order was placed.
