# Implementation plan template (per task)

Task ID: QA-R3  
Spec IDs: S-001, S-002, S-003, S-004, S-008  
Status: IN_REVIEW

## Objective and why

`docs/intent.md` separates a passing screen, an agent diagnosis, and an independent read. The meetup talk needs one local command that shows that split for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. D-01 sentence 1, PR #24 comment 6806395436, approved `pnpm demo:pipeline` as a contingency exception. PR #24 merged as a docs-only plan, so this implementation is a new branch.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `docs/plans/QA-R3-demo-pipeline-cursor-prompt.md`, existing exports in `@tqa/evidence-collector`, `@tqa/qa-agent`, `@tqa/validators`, and `@tqa/quality-gate`.
- Change: `tests/e2e/demo-pipeline-core.ts`, `tests/e2e/demo-pipeline.ts`, `tests/contract/demo-pipeline.test.ts`, root `package.json` script `demo:pipeline`, speaker timing and backup-recording sentences, architecture notes, this plan, and the progress note.
- Explicitly not change: validator source, gate policy, fault-mode behavior, golden dataset, tool permissions, the 54 h + 9 h totals, and the ghost-oracle assertion.

## Dependencies and design alternatives

- Prerequisites: QA-07 through QA-12 and QA-17 checkout driver are on `main`.
- Choice: one script composes existing exports. The scripted provider is `scripted-mock`. `verifyOrder` opens its own read-only SQLite connection and does not receive the diagnosis. The agent's lookup port repeats the HTTP body already observed.
- Rejected: a live model call, a second agent, a new gate policy, and editing the merged PR #24.

## Risk review

- What can break? Timing pins in the 720-second demo plan, and tests that required the deck to deny the backup file.
- Risk to fault semantics / gate / permissions? None intended. The ghost path stays `BLOCK`. A 503 stays `HOLD` and is not stored as `ABSENT`. The tool session still denies names outside the read-only set.
- Required human approval? D-01 sentence 1 is already recorded. Independent review of this head is still required before merge. Spoken timing for S-008 is still not done.

## Tests before implementation

- Positive: `NORMAL` is 200 `FOUND` / `CONFIRMED` / `ALLOW`, and the scripted `SUCCESS` cites the real lookup id.
- Negative: `GHOST_SUCCESS` scripted `SUCCESS` stays `BLOCK` with `DIAGNOSIS_IGNORED`. A forged evidence id stays unknown and does not authorize `ALLOW`.
- Unknown/unavailable case: `VERIFICATION_UNAVAILABLE` is 503 `service_unavailable` / `UNKNOWN` / `HOLD` when the script claims the order is missing.

## Implementation steps

1. Add the pipeline core and the browser command.
2. Add the contract test around the API and SQLite file, without a browser.
3. Shorten the ghost speech segment from 240 seconds to 180, move the following starts, and keep the 720-second total.
4. Name the existing backup file from the deck and from the checks that used to require the denial sentence.

## Verification commands

- `pnpm install --frozen-lockfile`: exit 0
- `pnpm typecheck`: exit 0
- `pnpm build`: exit 0
- `pnpm test`: exit 0, with the new contract tests included
- `pnpm demo:pipeline`: exit 0 and a three-row table when Chromium is installed; otherwise NOT_VERIFIED
- `pnpm test:e2e` and `pnpm test:e2e:ghost-oracle`: run when the browser is installed; the ghost oracle remains an expected non-zero result

## Exit criteria and independent review

- The printed matrix matches ALLOW / BLOCK / HOLD as specified.
- No package under `packages/validators` or `packages/quality-gate` changes.
- A separate reviewer reads this head. This plan does not mark the task DONE.

## Evidence and actual execution (filled after running)

- Commands run and result: filled in `docs/progress/2026-11-12.md` from the commands actually run.
- Artifact paths: `/opt/cursor/artifacts/`
- Actual elapsed hours: unknown
- Status: IN_REVIEW
