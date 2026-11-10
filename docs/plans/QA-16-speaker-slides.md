# Implementation plan — QA-16

Task ID: QA-16  
Spec IDs: S-008 for the English slide draft only. The timed rehearsal and the identified backup recording stay later tasks. S-001, S-002, and S-003 are the three captures the deck cites. S-007 is cited from the QA-15 freeze, not re-measured here.  
Status: ACCEPTED for implementation inside the approved sprint task. `origin/main` is `238244ecc6ebb2700020d975da320886afb791dd` after QA-15 PR #20 merged. No open PR covered QA-16. This plan does not change fault meanings, the validator, the gate policy, the golden dataset, the regression freeze, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-16
- `ownerRole`: Speaker, with the operating contract in `AGENTS.md` and `docs/sprint-plan.md`. The capture script sits under `tests/e2e`, so `.claude/skills/playwright-sdet-engineering/SKILL.md` was read before the script was kept. No storefront or API behavior changes, so the frontend and backend skills were not loaded.
- `objective`: write a 12–14 slide English deck with speaker notes, a role diagram, and real captures of the three confirmation screens
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: speaker draft deck, four screenshots, the observation file, a contract test that the deck cites only those measurements, and the short architecture notes
- `dependencies`: QA-01 through QA-15 merged on `main`. QA-04 supplies the confirmation screen. QA-05 supplies the three fault modes. QA-11 and QA-12 supply the read and the gate. QA-14 supplies the scripted counts. QA-15 supplies the freeze.
- `allowedFiles`: `docs/speaker/**`, `docs/plans/QA-16-speaker-slides.md`, `docs/progress/2026-11-10.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `README.md`, `tests/README.md`, `tests/contract/speaker-slides.test.ts`, `tests/e2e/speaker-captures.ts`
- `skillToLoad`: `AGENTS.md` and `docs/sprint-plan.md`. Playwright skill as above.
- `acceptanceCriteria`: 12 to 14 English slides; the three screens show `Order confirmed`; the observation file records `200 FOUND` / `CONFIRMED` / `ALLOW`, `404 ABSENT` / `DEFECT` / `BLOCK`, and `503` `service_unavailable` / `UNKNOWN` / `HOLD`; a scripted success diagnosis does not turn the ghost case into `ALLOW` or the 503 into `BLOCK`; the deck quotes the QA-15 limitation and the scripted eval limitation; no percentage; no backup recording is identified; the capture script is not part of `pnpm test:e2e`
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm exec playwright install chromium`, `node --experimental-strip-types tests/e2e/speaker-captures.ts`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: `docs/speaker/captures/*.png`, `docs/speaker/captures/observations.json`, logs under `/opt/cursor/artifacts/qa16-*`
- `risks`: presenting the scripted eval counts or five local runs as a model score or a flakiness rate; letting the capture script join the regression project and change the seven-test freeze
- `outOfScope`: demo scripts, a recording, a timed rehearsal, README runbook beyond a pointer, probe scoring, fault-mode edits, gate or validator edits, a new dependency, sending the proposal

## Objective and why

`docs/intent.md` asks for an English deck and forbids fictional metrics. `docs/sprint-plan.md` assigns QA-16 slides, narrative, real captures, diagrams, and sources. S-008 names the 12-minute demo, the 35-minute content, English speaker notes, and a backup recording. This task writes the notes and the deck. It leaves the rehearsal and the recording for QA-17 and QA-18.

## Scope and files

- Read: intent, spec S-008, sprint plan, the QA-15 baseline, the eval runner's scripted report, the storefront confirmation copy
- Change: the files in `allowedFiles`
- Explicitly not change: API, storefront behavior, shared schemas, validator, gate policy, golden dataset, `baseline.json`, Playwright specs, the 54 h + 9 h numbers

## Dependencies and design alternatives

- Prerequisites: QA-15 is on `main`. No open implementation PR.
- Choice: one markdown deck plus PNG captures and a JSON observation file. A contract test fails if the deck drops a cited sentence, adds a percent, or claims a recording.
- Rejected: adding Marp, Reveal, or another slide dependency. Rejected: a new Playwright spec, because `testMatch` would pull it into the regression project. Rejected: copying baseline durations into the deck. Rejected: filling the speaker name or committing a headshot.

## Risk review

- What can break? A future capture with new order ids will fail the citation test until the slides quote the new ids. That is intentional.
- Risk to fault semantics / gate / permissions? The capture calls the existing validator and gate. It does not change them. The ghost oracle assertion is untouched.
- Required human approval? Sending the deck, replacing bio placeholders, and adding a headshot. None of those happen here.

## Tests before implementation

- Positive: the capture's normal checkout is `CONFIRMED` / `ALLOW`, and the deck cites it.
- Negative: the ghost screen still says `Order confirmed`, the lookup is `404 ABSENT`, and a scripted `SUCCESS` stays `BLOCK`. A deck that rewrites that line fails the test.
- Unknown: the unavailable lookup stays `503` `service_unavailable` / `UNKNOWN` / `HOLD`, including when the scripted text calls it a confirmed missing order.

## Implementation steps

1. Capture the catalog and three confirmations with the existing harness, then record the independent read and the gate.
2. Write 14 slides that quote those records, the baseline limitation, and the scripted eval limitation.
3. Lock the citations with `tests/contract/speaker-slides.test.ts`.

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright install chromium`
- `node --experimental-strip-types tests/e2e/speaker-captures.ts`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- Acceptance items above. S-008 is not claimed complete.
- A separate reviewer reads the PR head SHA. This plan does not mark the task `DONE`.

## Evidence and actual execution (filled after running)

- Commands run and result: `pnpm install --frozen-lockfile` exit 0 (recorded rerun, 410ms). `pnpm exec playwright install chromium` exit 0. Capture script exit 0 with three confirmations at `2026-11-10T22:33:43.412Z`. `pnpm typecheck` exit 0. `pnpm build` exit 0 (Vite JS 234.64 kB, CSS 2.70 kB, 139 ms). `pnpm test` exit 0 (`tests 193`, `pass 193`, `fail 0`, `duration_ms 3733.996532`). `pnpm test:e2e` was not re-run.
- Artifact paths: `/opt/cursor/artifacts/qa16-frozen-install.log`, `/opt/cursor/artifacts/qa16-typecheck.log`, `/opt/cursor/artifacts/qa16-build.log`, `/opt/cursor/artifacts/qa16-test.log`, `docs/speaker/captures/`
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR exists. Not DONE.
