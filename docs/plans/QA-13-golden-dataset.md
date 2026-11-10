# Implementation plan — QA-13

Task ID: QA-13  
Spec IDs: S-006 for the twelve labeled cases. S-001, S-002, and S-003 name the three rows those labels copy. S-004 names the three cases whose scripted candidate is not adopted: `GD-GHOST-03`, `GD-GHOST-04`, and `GD-UNKNOWN-03`.  
Status: ACCEPTED for implementation inside the approved sprint task. QA-01 through QA-12 are merged on `main` at `c6663f1d011d29927d8f9a543c4df0a73e996cb4`. No open PR covers QA-13. This plan does not change fault meanings, `EvalCaseSchema`, the validator, the gate, or the 54 h + 9 h baseline. It adds the labeled dataset the sprint already named. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-13
- `ownerRole`: Eval (skill `trustworthy-ai-engineering`)
- `objective`: store twelve human-authored labels, four per fault mode, with `expectedDiagnosis`, `expectedGate`, and label provenance
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `fixtures/golden-dataset`, a contract parser and tests, architecture and README notes
- `dependencies`: `origin/main` at `c6663f1d011d29927d8f9a543c4df0a73e996cb4` (QA-12 merged as PR #17)
- `allowedFiles`: `fixtures/golden-dataset/**`, `tests/contract/golden-dataset.ts`, `tests/contract/golden-dataset.test.ts`, `README.md`, `tests/README.md`, `tests/evals/README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/plans/QA-13-golden-dataset.md`, `docs/progress/2026-11-10.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: exactly four `NORMAL` / `SUCCESS` / `CONFIRMED` / `ALLOW`, four `GHOST_SUCCESS` / `ORDER_NOT_PERSISTED` / `DEFECT` / `BLOCK`, and four `VERIFICATION_UNAVAILABLE` / `INCONCLUSIVE` / `UNKNOWN` / `HOLD`; provenance is human, dated, and `measuredFromModel: false`; a passing screen is not the label; a scripted `SUCCESS` on a ghost case stays `BLOCK`; a scripted missing-order claim on a 503 stays `HOLD`; a timeout is not `ABSENT`; the contradictory confirmed hold is not an `EvalCase`
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-10.md`
- `risks`: treating the labels as measured model accuracy, or implementing the runner inside this task
- `outOfScope`: eval runner, metric reports, orchestrator probes, fault-mode changes, edits to `EvalCaseSchema`, wiring the dataset into the investigation loop

## Objective and why

`docs/intent.md` asks for a dataset of twelve labeled cases before any measured evaluation. QA-13 records those labels. QA-14 is the first task that may compare a run with them.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: `packages/shared/src/contracts.ts`, the gate, the validator, the harness, the storefront, Playwright specs, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-12 is merged. No open implementation PR covers QA-13
- The dataset file holds the `EvalCase` fields plus provenance, spec ids, a rationale, and a stimulus. `parseGoldenDataset` sends the five `EvalCase` fields through `EvalCaseSchema`
- A scripted candidate may disagree with the label. The label stays on the scenario row
- Rejected: adding provenance fields to `EvalCaseSchema`. Existing contract tests parse an `EvalCase` without those fields, and the contradictory hold is intentionally not an `EvalCase`
- Rejected: calling `decideRelease` or `verifyOrder` while loading labels. That would blur the dataset with the gate and the validator
- Rejected: writing runner output under `tests/evals`. That directory stays empty until QA-14

## Risk review

- A reader can still treat twelve hand-written labels as an accuracy rate. The provenance statement and `measuredFromModel: false` say they are not
- The loader does not execute policy. QA-12 tests still own the contradictory `HOLD`
- Required human approval: merge. No change to fault meanings. O-001 through O-007 stay UNVERIFIED until QA-15

## Tests before implementation

- Positive: twelve cases, four of each matrix row, human provenance, each case accepted by `EvalCaseSchema`
- Negative: a ghost scripted `SUCCESS` and a fabricated evidence id stay `BLOCK`; an untrusted log does not approve a ghost order; a smuggled `decision` field is rejected; a live-model source is rejected
- Unavailable: 503 and timeout stay `HOLD` and are not `ABSENT`; a scripted `ORDER_NOT_PERSISTED` on a 503 stays `INCONCLUSIVE`; a tool timeout with no candidate abstains

## Implementation steps

1. Add `fixtures/golden-dataset/cases.json` with dataset id `tqa-golden-v1`
2. Parse and reject matrix drift in `tests/contract/golden-dataset.ts`
3. Lock the twelve ids and the adversarial stimuli in `tests/contract/golden-dataset.test.ts`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The loader imports `@tqa/shared` and Node file helpers only
- `GHOST_SUCCESS` labels stay `DEFECT` / `BLOCK`
- `VERIFICATION_UNAVAILABLE` labels stay `UNKNOWN` / `HOLD`
- `tests/evals` has no runner
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install --frozen-lockfile` exited 0. The log says the lockfile was already up to date. Done in 533ms. Log: `/opt/cursor/artifacts/qa13-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa13-typecheck.log`.
- `pnpm build` exited 0. The storefront Vite build wrote `dist/index.html`, `dist/assets/index-CzBEO2Fm.css` (2.70 kB), and `dist/assets/index--P-9X6xF.js` (234.64 kB), built in 149 ms. Log: `/opt/cursor/artifacts/qa13-build.log`.
- `pnpm test` exited 0. Node reported `tests 165`, `suites 19`, `pass 165`, `fail 0`, `duration_ms 2808.580939`. Fifteen of those tests are the new golden-dataset suite. Log: `/opt/cursor/artifacts/qa13-test.log`.
- An earlier targeted run of `node --experimental-strip-types --test tests/contract/golden-dataset.test.ts` also exited 0 with `tests 15`, `pass 15`, `fail 0`, `duration_ms 149.404696`, after `pnpm --filter @tqa/shared build`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API routes. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. The 54 h + 9 h baseline is unchanged.
