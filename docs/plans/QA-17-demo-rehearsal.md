# Implementation plan — QA-17

Task ID: QA-17  
Spec IDs: S-008 for the 12-minute demo script, an identified backup recording, and a timed rehearsal of the three checkout paths. The spoken 35-minute talk stays QA-18. S-001, S-002, and S-003 are the three paths the rehearsal must keep distinct.  
Status: ACCEPTED for implementation inside the approved sprint task. `origin/main` is `2b9bc521f297c43d1f915c2b790b6c6990724fc3` after QA-16 PR #21 merged. No open PR covered QA-17. This plan does not change fault meanings, the validator, the gate policy, the golden dataset, the regression freeze, the slide citations, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-17
- `ownerRole`: Speaker/SDET, with the operating contract in `AGENTS.md` and `docs/sprint-plan.md`. The rehearsal script sits under `tests/e2e`, so `.claude/skills/playwright-sdet-engineering/SKILL.md` was read before the script was added. No storefront or API behavior changes, so the frontend and backend skills were not loaded.
- `objective`: write the English operator script for NORMAL, GHOST_SUCCESS, and VERIFICATION_UNAVAILABLE, record one explicit backup video of those three screens, and store a timed rehearsal of that automated demo
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: demo script, rehearsal JSON, one webm backup, a contract test, and the short architecture and README pointers
- `dependencies`: QA-01 through QA-16 merged on `main`. QA-05 supplies the three fault modes. QA-06 supplies the browser harness. QA-11 and QA-12 supply the read and the gate. QA-16 supplies the deck, which still must not identify this recording.
- `allowedFiles`: `docs/speaker/demo-script.md`, `docs/speaker/rehearsal/**`, `docs/plans/QA-17-demo-rehearsal.md`, `docs/progress/2026-11-10.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `README.md`, `tests/README.md`, `tests/e2e/README.md`, `tests/contract/demo-rehearsal.test.ts`, `tests/e2e/demo-rehearsal.ts`, `package.json`
- `skillToLoad`: `AGENTS.md` and `docs/sprint-plan.md`. Playwright skill as above.
- `acceptanceCriteria`: the script names all three modes and tells the speaker that the screen says `Order confirmed` in each; the script identifies `docs/speaker/rehearsal/backup-recording.webm` as the backup; the script says a person has not timed it aloud and that S-008 is not complete; the planned speech segments sum to 720 seconds; the rehearsal file records a real elapsed time, `modelInvoked: false`, and `spokenDeliveryMeasured: false`; NORMAL is `200 FOUND` / `CONFIRMED` / `ALLOW`; GHOST_SUCCESS stays `404 ABSENT` / `DEFECT` / `BLOCK` when a scripted `SUCCESS` diagnosis is attached; VERIFICATION_UNAVAILABLE stays `503` `service_unavailable` / `UNKNOWN` / `HOLD`, including a scripted missing-order claim; the video hash matches the file; the script is not part of `pnpm test:e2e`; the deck sentence that it does not identify a backup recording stays in place
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm exec playwright install chromium`, `pnpm demo:rehearsal`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: `docs/speaker/rehearsal/rehearsal.json`, `docs/speaker/rehearsal/backup-recording.webm`, logs under `/opt/cursor/artifacts/qa17-*`
- `risks`: treating the video, or an exit 0 from the rehearsal command, as `ALLOW`; treating the planned 12 minutes as a measured spoken delivery; regenerating the video and forgetting that the hash test will fail until the new file is the one under review
- `outOfScope`: rewriting the slides, a spoken 35-minute rehearsal, README runbook beyond a pointer, probe scoring, fault-mode edits, gate or validator edits, a new dependency, sending the proposal

## Objective and why

`docs/intent.md` asks for a repeatable 12-minute demo and forbids fictional metrics. `docs/sprint-plan.md` assigns QA-17 the three demo scripts, an explicit backup recording, and a rehearsal of the demo. S-008 asks for that demo, the 35-minute content, English notes, and an identified backup, with a timed rehearsal log as evidence. QA-16 left the rehearsal and the recording undone. This task records the three checkout paths and identifies the video. It does not claim a person has delivered the script.

## Scope and files

- Read: intent, spec S-008, sprint plan, the QA-16 deck lock, the checkout harness
- Change: the files in `allowedFiles`
- Explicitly not change: API, storefront behavior, shared schemas, validator, gate policy, golden dataset, `baseline.json`, Playwright specs, `docs/speaker/slides.md`, the 54 h + 9 h numbers

## Dependencies and design alternatives

- Prerequisites: QA-16 is on `main`. No open implementation PR.
- Choice: one markdown operator script, one Playwright video of the three confirmations, and one JSON log of the independent read and the gate. A contract test fails if the script claims a spoken timing, drops the backup path, or the JSON leaves the decision matrix.
- Rejected: adding a slide framework or a video editor dependency. Rejected: a new Playwright spec, because `testMatch` would pull it into the regression project. Rejected: putting the recording path into `docs/speaker/slides.md`, because QA-16 locks the sentence that the deck does not identify a backup. Rejected: writing a fake elapsed time for a person reading the script.

## Risk review

- What can break? A later rehearsal mints new order ids and a new video hash. The citation test fails until that pair is committed together.
- Risk to fault semantics / gate / permissions? The script calls the existing validator and gate. It does not change them. The ghost oracle assertion is untouched. The video shows the confirmation screen and is not the persistence oracle.
- Required human approval? Sending the deck, timing a spoken delivery, and treating S-008 as complete. None of those happen here.

## Tests before implementation

- Positive: the rehearsal's normal checkout is `CONFIRMED` / `ALLOW`, and the script tells the speaker to read the lookup rather than trust the screen.
- Negative: the ghost screen still says `Order confirmed`, the lookup is `404 ABSENT`, and a scripted `SUCCESS` stays `BLOCK`.
- Unknown: the unavailable lookup stays `503` `service_unavailable` / `UNKNOWN` / `HOLD`, including when the scripted text calls it a confirmed missing order.

## Implementation steps

1. Drive the three existing checkout paths, record the screen, and write the elapsed time with the validator and gate results.
2. Write the operator script that identifies that video as the backup and keeps the 12-minute marks as a plan.
3. Lock the matrix, the hash, and the spoken-delivery limitation with `tests/contract/demo-rehearsal.test.ts`.

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm exec playwright install chromium`
- `pnpm demo:rehearsal`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- Acceptance items above. S-008 is not claimed complete. A person has not timed the script aloud.
- A separate reviewer reads the PR head SHA. This plan does not mark the task `DONE`.

## Evidence and actual execution (filled after running)

- Commands run and result: `pnpm install --frozen-lockfile` exit 0 (recorded rerun, 493ms, lockfile already up to date). `pnpm exec playwright install chromium` exit 0. The first `pnpm demo:rehearsal` exited 0 in 2241 ms and wrote a 1.80 s video that did not keep the first two confirmations on screen. A 3000 ms visible hold was added and the command was rerun. That rerun exited 0 at `2026-11-11T00:01:34.164Z` with `elapsedMs` 14082. `ffprobe` reported duration 12.840 s. `pnpm typecheck` exit 0. `pnpm build` exit 0 (Vite JS 234.64 kB, CSS 2.70 kB, 172 ms). `pnpm test` exit 0 (`tests 196`, `pass 196`, `fail 0`, `duration_ms 4032.284585`). `pnpm test:e2e` was not re-run.
- Artifact paths: `/opt/cursor/artifacts/qa17-frozen-install.log`, `/opt/cursor/artifacts/qa17-typecheck.log`, `/opt/cursor/artifacts/qa17-build.log`, `/opt/cursor/artifacts/qa17-test.log`, `docs/speaker/rehearsal/`
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR exists. Not DONE.
