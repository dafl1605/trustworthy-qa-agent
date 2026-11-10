# Implementation plan — QA-11

Task ID: QA-11  
Spec IDs: S-001, S-002, and S-003 for the validator status only. The gate values `ALLOW`, `BLOCK`, and `HOLD` stay QA-12.  
Status: ACCEPTED for implementation inside the approved sprint task. QA-01 through QA-10 are merged on `main` at `aad1371889cf72b6e626ab8d121f6f6f99c98bc8`. No open PR covers QA-11. This plan does not change fault meanings, the API adapter, or the 54 h + 9 h baseline. It adds the read-only validator the sprint already named. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-11
- `ownerRole`: SDET/Security (skill `trustworthy-ai-engineering`)
- `objective`: add one independent read-only validator that returns `CONFIRMED`, `DEFECT`, or `UNKNOWN` from its own SQLite connection
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/validators`, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `aad1371889cf72b6e626ab8d121f6f6f99c98bc8` (QA-10 merged as PR #15)
- `allowedFiles`: `packages/validators/**`, `packages/shared/src/contracts.ts` (comment only), `package.json`, `pnpm-lock.yaml`, `tests/contract/validator.test.ts`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/plans/QA-11-independent-validator.md`, `docs/progress/2026-11-10.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: a normal stored order with a matching line-item sum is `CONFIRMED`; a ghost checkout with no `orders` row is `DEFECT`; `VERIFICATION_UNAVAILABLE`, a missing file, a schema-less file, and `readBudgetMs: 0` are `UNKNOWN` and are not described as a confirmed absence; a model diagnosis does not change the status; the package does not import `@tqa/api` and does not emit a gate
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-10.md`
- `risks`: treating the API adapter object as the proof, treating a timeout or a 503 as `DEFECT`, or emitting `ALLOW` / `BLOCK` / `HOLD` from this package
- `outOfScope`: `packages/quality-gate`, evals, orchestrator probes, fault-mode changes, renaming the caller row-count evidence fields, wiring `verifyOrder` into the investigation loop or Playwright

## Objective and why

`docs/intent.md` separates a persuasive diagnosis from an independently checked fact. QA-10 can parse a diagnosis. It does not read the order file. QA-11 is that read. The release decision remains QA-12.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: harness behavior, `verifyPersistedOrder`, storefront, Playwright specs, gate policy, the 54 h + 9 h budget, evidence `source` / `kind` names

## Dependencies and design alternatives

- Prerequisite: QA-05 persists the three scenarios and QA-10 is merged. No open implementation PR covers QA-11
- `verifyOrder` opens the database file itself with `readonly: true` and `query_only`
- A model object may be passed and is ignored
- `CONFIRMED` requires the stored `runId`, a schema-valid order, and `sum(quantity * unit_price_cents) === total_cents`
- `readBudgetMs: 0` returns timeout `UNKNOWN` before the file is opened
- Rejected: calling `verifyPersistedOrder` or `GET /api/orders/:orderId` and copying that object. The validator would then trust the adapter it is supposed to check independently
- Rejected: accepting `:memory:` or a `file:` URI. That would let a caller point the check at a private connection
- Rejected: renaming `orders-row-count`. That rename still needs a human decision
- Rejected: returning `ALLOW`, `BLOCK`, or `HOLD`

## Risk review

- The validator copies the harness `SELECT` rules. A later harness change can drift until a contract test fails. The tests drive the real harness and then read the same file
- A missing or unreadable file is `UNKNOWN`, including an empty file with no `orders` table. Absence is only `DEFECT` after the order table was readable and the id was not blocked
- Required human approval: merge. No change to fault meanings. F-02 stays open

## Tests before implementation

- Positive: `NORMAL` checkout, line items sum to 1299 cents, status `CONFIRMED`, and a contradictory diagnosis is ignored
- Negative: `GHOST_SUCCESS` is `DEFECT` despite a success diagnosis; a tampered total and a duplicate SKU are `DEFECT`; another `runId` is `DEFECT`
- Unavailable: `VERIFICATION_UNAVAILABLE` is `UNKNOWN` without the SKU or the total; a ghost id becomes `UNKNOWN` after the run switches; a missing file, an empty file, and `readBudgetMs: 0` are `UNKNOWN`

## Implementation steps

1. Add `@tqa/validators` with a read-only SQLite reader and `verifyOrder`
2. Lock the three scenarios, the ignored diagnosis, and the write probe in `tests/contract/validator.test.ts`
3. Build the package from the root scripts

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The package does not decide a gate and does not import `@tqa/api`
- `GHOST_SUCCESS` still writes no business row
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install` exited 0 and added `@tqa/validators` to the lockfile (`pnpm-lock.yaml`, 22 insertions).
- `pnpm install --frozen-lockfile` exited 0. The log says the lockfile was up to date. Done in 378ms. Log: `/opt/cursor/artifacts/qa11-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa11-typecheck.log`.
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB and `dist/assets/index-CzBEO2Fm.css` at 2.70 kB, built in 135 ms. Log: `/opt/cursor/artifacts/qa11-build.log`.
- `pnpm test` exited 0. Node reported `tests 139`, `suites 17`, `pass 139`, `fail 0`, `duration_ms 2672.825974`. The new validator file contributed 12 of those tests. Log: `/opt/cursor/artifacts/qa11-test.log`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API routes. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. Status: `IN_REVIEW`, not `DONE`.
