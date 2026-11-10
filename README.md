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
pnpm db:migrate
pnpm --filter @tqa/api start   # loopback API on 127.0.0.1:3001
pnpm --filter @tqa/storefront dev   # proxies /api to 127.0.0.1:3001
```

See [`docs/architecture.md`](docs/architecture.md) for layout and ADRs.

- Cursor: [`docs/platforms/cursor/START_CURSOR.md`](docs/platforms/cursor/START_CURSOR.md)
- Claude: [`docs/platforms/claude/START_CLAUDE.md`](docs/platforms/claude/START_CLAUDE.md)
- Shared constraints: [`AGENTS.md`](AGENTS.md), [`docs/intent.md`](docs/intent.md), [`docs/spec.md`](docs/spec.md)
- Development plan: [`docs/sprint-plan.md`](docs/sprint-plan.md)
