# Implementation plan — QA-09

Task ID: QA-09  
Spec IDs: S-004 is not claimed. This task does not parse a diagnosis. S-005 is extended to the provider boundary: a timeout, a malformed completion, a denied tool, and untrusted log text stay fail-closed. S-002 and S-003 stay in tool observations. No gate decision is produced.  
Status: ACCEPTED for implementation. QA-01 through QA-08 are merged on `main` at `072945dade3787ad4b5964d0cbe569d2bedf19fb`. No open PR covers QA-09. This plan does not change fault semantics, validator ownership, gate policy, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-09
- `ownerRole`: Agent (skill `trustworthy-ai-engineering`)
- `objective`: add a configurable LLM provider adapter, a bounded actor loop, and one investigation report that does not classify the order
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/qa-agent` investigation loop, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `072945dade3787ad4b5964d0cbe569d2bedf19fb` (QA-08 merged as PR #13)
- `allowedFiles`: `packages/qa-agent/**`, `tests/contract/qa-agent-tools.test.ts`, `tests/contract/qa-agent-investigation.test.ts`, `.env.example`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/plans/QA-09-llm-adapter.md`, `docs/progress/2026-11-09.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: one loop calls only the existing read-only tools; a scripted provider is labeled `scripted-mock`; a provider timeout or HTTP 404 is not an order verdict; a shell request is denied; retries are bounded; the report keeps `orderClassified` false and `gateDecision` null
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-09.md`
- `risks`: treating the model note as a diagnosis, treating a provider HTTP status as the order lookup, or describing a scripted fixture as a live model result
- `outOfScope`: QA-10 diagnosis schema and evidence-id checks, `packages/validators`, `packages/quality-gate`, evals, orchestrator probes, fault-mode changes, wiring the loop into Playwright

## Objective and why

`docs/intent.md` asks for one read-only investigator. QA-08 can execute the five tools. QA-09 is the bounded loop that may request those tools. The report has to stay short of a diagnosis so QA-10 can own claims and evidence ids.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: `packages/shared` contracts, fault harness behavior, storefront, Playwright specs, gate policy, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-08 is merged. The loop calls `ReadOnlyToolSession` and does not grow the tool list
- The default provider is not selected from the environment inside the loop. A caller may read `LLM_*` through `readOpenAiCompatibleSettings`. Tests use a scripted provider or an injected transport
- Rejected: parsing `AgentDiagnosis` in this task. That is QA-10
- Rejected: a second model that reviews the first. The runtime stays one investigator
- Rejected: an extra HTTP client dependency. The adapter uses `fetch` and refuses non-local `http`

## Risk review

- `resultOrigin: 'scripted-mock'` is the fixture. `network` only means the default transport ran
- Provider HTTP 404 is `provider_http`. Order 404 remains a tool observation from QA-08
- Required human approval: merge. No change to fault meanings

## Tests before implementation

- Positive: a scripted loop reads a UI pass and a 404 lookup, stores both observations, and still leaves the order unclassified
- Negative: shell after an injected log is `DENIED`; a provider 401 is not retried; a secret in model text is redacted
- Unavailable: a hung provider times out; a provider HTTP 404 does not say the order is absent; malformed JSON abstains

## Implementation steps

1. Add the report schema, the scripted provider, and the OpenAI-compatible adapter
2. Add the bounded loop with retries, a tool budget stop, and no gate field
3. Lock the behavior in `tests/contract/qa-agent-investigation.test.ts`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The package does not decide a gate and does not read SQLite
- A scripted report is not presented as a live model result
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install --frozen-lockfile` exited 0. The lockfile did not change. Log: `/opt/cursor/artifacts/qa09-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa09-typecheck.log`.
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB and `dist/assets/index-CzBEO2Fm.css` at 2.70 kB, built in 148 ms. Log: `/opt/cursor/artifacts/qa09-build.log`.
- `pnpm test` exited 0. Node reported `tests 109`, `pass 109`, `fail 0`, `duration_ms 2642.772585`. The new investigation file contributed 12 of those tests. Log: `/opt/cursor/artifacts/qa09-test.log`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. The 3 h figure is the planned slot.
- Status: IN_REVIEW after the pull request. Not DONE.
