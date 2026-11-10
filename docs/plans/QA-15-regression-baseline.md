# Implementation plan — QA-15

Task ID: QA-15  
Spec IDs: S-007 for five isolated runs. S-001, S-002, and S-003 are the regression paths being repeated. S-002 stays an expected negative on `pnpm test:e2e:ghost-oracle`.  
Status: ACCEPTED for implementation inside the approved sprint task. QA-01 through QA-14 are merged on `main` at `5d5f9ca4c3ab88df638a2e954e9eaa2a0778de14`. No open PR covered QA-15. This plan does not change fault meanings, the validator, the gate policy, the golden dataset, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-15
- `ownerRole`: SDET (skill `playwright-sdet-engineering`)
- `objective`: run the regression project five times, record the ghost-oracle failure five times, analyze the distribution, and freeze that measured inventory
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: baseline module and tests, the measured JSON file, architecture and README notes, the orchestrator probe record
- `dependencies`: `origin/main` at `5d5f9ca4c3ab88df638a2e954e9eaa2a0778de14` (QA-14 merged as PR #19). QA-05, QA-06, QA-07, QA-11, QA-12, and QA-14 are already in the tree
- `allowedFiles`: `tests/e2e/regression-baseline.ts`, `tests/e2e/regression-baseline.test.ts`, `tests/e2e/README.md`, `tests/README.md`, `fixtures/regression-baseline/**`, `README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/orchestrator-eval-probes.md`, `docs/plans/QA-15-regression-baseline.md`, `docs/progress/2026-11-10.md`
- `skillToLoad`: `.claude/skills/playwright-sdet-engineering/SKILL.md`
- `acceptanceCriteria`: five regression runs pass the same seven tests; five ghost-oracle runs exit 1 with received 404 against an assertion that still expects 200; a flaky run, a passing ghost oracle, a hidden expected failure, and a failed 503 oracle cannot be frozen; the module does not spawn a browser and does not copy error text; O-001 through O-007 are recorded UNVERIFIED rather than self-scored
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`, five `pnpm test:e2e`, five `pnpm test:e2e:ghost-oracle`
- `evidenceArtifacts`: command logs under `/opt/cursor/artifacts/qa15-*` and `fixtures/regression-baseline/baseline.json`
- `risks`: treating the ghost-oracle exit 1 as a product failure to be silenced, or publishing five local runs as a general flakiness rate
- `outOfScope`: fault-mode changes, gate or validator edits, eval-runner edits, slides, demo recording, a new CI workflow, scoring O-001 through O-007 from this same session

## Objective and why

`docs/intent.md` asks for a reproducible checkout and forbids fictional metrics. `docs/sprint-plan.md` assigns QA-15 five regression runs, failure analysis, a real baseline, and a functional freeze. S-007 asks for five isolated runs. The existing `repeatability.spec.ts` already checks five NORMAL checkouts inside one Playwright test. This task repeats the regression project itself.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `docs/orchestrator-eval-probes.md`, `.claude/skills/playwright-sdet-engineering/SKILL.md`, the Playwright specs and config
- Change: the files in the task pack
- Explicitly not change: `apps/api`, `apps/storefront`, `packages/**`, `fixtures/golden-dataset/cases.json`, `tests/evals/runner.ts`, the 54 h + 9 h budget, fault semantics

## Dependencies and design alternatives

- Prerequisite: QA-14 is merged. No open implementation PR covers QA-15
- The freeze function accepts observations the caller already collected. It does not shell out to Playwright, so `pnpm test` stays a node test
- The frozen regression inventory is the seven current spec titles. An extra title is unclassified and cannot be frozen until a human replaces the baseline with a new five-run measurement
- The ghost oracle must remain `expectedStatus: passed`, `observedStatus: failed`, Playwright status `unexpected`, exit code 1. That is the expected negative result
- Rejected: marking the ghost oracle as an expected Playwright failure so the command exits 0. That would hide the red assertion
- Rejected: running the ten browser suites inside `pnpm test`. That would make every unit run depend on Chromium and would mix the measured artifact with a fresh run
- Rejected: scoring O-001 through O-007 as PASS from this implementer session. The probe file requires a clean session and forbids treating a model self-report as evidence
- Rejected: a new package, dependency, or CI workflow

## Risk review

- A later change can make the ghost confirmation show an error. The freeze then fails `limited-ui-ghost` instead of silently accepting the edit
- A later change can turn the 503 oracle into a 404 assertion. The current title and the passing 503 test are part of the inventory; a failed run is `UNAVAILABLE_NOT_GREEN` and is not stored as a missing order
- Required human approval: merge. No change to fault meanings. O-001 through O-007 stay UNVERIFIED

## Tests before implementation

- Positive: five green regression runs and five stable ghost-oracle failures freeze, and the JSON does not contain report error text
- Negative: a ghost oracle that passes, or one whose expected status was flipped to `failed`, is refused. One miss in five runs is flaky and is refused
- Unavailable: a 503 oracle that fails is refused and is not relabeled as absence

## Implementation steps

1. Add `summarizePlaywrightReport`, `analyzeRegressionRuns`, and `freezeFunctionalBaseline`
2. Lock the refusal rules in `tests/e2e/regression-baseline.test.ts`
3. Run the ten browser commands, write `fixtures/regression-baseline/baseline.json` from those reports, and require the file to round-trip

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:e2e` five times
- `pnpm test:e2e:ghost-oracle` five times

## Exit criteria and independent review

- The baseline has five distinct regression start times, exit 0, and seven tests at 5 passed / 0 failed
- The ghost oracle is 0 passed / 5 failed, exit 1, classification `EXPECTED_NEGATIVE_ABSENT_ORDER`
- `playwrightInvokedByModule` is false
- O-001 through O-007 are UNVERIFIED in `docs/orchestrator-eval-probes.md`
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install --frozen-lockfile` exited 0. The recorded log says the lockfile was already up to date. Done in 412 ms. Log: `/opt/cursor/artifacts/qa15-frozen-install.log`. An earlier install in this empty environment also exited 0, added 33 packages, and rebuilt `better-sqlite3`. Done in 3.2 s.
- `pnpm typecheck` exited 0 after the baseline loader locals were narrowed. Log: `/opt/cursor/artifacts/qa15-typecheck.log`. An earlier typecheck exited 1 with `TS18046` on `regression.durationMs` and `regression.exitCodes` because those properties stayed `unknown`. The loader now copies them to locals before the type predicate. That edit does not change the freeze rules.
- `pnpm build` exited 0. The storefront Vite build wrote `dist/index.html`, `dist/assets/index-CzBEO2Fm.css` (2.70 kB), and `dist/assets/index--P-9X6xF.js` (234.64 kB), built in 160 ms. Log: `/opt/cursor/artifacts/qa15-build.log`.
- `pnpm test` exited 0. Node reported `tests 187`, `suites 21`, `pass 187`, `fail 0`, `duration_ms 3828.993788`. Seven of those tests are the new baseline suite. The previous QA-14 total on `main` was 180 tests and 20 suites. Log: `/opt/cursor/artifacts/qa15-test.log`. An earlier run, before the type-narrowing edit, also exited 0 with `tests 187`, `pass 187`, `fail 0`, `duration_ms 4574.015941`. That earlier log was replaced by this rerun.
- `pnpm test:e2e` ran five times. Exits were 0, 0, 0, 0, 0. Each log says `7 passed`. Playwright durations were 15924.874 ms, 15429.495 ms, 15438.628 ms, 15397.251 ms, and 15394.755 ms. Start times are the five values in the baseline file. No test flaked. Logs: `/opt/cursor/artifacts/qa15-regression-1.log` through `qa15-regression-5.log`.
- `pnpm test:e2e:ghost-oracle` ran five times. Exits were 1, 1, 1, 1, 1. Each log says `Expected: 200`, `Received: 404`, and `1 failed`. Playwright durations were 12090.644 ms, 12182.699 ms, 12146.157 ms, 12137.419 ms, and 12346.464 ms. Logs: `/opt/cursor/artifacts/qa15-negative-1.log` through `qa15-negative-5.log`.
- The first regression wrapper wrote `EXIT:0` into its note because the command echoed a prefix. The Playwright log for that run still ends at `7 passed (15.9s)`, and the process status observed for `pnpm test:e2e` was 0. The baseline stores 0.
- The baseline writer then exited 0 and wrote `fixtures/regression-baseline/baseline.json`. `loadMeasuredBaseline` accepts that file.
- O-001 through O-007 were not run in a clean session. The probe file records UNVERIFIED for each one. `pnpm test` does not score them.
- Measured hours: unknown. The 54 h + 9 h baseline is unchanged.

## Review remediation (comment 6780710751)

Reviewed head `4a7b5187d04e348fefb0eef760d9a9a879680809`. F-01, F-02, and F-03 were confirmed in `loadMeasuredBaseline` and `freezeFunctionalBaseline`. The loader now parses the persisted runs. It does not fill in statuses. Each ghost-oracle run stores `observedLookupStatus`, and only 404 can be frozen as the missing order. `assertRegressionRun` and `assertNegativeRun` reject a mismatched `projectName`. The baseline file was rewritten from ten new browser reports in this environment. The earlier aggregate-only file is not the evidence for this head. F-04 / D-01 stays pending a human sentence outside a generated review. O-001 through O-007 stay UNVERIFIED. Status stays IN_REVIEW.
