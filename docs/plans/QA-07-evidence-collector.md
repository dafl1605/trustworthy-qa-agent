# Implementation plan — QA-07

Task ID: QA-07  
Spec IDs: S-002 and S-003 evidence separation only. Gate decisions stay out of scope. S-004 existence check for cited evidence ids is started here and is not an agent diagnosis.  
Status: ACCEPTED for implementation. The orchestrator instruction selected the next unblocked task after QA-06 merged. This plan does not change fault semantics, validator ownership, gate policy, tool permissions, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-07
- `ownerRole`: SDET / evidence (skill `trustworthy-ai-engineering`)
- `objective`: normalize observations into `EvidenceRecord` values and correlate `runId` with `orderId`
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/evidence-collector`, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `eaeee5520ab7755a9e7505b87bf57f51d2fbc0b1` (QA-06 merged as PR #11). No open PR covers QA-07
- `allowedFiles`: `packages/evidence-collector/**`, `tests/contract/evidence-collector.test.ts`, root `package.json`, `pnpm-lock.yaml`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/plans/QA-07-evidence-collector.md`, `docs/progress/2026-11-09.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: UI confirmation is not stored as persistence proof; 404 and 503 stay distinct; unknown evidence ids are reported; secrets in logs are redacted; no gate decision is produced
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-09.md`
- `risks`: treating the collector as a validator or wiring it into Playwright in a way that hides the ghost oracle
- `outOfScope`: QA-08 tools, the runtime agent, `packages/validators`, `packages/quality-gate`, evals, orchestrator probes, fault-mode changes

## Objective and why

`docs/intent.md` needs evidence that can be cited later without treating a UI pass or a model sentence as the business fact. QA-06 already writes checkout JSON. QA-07 normalizes that shape, and direct observations, into the shared `EvidenceRecord` contract and keeps `runId` / `orderId` correlation next to it.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: `packages/shared` `EvidenceRecord` fields, fault harness behavior, storefront, Playwright specs, gate policy, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-01 through QA-06 are merged. `EvidenceRecordSchema` already exists, so this task does not redefine it
- `orderId` stays off the shared record. Correlation is a side index. Adding `orderId` to the contract would change a domain shape that later tasks already import
- Rejected: opening SQLite inside the collector. The validator in QA-11 must own the authoritative read. A supplied row count is only the caller's observation
- Rejected: calling the collector from Playwright in this task. That would mix the QA-06 oracle files with a new writer. The collector accepts the existing JSON instead
- Rejected: a second agent, MCP, or dashboard

## Risk review

- A `RESOLVED` citation means the ids exist. It must not be read as `ALLOW`
- `GHOST_SUCCESS` UI text remains a confirmation record, with a separate absence record when the lookup is 404
- `VERIFICATION_UNAVAILABLE` stays an unknown read, including reason `timeout` on the direct lookup helper
- Required human approval: merge. No change to fault meanings or permissions

## Tests before implementation

- Positive: checkout response plus 200 `FOUND` share one `orderId` and `runId`
- Negative: unknown evidence id, invalid `runId`, duplicate id, one order linked to two runs, redacted harness token
- Unavailable: 503 artifact does not mention 404; contradictory 404 plus code `UNAVAILABLE` stays inconsistent

## Implementation steps

1. Add `@tqa/evidence-collector` and build it from the root scripts
2. Normalize UI, API, DB-count, log, artifact, and QA-06 JSON inputs
3. Index `runId` / `orderId` and classify citations as `UNVERIFIED`, `RESOLVED`, or `UNKNOWN_IDS`
4. Lock the behavior in `tests/contract/evidence-collector.test.ts`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The collector does not decide a gate and does not read SQLite
- 404 and 503 summaries stay distinct
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution (filled after running)

- `pnpm install --frozen-lockfile` exited 0
- `pnpm typecheck` exited 0
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB
- `pnpm test` exited 0. Node reported `tests 73`, `pass 73`, `fail 0`, `duration_ms 828.366699`
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR is open. Not DONE

## Review remediation (PR #12)

Reviewed head `f785de33c3a47c53580461a803823d40f643d718`. Comments `6752514867` (head `b2ebe2d`), `6752594453`, and `6752599205` (both on `f785de33`).

- F-01 is valid. Quoted and JSON secrets, `Authorization: Basic`, `cookie` assignments, and a bare `sk-` key of at least 8 characters are now redacted. Ordinary text is unchanged.
- F-02 stays deferred. `source` remains `db` and `kind` remains `orders-row-count` for a caller-supplied count. Renaming either one needs a later human decision in QA-11.
- F-02b / F-04 is valid. Brackets inside `[UNTRUSTED_TEXT:…]` are escaped.
- F-03 is the PR description. The GitHub body was still the QA-06 text after that note. The next remediation rewrites it and checks the body again.
- A later review of head `4fb87d9756531c5c8ba5e8fdca37cdf9fc33c2ff` found a remaining cookie-header leak, an `Authorization` scheme other than Bearer or Basic, and a quoted value with an escaped quote. Those are corrected in `redact.ts`. `source` and `kind` for the caller-supplied row count stay unchanged.
- Status stays IN_REVIEW. Not DONE. QA-08 does not start from this note.
