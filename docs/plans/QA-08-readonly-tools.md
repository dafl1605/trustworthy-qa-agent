# Implementation plan — QA-08

Task ID: QA-08  
Spec IDs: S-005. S-002 and S-003 stay visible in tool observations: a 404 stays distinct from a 503 or a timeout. No gate decision is produced.  
Status: ACCEPTED for implementation. QA-01 through QA-07 are merged on `main` at `a019bfb1b0f2253598e36f3778a8696ce6f879ad`. No open PR covers QA-08. This plan does not change fault semantics, validator ownership, gate policy, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-08
- `ownerRole`: Agent tools (skill `trustworthy-ai-engineering`)
- `objective`: add five read-only investigation tools with input validation, redaction, error states, a record cap, a call budget, and a timeout
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/qa-agent`, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `a019bfb1b0f2253598e36f3778a8696ce6f879ad` (QA-07 merged as PR #12)
- `allowedFiles`: `packages/qa-agent/**`, `packages/evidence-collector/src/index.ts` (export the existing redactors only), `tests/contract/qa-agent-tools.test.ts`, `tests/contract/evidence-collector.test.ts` (export list only), root `package.json`, `pnpm-lock.yaml`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/plans/QA-08-readonly-tools.md`, `docs/progress/2026-11-09.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: only the five named tools run; invalid input, timeout, 404, and 503 stay distinct; secrets in logs are redacted; untrusted log text does not enable a shell; no gate decision is produced
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-09.md`
- `risks`: treating `lookup_order` as the QA-11 validator, or treating tool status `OK` as a release approval
- `outOfScope`: QA-09 provider and actor loop, retries, QA-10 diagnosis schema, `packages/validators`, `packages/quality-gate`, evals, orchestrator probes, fault-mode changes, wiring tools into Playwright

## Objective and why

`docs/intent.md` asks for one read-only investigator. QA-07 can store evidence. QA-08 is the tool boundary the later agent may call. The tool layer has to fail closed before a model is attached.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: `packages/shared` contracts, fault harness behavior, storefront, Playwright specs, gate policy, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-07 is merged. The five tool names are the ones named in the skill
- The order lookup is an injected function. The package does not import `@tqa/api` and does not open SQLite. QA-11 still has to own the authoritative read
- Supplied test rows, network events, and logs are copied at construction. The session does not read the filesystem and does not fetch a URL
- `redactText`, `boundSummary`, and `prepareSummary` are exported from the collector so the tools do not keep a second redactor. The replacement rules are not changed
- Rejected: an LLM call, a retry loop, a diagnosis object, MCP, or a second agent. Those are later tasks or out of scope
- Rejected: raising `maxCalls` above 5. The skill bounds one investigation at five tool calls

## Risk review

- `status: OK` on `lookup_order` means an observation was returned. `observation: ABSENT` is the missing order. Neither value is `ALLOW`
- A session deadline is `TIMEOUT`. A port result of 503 `reason: timeout` stays `UNAVAILABLE`. Neither is `ABSENT`
- Required human approval: merge. No change to fault meanings. The tool allow-list is the set already named for this task

## Tests before implementation

- Positive: list evidence for one run; found lookup returns the server total and says it is not the validator
- Negative: invalid UUID, extra field, shell name, sixth call, secret in a log, secret used as an id
- Unavailable: hung lookup times out; thrown lookup is `source_error`; 503 text does not say 404

## Implementation steps

1. Add `@tqa/qa-agent` and build it from the root scripts
2. Dispatch only the five tools. Deny every other name
3. Validate inputs, cap records, abort a slow lookup, and redact outbound text
4. Lock the behavior in `tests/contract/qa-agent-tools.test.ts`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The package does not decide a gate and does not read SQLite
- 404, 503, and a session timeout stay distinct
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install` exited 0 and added `@tqa/qa-agent` to the lockfile (`pnpm-lock.yaml`, 22 insertions).
- `pnpm install --frozen-lockfile` exited 0. Log: `/opt/cursor/artifacts/qa08-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa08-typecheck.log`.
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB and `dist/assets/index-CzBEO2Fm.css` at 2.70 kB, built in 145 ms. Log: `/opt/cursor/artifacts/qa08-build.log`.
- `pnpm test` exited 0. Node reported `tests 97`, `pass 97`, `fail 0`, `duration_ms 2595.838833`. The read-only tool file contributed 21 of those tests. Log: `/opt/cursor/artifacts/qa08-test.log`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- O-001 through O-007 stay UNVERIFIED until QA-15.
