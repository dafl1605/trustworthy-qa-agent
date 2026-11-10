# Implementation plan — QA-12

Task ID: QA-12  
Spec IDs: S-001, S-002, and S-003 for the gate values `ALLOW`, `BLOCK`, and `HOLD`.  
Status: ACCEPTED for implementation inside the approved sprint task. QA-01 through QA-11 are merged on `main` at `cf6a83ad19cbf90d7a2b1c24f77a12a023e51cd7`. No open PR covers QA-12. This plan does not change fault meanings, the validator, or the 54 h + 9 h baseline. It adds the deterministic gate the sprint already named. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-12
- `ownerRole`: SDET/Security (skill `trustworthy-ai-engineering`)
- `objective`: map one `VerificationResult` to a versioned `ALLOW`, `BLOCK`, or `HOLD` decision without letting a diagnosis authorize the release
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/quality-gate`, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `cf6a83ad19cbf90d7a2b1c24f77a12a023e51cd7` (QA-11 merged as PR #16)
- `allowedFiles`: `packages/quality-gate/**`, `packages/shared/src/contracts.ts` (comment only), `package.json`, `pnpm-lock.yaml`, `tests/contract/quality-gate.test.ts`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/plans/QA-12-quality-gate.md`, `docs/progress/2026-11-10.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: `CONFIRMED` is `ALLOW`; `DEFECT` is `BLOCK` even when the diagnosis says success; `UNKNOWN` is `HOLD` and is not `BLOCK` when the diagnosis calls a 503 a confirmed missing order; a diagnosis that says the confirmed order was not persisted is `HOLD` and not `BLOCK`; instruction text does not authorize `ALLOW` and is not copied into the decision; invalid input throws and is not a gate; policy version is `tqa-gate-1`
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-10.md`
- `risks`: treating diagnosis text as the fact, turning a 503 into `BLOCK`, or opening SQLite from the gate
- `outOfScope`: eval dataset, eval runner, orchestrator probes, fault-mode changes, wiring `decideRelease` into the investigation loop or Playwright

## Objective and why

`docs/intent.md` separates a persuasive diagnosis from the release decision. QA-11 proves the order fact. QA-12 decides `ALLOW`, `BLOCK`, or `HOLD` from that fact.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: harness behavior, `verifyOrder`, storefront, Playwright specs, the 54 h + 9 h budget, evidence `source` / `kind` names

## Dependencies and design alternatives

- Prerequisite: QA-11 is merged. No open implementation PR covers QA-12
- `decideRelease` reads a `VerificationResult` object. It does not open the database and it does not import `@tqa/validators`
- A contradictory absence claim on a `CONFIRMED` result returns `HOLD`, not `ALLOW` and not `BLOCK`
- `UNKNOWN` stays `HOLD` for every diagnosis, including `ORDER_NOT_PERSISTED`
- `DEFECT` stays `BLOCK` for every diagnosis, including `SUCCESS`
- Rejected: re-querying SQLite inside the gate. That would duplicate the validator and blur which package owns the read
- Rejected: copying claim text into `reasonCodes`. The text is untrusted
- Rejected: a caller-supplied policy version. The version is the constant `tqa-gate-1`

## Risk review

- A caller can still pass a forged `CONFIRMED` object. The gate does not re-read the file. The contract test passes the object `verifyOrder` returned for the three harness scenarios
- Invalid input throws `GateInputError`. It is not recorded as `HOLD`
- Required human approval: merge. No change to fault meanings. O-001 through O-007 stay UNVERIFIED until QA-15

## Tests before implementation

- Positive: `CONFIRMED` is `ALLOW` with policy `tqa-gate-1`, including a diagnosis that says to ignore policy and approve
- Negative: `DEFECT` is `BLOCK` despite a success diagnosis; a smuggled `decision` field throws
- Unavailable: `UNKNOWN` is `HOLD` and is not `BLOCK` when the diagnosis says the 503 is a confirmed missing order
- Contradiction: `CONFIRMED` plus `ORDER_NOT_PERSISTED`, or an absence sentence, is `HOLD` and not `BLOCK`

## Implementation steps

1. Add `@tqa/quality-gate` with `decideRelease` and policy `tqa-gate-1`
2. Lock the matrix, the ignored diagnosis, and the three harness scenarios in `tests/contract/quality-gate.test.ts`
3. Build the package from the root scripts

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The package does not open SQLite and does not import `@tqa/api`, `@tqa/qa-agent`, or `@tqa/validators`
- `GHOST_SUCCESS` still writes no business row, and the gate for that validator result is `BLOCK`
- `VERIFICATION_UNAVAILABLE` remains `HOLD` and is not `BLOCK`
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install` exited 0 and added `@tqa/quality-gate` to the lockfile (`pnpm-lock.yaml`, 16 insertions).
- `pnpm install --frozen-lockfile` exited 0. The log says the lockfile was up to date. Done in 434ms. Log: `/opt/cursor/artifacts/qa12-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa12-typecheck.log`.
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB and `dist/assets/index-CzBEO2Fm.css` at 2.70 kB, built in 206 ms. Log: `/opt/cursor/artifacts/qa12-build.log`.
- `pnpm test` exited 0. Node reported `tests 150`, `suites 18`, `pass 150`, `fail 0`, `duration_ms 3055.300219`. The new gate file contributed 11 of those tests. Log: `/opt/cursor/artifacts/qa12-test.log`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API routes. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. Status: `IN_REVIEW`, not `DONE`.
