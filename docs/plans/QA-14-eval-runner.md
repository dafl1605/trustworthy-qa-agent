# Implementation plan — QA-14

Task ID: QA-14  
Spec IDs: S-006. S-001, S-002, and S-003 are the labeled rows being compared. S-004 is the reason a scripted candidate can disagree without changing the label.  
Status: ACCEPTED for implementation inside the approved sprint task. QA-01 through QA-13 are merged on `main` at `c5b3810b722d71202c31144a4ee7d0ad6b3af91f`. No open PR covers QA-14. This plan does not change fault meanings, `EvalCaseSchema`, the validator, the gate policy, the golden-file provenance keys, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-14
- `ownerRole`: Eval (skill `trustworthy-ai-engineering`)
- `objective`: score supplied observations against the twelve golden labels and report raw counts for classification, evidence coverage, abstention, critical-defect detection, and gate consistency
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `tests/evals` runner and tests, typecheck/test script inclusion, architecture and README notes
- `dependencies`: `origin/main` at `c5b3810b722d71202c31144a4ee7d0ad6b3af91f` (QA-13 merged as PR #18)
- `allowedFiles`: `tests/evals/**`, `tests/tsconfig.json`, `tests/README.md`, `package.json`, `README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/plans/QA-14-eval-runner.md`, `docs/progress/2026-11-10.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: a machine-readable report names all twelve cases and separates the five counts; the checked-in scripted run is not a live-model measurement; a scripted `SUCCESS` on a ghost case stays a diagnosis mismatch while the gate stays `BLOCK`; a 503 or timeout stays `UNKNOWN` / `HOLD` and a supplied `BLOCK` on that status is inconsistent with policy; abstaining on an unavailable read is appropriate and abstaining on a normal or ghost case is not; empty or fabricated citations are uncovered; the contradictory `HOLD` is policy-consistent and is still not an `EvalCase`; the runner does not open SQLite or call a model
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-10.md`
- `risks`: publishing the scripted counts as model accuracy, or letting a candidate diagnosis overwrite `BLOCK` / `HOLD`
- `outOfScope`: orchestrator probes, five demo repetitions, fault-mode changes, edits to `EvalCaseSchema` or `labelProvenance`, wiring the runner into the investigation loop or Playwright

## Objective and why

`docs/intent.md` asks for measured evaluation after the twelve labels exist. QA-13 stored the labels and left comparison to QA-14. S-006 asks for counts and a per-case outcome. The skill keeps diagnosis quality separate from gate correctness and forbids turning twelve cases into a reliability claim.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`, the golden dataset and `decideRelease`
- Change: the files in the task pack
- Explicitly not change: `packages/shared/src/contracts.ts`, `packages/quality-gate`, `packages/validators`, `packages/qa-agent`, the harness, the storefront, Playwright specs, `fixtures/golden-dataset/cases.json`, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-13 is merged. No open implementation PR covers QA-14
- `scoreEval` compares one supplied observation per case. The observation carries a diagnosis or an abstention, cited and resolved evidence ids, a verification status, and a gate. The runner does not infer those from the passing screen
- The checked-in scripted score builds observations from `authoritativeLookup` and `scriptedCandidateDiagnosis`. It asks `decideRelease` for the gate. It does not copy `expectedGate` and it does not read `distractor`
- Gate consistency calls the same `decideRelease` policy `tqa-gate-1`. A match against the label is a separate field. `claimsAbsence` is a boolean. When it is set, the policy call uses the fixed phrase `order was not persisted` and does not copy caller text
- F-04: the loader stays in `tests/contract/golden-dataset.ts`. The runner imports `loadGoldenDataset`. Moving the parser would make the runner the owner of label validity. The contract tests already own that file
- Rejected: calling the investigation loop or a live model. Nothing in this task configures a provider, and a `scripted-fixture` source must not be stored as a model result
- Rejected: treating a null diagnosis as a match for `INCONCLUSIVE`. Abstention is its own outcome
- Rejected: adding `reviewedBy` to the golden file. That changes the QA-13 provenance keys. F-03 stays deferred
- Rejected: a new package or dependency

## Risk review

- A reader can treat the scripted counts as an accuracy rate. `measuredFromModel`, `modelInvoked`, `generalizes`, and the limitation sentence say they are not
- The runner can call `decideRelease`, so a future policy change changes consistency results. It does not open SQLite and it does not replace the validator
- Required human approval: merge. No change to fault meanings. O-001 through O-007 stay UNVERIFIED until QA-15

## Tests before implementation

- Positive: twelve scripted outcomes, four per scenario, gate follows policy when the candidate is wrong, JSON report round-trips
- Negative: a ghost `SUCCESS` is a missed defect and an uncovered fabricated id; a supplied `BLOCK` on `UNKNOWN` is inconsistent; abstaining on `NORMAL` is inappropriate; extra fields, duplicate ids, and a missing case are rejected
- Unavailable: timeout and 503 stay `UNKNOWN` / `HOLD`, not `DEFECT` / `BLOCK`. `GD-UNKNOWN-04` abstains and that abstention is appropriate

## Implementation steps

1. Add `tests/evals/runner.ts` with `scoreEval`, `scriptedObservations`, and `scoreCheckedInStimuli`
2. Lock the counts and the adversarial cases in `tests/evals/runner.test.ts`
3. Include `tests/evals/*.test.ts` in `pnpm test` and in `tests/tsconfig.json`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The report has one outcome per golden case and separate raw counts
- `GHOST_SUCCESS` scripted `SUCCESS` stays a diagnosis mismatch and the recorded gate stays `BLOCK`
- `VERIFICATION_UNAVAILABLE` stays `UNKNOWN` / `HOLD`
- The runner does not import `@tqa/api`, `@tqa/validators`, `@tqa/qa-agent`, or SQLite
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install --frozen-lockfile` exited 0. The log says the lockfile was already up to date. Done in 405ms. Log: `/opt/cursor/artifacts/qa14-frozen-install.log`. An earlier install in this empty environment also exited 0, added 33 packages, and rebuilt `better-sqlite3`. Done in 3.4s.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa14-typecheck.log`.
- `pnpm build` exited 0. The storefront Vite build wrote `dist/index.html`, `dist/assets/index-CzBEO2Fm.css` (2.70 kB), and `dist/assets/index--P-9X6xF.js` (234.64 kB), built in 146 ms. Log: `/opt/cursor/artifacts/qa14-build.log`.
- `pnpm test` exited 0. Node reported `tests 180`, `suites 20`, `pass 180`, `fail 0`, `duration_ms 2999.008457`. Fourteen of those tests are the new eval-runner suite. The previous QA-13 total on `main` was 166 tests and 19 suites. Log: `/opt/cursor/artifacts/qa14-test.log`.
- An earlier targeted run of `node --experimental-strip-types --test tests/evals/runner.test.ts` failed 2 assertions: abstaining kept `claimsAbsence: true`, and a `SUCCESS` label was asserted as a diagnosis mismatch. Both assertions were corrected. The rerun exited 0 with `tests 14`, `pass 14`, `fail 0`, before the full `pnpm test`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API routes. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. The 54 h + 9 h baseline is unchanged.
