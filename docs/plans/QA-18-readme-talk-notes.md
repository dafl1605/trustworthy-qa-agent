# Implementation plan — QA-18

Task ID: QA-18  
Spec IDs: S-008 for the English talk outline, the meetup runbook, and the deliverable index. The spoken stopwatch stays unmeasured. S-001, S-002, and S-003 are cited, not re-run. S-007 is cited from the QA-15 freeze, not re-measured.  
Status: ACCEPTED for implementation inside the approved sprint task. `origin/main` is `887ee8bb82c54c440f0c21ddeb85e9f7bc42e674` after QA-17 PR #22 merged. No open PR covered QA-18. This plan does not change fault meanings, the validator, the gate policy, the golden dataset, the regression freeze, the slide deck, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-18
- `ownerRole`: Speaker, with the operating contract in `AGENTS.md` and `docs/sprint-plan.md`. No storefront, API, Playwright, or agent behavior changes, so no extra engineering skill was loaded.
- `objective`: write the meetup runbook, the English 35-minute outline, and the deliverable index without inventing a spoken timing
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: runbook section, talk notes, planned-segment JSON, deliverable index, citation test, and the short architecture notes
- `dependencies`: QA-01 through QA-17 merged on `main`. QA-16 supplies the deck. QA-17 supplies the demo script, the backup recording, and the automated rehearsal.
- `allowedFiles`: `README.md`, `docs/speaker/talk-notes.md`, `docs/speaker/talk-rehearsal.json`, `docs/speaker/deliverables.md`, `docs/speaker/demo-script.md`, `docs/plans/QA-18-readme-talk-notes.md`, `docs/progress/2026-11-11.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `tests/README.md`, `tests/contract/talk-notes.test.ts`, `tests/contract/demo-rehearsal.test.ts`
- `skillToLoad`: `AGENTS.md` and `docs/sprint-plan.md` only
- `acceptanceCriteria`: the runbook names `NORMAL` / `ALLOW`, `GHOST_SUCCESS` / `BLOCK`, and `VERIFICATION_UNAVAILABLE` / `HOLD`; it says a green `pnpm test:e2e` is not `ALLOW` and that the ghost oracle is expected to fail with 404 `ABSENT`; the outline is English and its planned segments sum to 2100 seconds, with the demo segment at 720 seconds; `spokenDeliveryMeasured` stays false and `spokenElapsedSeconds` stays null; the backup path is named in the runbook and the outline; the deck sentence that it does not identify a backup recording stays in place; no percent; S-008 is not claimed complete; O-001 through O-007 stay UNVERIFIED
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: logs under `/opt/cursor/artifacts/qa18-*`
- `risks`: treating the 2100-second plan as a timed rehearsal; copying automation or baseline durations into the notes; editing the deck so that it names the backup
- `outOfScope`: a spoken stopwatch, rewriting the slides, probe scoring, fault-mode edits, gate or validator edits, a new dependency, sending the proposal, a headshot, a speaker name

## Objective and why

`docs/intent.md` asks for an English deck and a reproducible repo, and it forbids fictional metrics. `docs/sprint-plan.md` assigns QA-18 the README, English notes, the talk rehearsal, and the deliverable pack. S-008 asks for a timed rehearsal log. QA-17 already timed the automated checkout paths and left `spokenDeliveryMeasured` false. This task writes the remaining speaker pack and records that a person has not timed it.

## Scope and files

- Read: intent, spec S-008, sprint plan, the QA-17 demo script and rehearsal, the QA-16 deck lock
- Change: the files in `allowedFiles`
- Explicitly not change: API, storefront behavior, shared schemas, validator, gate policy, golden dataset, `baseline.json`, Playwright specs, `docs/speaker/slides.md`, the backup video, the 54 h + 9 h numbers

## Dependencies and design alternatives

- Prerequisites: QA-17 is on `main`. No open implementation PR. The remote branch list was only `main`.
- Choice: one markdown outline, one JSON plan with `spokenElapsedSeconds: null`, a runbook section in the existing README, and a contract test that fails on a percent, a spoken-timing claim, or a missing matrix sentence.
- Rejected: setting `spokenDeliveryMeasured` to true. Rejected: generating speech audio and calling that a human rehearsal. Rejected: adding the backup path to `docs/speaker/slides.md`, because QA-16 locks the sentence that the deck does not identify a backup. Rejected: a new dependency for slides or video.

## Risk review

- What can break? The demo-script citation test now also requires the pointer to `docs/speaker/talk-notes.md`. Removing that pointer fails `pnpm test`.
- Risk to fault semantics / gate / permissions? None. The notes quote the existing matrix. They do not call the validator or the gate.
- Required human approval? Sending the proposal, supplying a real name and headshot, and treating S-008 as complete after a person times the talk. None of those happen here.

## Tests before implementation

- Positive: the outline's normal row stays `CONFIRMED` / `ALLOW`, and the planned segments sum to 2100.
- Negative: a runbook that rewrites the ghost path to `ALLOW` fails the citation test. A percent in the notes fails the citation test.
- Unknown: the unavailable row stays `503` `service_unavailable` / `UNKNOWN` / `HOLD`, and `spokenElapsedSeconds` stays null.

## Implementation steps

1. Add the meetup runbook and the QA-18 pointer to `README.md`.
2. Write the English outline, the 2100-second plan, and the deliverable index.
3. Point the demo script at the outline without claiming a spoken timing.
4. Lock the citations with `tests/contract/talk-notes.test.ts`.

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- Acceptance items above. S-008 is not claimed complete.
- A separate reviewer reads the PR head SHA. This plan does not mark the task `DONE`.

## Evidence and actual execution (filled after running)

- Commands run and result: `pnpm install --frozen-lockfile` exit 0. The log says lockfile up to date, 33 packages added, Done in 3.5s. `pnpm typecheck` exit 0. `pnpm build` exit 0. Vite wrote `dist/index.html`, `dist/assets/index-CzBEO2Fm.css` (2.70 kB), and `dist/assets/index--P-9X6xF.js` (234.64 kB), built in 134 ms. The first `pnpm test` exited 1: the notes omitted `Do not quote a percent.` The second `pnpm test` exited 1: `docs/speaker/deliverables.md` did not name itself. The recorded `pnpm test` exited 0 (`tests 198`, `suites 24`, `pass 198`, `fail 0`, `duration_ms 4638.176312`). Two tests are the talk-outline suite. `pnpm test:e2e` was not run.
- Artifact paths: `/opt/cursor/artifacts/qa18-frozen-install.log`, `/opt/cursor/artifacts/qa18-typecheck.log`, `/opt/cursor/artifacts/qa18-build.log`, `/opt/cursor/artifacts/qa18-test.log`
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR exists. Not DONE.
