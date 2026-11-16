# Implementation plan template (per task)

Task ID: QA-R4  
Spec IDs: S-008 (speaker delivery; stays incomplete)  
Status: IN_REVIEW (user-requested scope change; human decides merge)

## Objective and why
The user asked to take the demo-support documents out of the repository and study them from an offline pack instead. Code, fixtures, specs and the meetup commands stay, so `docs/intent.md` invariants (NORMAL→ALLOW, GHOST_SUCCESS→BLOCK, VERIFICATION_UNAVAILABLE→HOLD) and the M2 pipeline are unchanged.

## Scope and files
- Remove (19 files):
  - `docs/speaker/**` (deck, talk notes, demo script, abstract draft, deliverables index, captures PNG + `observations.json`, `rehearsal/backup-recording.webm` + `rehearsal.json`, READMEs, `talk-rehearsal.json`)
  - `docs/runbook.md`
  - `docs/plans/QA-16-speaker-slides.md`, `QA-17-demo-rehearsal.md`, `QA-18-readme-talk-notes.md`, `QA-R3-demo-pipeline.md`, `QA-R3-demo-pipeline-cursor-prompt.md`
- Remove coupled tests (3 suites, 8 tests) that only assert the content of removed files:
  - `tests/contract/speaker-slides.test.ts`, `tests/contract/demo-rehearsal.test.ts`, `tests/contract/talk-notes.test.ts`
- Change (dangling references only): `README.md`, `docs/architecture.md`, `docs/architecture-contracts.md`, `docs/implementation-history.md`, `tests/e2e/README.md`, `.gitignore` (add `docs/speaker/`)
- Explicitly not change: `apps/**`, `packages/**`, `fixtures/**`, Playwright specs, `tests/e2e/demo-*.ts`, `tests/e2e/speaker-captures.ts`, `package.json` scripts, gate policy `tqa-gate-1`, fault modes, `AGENTS.md`, `docs/spec.md`, `docs/sprint-plan.md`, historical `docs/progress/*` entries.

## Dependencies and design alternatives
- Prerequisites: `main` at `23fd5ca`; offline study pack already delivered to the user.
- Choice: remove the docs, keep the generators. `demo:rehearsal` and `speaker-captures.ts` still write to `docs/speaker/`, now git-ignored, so regenerating does not re-add files to the repo.
- Rejected: removing code/config (`package.json`, `packages/*/src`, demo scripts). That breaks build, tests and `pnpm demo:*` before the meetup.
- Rejected: keeping the three contract suites. They `readFileSync` removed files and would fail `pnpm test`.
- Rejected: rewriting historical progress logs. They record what happened at the time.

## Risk review
- What can break? `pnpm test` if a test still reads a removed file (mitigated: grep plus full run). Readers following old links (mitigated: references updated).
- Coverage lost: the 8 removed tests also checked that `demo-rehearsal.ts` and `speaker-captures.ts` stay outside the Playwright regression project and that capture hashes match. That guard no longer exists.
- Risk to fault semantics / gate / permissions? None. No runtime code changed.
- Conflict to surface: `AGENTS.md` M3 lists "README/runbook … and English speaker materials". After this PR they live outside the repo. Per precedence #1 the explicit user instruction applies. `AGENTS.md` is not edited here: changing it requires behavioral probes.
- Required human approval? Yes (scope change). A human reviews and merges.

## Tests before implementation
- Positive: `pnpm test` passes with 25 − 3 suites and 200 − 8 tests.
- Negative: grep finds no live reference to removed paths outside history logs and the two generator scripts.
- Unknown/unavailable case: `pnpm demo:pipeline` needs a matching Chromium. Where it cannot launch, report it as unverified, not passed.

## Implementation steps (tasks)
- [x] T1. Inventory demo-support files and grep their references.
- [x] T2. Baseline `pnpm test` on `main`.
- [x] T3. `git rm` the docs listed above and the 3 coupled contract suites.
- [x] T4. Git-ignore `docs/speaker/` so the generators do not re-add files.
- [x] T5. Update dangling references (README, architecture, contracts, history, e2e README).
- [x] T6. Run `pnpm typecheck`, `pnpm build`, `pnpm test` and the risk-router test.
- [ ] T7. Run `pnpm demo:pipeline` with a matching Playwright browser (blocked in the cloud session, see evidence).
- [ ] T8. Independent review on the exact PR head SHA.
- [ ] T9. Human merge decision. Optional follow-up: decide whether `AGENTS.md` M3 wording should change (needs probes).

## Verification commands
- `pnpm typecheck`: exit 0
- `pnpm build`: exit 0
- `pnpm test`: exit 0, 22 suites, 192 tests
- `node --test tests/tqa-risk-router.test.cjs`: exit 0
- `pnpm demo:pipeline`: exit 0 on a machine with the matching browser

## Rollback
`git revert <merge commit>` restores every file, including the binary recording. Alternatively, `git checkout 23fd5ca -- docs/speaker docs/runbook.md docs/plans tests/contract`.

## Exit criteria and independent review
- No live reference to removed files; tests green; runtime code untouched.
- Separate reviewer findings: pending.

## Evidence and actual execution (filled after running)
- Before (`main` 23fd5ca): `pnpm test` exit 0; tests 200, suites 25, pass 200, fail 0.
- After: `pnpm typecheck` exit 0; `pnpm build` exit 0; `pnpm test` exit 0, tests 192, suites 22, pass 192, fail 0; `node --test tests/tqa-risk-router.test.cjs` pass 6, fail 0.
- `pnpm demo:pipeline` exit 1 in the cloud session: `browserType.launch` reports that the Playwright browser is not installed for the pinned version. This is environmental. UNVERIFIED here.
- Artifact paths: local session logs only (not committed).
- Actual elapsed hours: unknown.
- Status: IN_REVIEW
