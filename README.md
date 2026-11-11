# Trustworthy-qa-agent
Trustworthy AI-powered QA agent for test failure investigation, evidence validation, LLM evaluation, and automated quality gates.

# Trustworthy AI QA Agent — Cloud Development Starter Kit

A reference repository operating kit for the BrowserStack talk **Who Tests the AI That Tests Your Software?**.

The package provides: AI-Native SDLC intent/spec, repository guardrails, four domain skills, Cursor Cloud implementation instructions, Claude Code Web independent-review instructions, protected-main GitHub ruleset guide, and daily task templates.

After **QA-01**, the repo includes a pnpm monorepo scaffold (`apps/storefront`, `apps/api`, `packages/shared`).

After **QA-02**, the API serves `GET /api/products`, `POST /api/checkout`, and `GET /api/orders/:orderId`. A normal checkout is persisted in SQLite before the confirmation response. Fault injection is not mounted.

After **QA-03**, the storefront has an accessible shell with Catalog, Cart, Checkout, and Confirmation sections. A draft meetup abstract, agenda, and bio checklist lives in [`docs/speaker/2026-11-25-browserstack-draft.md`](docs/speaker/2026-11-25-browserstack-draft.md). It has not been sent.

After **QA-04**, those sections list the local catalog, keep a cart of up to 3 products, and submit `POST /api/checkout`. The confirmation shows the checkout response. It does not call `GET /api/orders/:orderId`, and the page says that message is not proof the order was saved.

After **QA-05**, the API can run `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE` for one `runId`. The control routes stay off unless `TQA_HARNESS=1` and `TQA_HARNESS_TOKEN` is set. They require a loopback caller and header `x-tqa-harness-token`. The storefront has no scenario switch. A ghost checkout still returns `Order confirmed` and writes no `orders` row. An unavailable run still returns 503 on the order read, which is not a 404.

After **QA-06**, Playwright can drive the storefront. `pnpm test:e2e` passes a limited confirmation check for `GHOST_SUCCESS` without reading the order, and it runs a separate control that the injected ghost order is still 404 `ABSENT`. That control is not a persistence pass. `pnpm test:e2e:ghost-oracle` keeps the persistence assertion and is expected to fail that case with 404 `ABSENT`. `pnpm demo:false-pass` records five of those failures. See [`tests/e2e/README.md`](tests/e2e/README.md).

After **QA-07**, `@tqa/evidence-collector` turns checkout observations into `EvidenceRecord` values and links `runId` with `orderId`. A UI confirmation record says the screen is not proof the order was saved. A 404 `ABSENT` record stays distinct from a 503 `UNAVAILABLE` record. A cited evidence id that is missing stays unknown. The package does not decide `ALLOW`, `BLOCK`, or `HOLD`, and it does not read or write SQLite. Playwright still writes its own JSON under `test-results/evidence/`.

After **QA-08**, `@tqa/qa-agent` can run five read-only tools: `get_test_result`, `list_evidence`, `get_network_events`, `lookup_order`, and `get_application_logs`. Any other name is denied. A 404 observation stays distinct from a 503 or a timeout. The tools do not decide `ALLOW`, `BLOCK`, or `HOLD`, and they do not open SQLite.

After **QA-09**, the same package can run one bounded investigation. A scripted provider replays fixture turns and is marked `scripted-mock`, which is not a live model result. An OpenAI-compatible provider is optional and stays unconfigured unless `LLM_PROVIDER=openai-compatible` plus a base URL, a model name, and an API key are supplied outside the repo. The loop can retry a provider timeout. It cannot retry an order lookup into a different verdict. The report leaves `orderClassified` false and `gateDecision` null.

After **QA-10**, `checkModelDiagnosis` parses one diagnosis with the shared Zod schema and compares each claim with the evidence index. An empty citation is `UNVERIFIED`. An unknown id, a 503, or a timeout is `UNKNOWN` and does not become a missing order. A UI pass by itself does not support `SUCCESS`. A cited 200 `FOUND` can keep `SUCCESS`, and a cited 404 `ABSENT` can keep `ORDER_NOT_PERSISTED`. The checked label is still not `ALLOW`, `BLOCK`, or `HOLD`. The investigation loop does not call this parser.

After **QA-11**, `@tqa/validators` reads the order file on its own read-only connection. A normal stored order whose line items match the total is `CONFIRMED`. A ghost checkout with no `orders` row is `DEFECT`. A run in `VERIFICATION_UNAVAILABLE`, a missing file, or a read budget of 0 is `UNKNOWN` and is not reported as a missing order. A model diagnosis passed into `verifyOrder` does not change that status. The package does not emit `ALLOW`, `BLOCK`, or `HOLD`.

After **QA-12**, `@tqa/quality-gate` maps that result with policy `tqa-gate-1`. `CONFIRMED` is `ALLOW`, `DEFECT` is `BLOCK`, and `UNKNOWN` is `HOLD`. A model diagnosis cannot turn a ghost order into `ALLOW` or a 503 into `BLOCK`. Text that says to ignore policy and approve the release is not copied into the decision and does not authorize `ALLOW`. A confirmed order whose diagnosis says the order was not persisted is `HOLD` until that claim is reconciled. The package does not open SQLite and does not call a model.

After **QA-13**, `fixtures/golden-dataset/cases.json` holds twelve human-authored labels, four for each fault mode. `NORMAL` is `SUCCESS` / `CONFIRMED` / `ALLOW`. `GHOST_SUCCESS` is `ORDER_NOT_PERSISTED` / `DEFECT` / `BLOCK`. `VERIFICATION_UNAVAILABLE` is `INCONCLUSIVE` / `UNKNOWN` / `HOLD`. The file says `measuredFromModel: false`. A scripted candidate inside a case is not a live model result, and a passing screen is not the label.

After **QA-14**, `tests/evals/runner.ts` compares one supplied observation per label. The report counts classification, evidence coverage, abstention, critical-defect detection, and gate consistency separately. `scoreCheckedInStimuli` uses the scripted stimulus and asks policy `tqa-gate-1` for the gate. A scripted `SUCCESS` on a ghost case stays a diagnosis mismatch, and the gate stays `BLOCK`. A 503 or a timeout stays `UNKNOWN` / `HOLD`. The report says `measuredFromModel: false` and `modelInvoked: false` for that run. Twelve cases are not a reliability rate. The runner does not open SQLite and does not call a model.

After **QA-15**, `fixtures/regression-baseline/baseline.json` freezes five measured `pnpm test:e2e` runs and five measured `pnpm test:e2e:ghost-oracle` runs. The file stores each run's statuses. Each regression run passed the same seven tests, including the limited `GHOST_SUCCESS` confirmation and the 503 oracle. Each ghost-oracle run exited 1, the stored lookup status is 404, and the assertion still expects 200. That failure stays the expected negative result. The freeze is not a release decision. O-001 through O-007 stay UNVERIFIED; `pnpm test` does not score them.

After **QA-16**, [`docs/speaker/slides.md`](docs/speaker/slides.md) is a 14-slide English draft. It has not been sent and it has not been rehearsed aloud. The captures in [`docs/speaker/captures/`](docs/speaker/captures/) show the same `Order confirmed` screen for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. The observation file records lookup `200 FOUND` / `CONFIRMED` / `ALLOW`, `404 ABSENT` / `DEFECT` / `BLOCK`, and `503 UNAVAILABLE` / `UNKNOWN` / `HOLD`. No model was called. The deck quotes the QA-15 freeze and the scripted eval counts, and it does not identify a backup recording. S-008 is not complete.

After **QA-17**, [`docs/speaker/demo-script.md`](docs/speaker/demo-script.md) is the operator script for those three modes. The backup recording is [`docs/speaker/rehearsal/backup-recording.webm`](docs/speaker/rehearsal/backup-recording.webm). [`rehearsal.json`](docs/speaker/rehearsal/rehearsal.json) times the automated checkouts and records the same matrix. `spokenDeliveryMeasured` is false. `pnpm demo:rehearsal` exits 0 when the three paths match that matrix. That exit is not `ALLOW`. A person has not timed the script aloud. S-008 is not complete.

After **QA-18**, the meetup runbook below is the local path for those three modes. [`docs/speaker/talk-notes.md`](docs/speaker/talk-notes.md) is the English outline for the 35-minute content. [`docs/speaker/talk-rehearsal.json`](docs/speaker/talk-rehearsal.json) plans that outline as 2100 seconds and leaves `spokenElapsedSeconds` null. [`docs/speaker/deliverables.md`](docs/speaker/deliverables.md) lists the files a speaker can open. The deck still does not identify the backup recording. A person has not timed the talk aloud. S-008 is not complete.

## Meetup runbook

This section is the local path for the meetup. It does not start a public server, and it does not print a harness token. The storefront has no scenario switch. Fault control stays off unless `TQA_HARNESS=1` and a non-empty `TQA_HARNESS_TOKEN` are set for a loopback caller. Those routes are not under `/api/*`.

`NORMAL` checkout persists the order: lookup `200 FOUND`, verification `CONFIRMED`, gate `ALLOW`.

`GHOST_SUCCESS` shows `Order confirmed` and persists no order: lookup `404 ABSENT`, verification `DEFECT`, gate `BLOCK`.

`VERIFICATION_UNAVAILABLE` shows `Order confirmed` and the order read returns 503 `service_unavailable`: verification `UNKNOWN`, gate `HOLD`.

A 503 is not a 404. `HOLD` is not a softer `BLOCK`. A scripted `SUCCESS` diagnosis does not turn the ghost path into `ALLOW` or the unavailable path into `BLOCK`. Policy version `tqa-gate-1` makes that decision. A passing screen is not the decision.

`pnpm test:e2e` passing does not mean `ALLOW`. It includes a limited confirmation check that passes for `GHOST_SUCCESS` without reading the order.

`pnpm test:e2e:ghost-oracle` is expected to fail the ghost case with 404 `ABSENT`. The assertion still expects HTTP 200. That failure is the expected negative result.

`pnpm demo:false-pass` exits 0 when that false UI pass and the five failing ghost oracles were reproduced. That exit is not `ALLOW`.

`pnpm demo:rehearsal` exits 0 when the three automated paths match the matrix above. That exit is not `ALLOW`. The command can replace the committed backup and its order ids. Say so if you regenerate it before the meetup.

The backup recording is `docs/speaker/rehearsal/backup-recording.webm`.

The deck in `docs/speaker/slides.md` does not identify that recording. If the live checkout cannot be shown, play the video and read only the rows in `docs/speaker/rehearsal/rehearsal.json`. The video is the confirmation screen. It is not the order lookup and it is not a release decision.

The 12-minute words are `docs/speaker/demo-script.md`. The 35-minute outline is `docs/speaker/talk-notes.md`. The file list is `docs/speaker/deliverables.md`.

`spokenDeliveryMeasured` is false. A person has not timed the talk aloud. S-008 is not complete.

O-001 through O-007 remain UNVERIFIED. Do not quote a percent. Do not present a scripted diagnosis as a live model result. The proposal in `docs/speaker/2026-11-25-browserstack-draft.md` has not been sent.

## Requirements

- Node.js `>=22.13.0` (verified on `22.23.4`)
- pnpm `10.33.4` (`packageManager` in `package.json`)
- Chromium for Playwright `1.65.0`: `pnpm exec playwright install chromium`. That package needs its matching browser build. Until the browser is installed, `pnpm test:e2e` stops with `Executable doesn't exist` and does not run an assertion.
- `runId` and `orderId` are UUIDs (Zod `z.uuid()` at shared contract boundaries)

## Local commands (after QA-01)

```bash
pnpm install
pnpm exec playwright install chromium
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
pnpm demo:false-pass
pnpm demo:rehearsal
pnpm db:migrate
pnpm --filter @tqa/api start   # loopback API on 127.0.0.1:3001
pnpm --filter @tqa/storefront dev   # proxies /api to 127.0.0.1:3001
```

See [`docs/architecture.md`](docs/architecture.md) for layout and ADRs.

- Cursor: [`docs/platforms/cursor/START_CURSOR.md`](docs/platforms/cursor/START_CURSOR.md)
- Claude: [`docs/platforms/claude/START_CLAUDE.md`](docs/platforms/claude/START_CLAUDE.md)
- Shared constraints: [`AGENTS.md`](AGENTS.md), [`docs/intent.md`](docs/intent.md), [`docs/spec.md`](docs/spec.md)
- Development plan: [`docs/sprint-plan.md`](docs/sprint-plan.md)
