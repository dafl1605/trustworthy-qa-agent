# Implementation plan — QA-03 storefront shell and speaker draft

Task ID: QA-03  
Spec IDs: S-008 (draft materials only; the timed rehearsal is not this task)  
Status: ACCEPTED for this orchestrator run. The sprint names this as the next unblocked task after QA-02. Evidence is recorded only after commands run.

## Objective and why
Replace the QA-01 placeholder with an accessible storefront shell, and draft the English meetup abstract, agenda, and bio checklist. The shell exists so QA-04 can add catalog, cart, checkout, and confirmation without inventing a second page structure. The speaker draft exists so a human can review it before anything is sent. See `docs/intent.md`: a UI message is not proof of persistence, and speaker claims must not use measurements that do not exist yet.

## Scope and files
- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/frontend-react-engineering/SKILL.md`, current `apps/storefront`
- Change:
  - `apps/storefront/src/shell-model.ts`
  - `apps/storefront/src/App.tsx`
  - `apps/storefront/src/styles.css`
  - `tests/contract/storefront-shell.test.ts`
  - `tests/tsconfig.json` (`allowImportingTsExtensions` so the contract test can import the shell model)
  - `docs/architecture.md`
  - `docs/speaker/2026-11-25-browserstack-draft.md`
  - `docs/plans/QA-03-ui-scaffold.md`
  - `docs/progress/2026-10-31.md`
  - `README.md`
  - `AGENTS.md` (checklist delivery line only)
  - `docs/platforms/cursor/START_CURSOR.md` (same checklist line)
  - `docs/templates/task-completion-checklist.md`
  - `docs/sprint-plan.md` (probe schedule only; hours unchanged)
  - `docs/ai-native-sdlc-adaptation.md` (same QA-15 schedule note)
  - `docs/orchestrator-eval-probes.md` (QA-15 verification session; probes stay UNVERIFIED)
- Explicitly not change: API routes, SQLite, shared Zod contracts, fault modes, sprint-plan hours, skills, gate policy
- Approved exception, D-01 option B, PR comment https://github.com/dafl1605/trustworthy-qa-agent/pull/5#issuecomment-6549488511 (2026-10-31T21:40:35Z): the three checklist files above stay in this PR. Product scope and the 54h + 9h baseline stay unchanged. `docs/orchestrator-eval-probes.md` remains "Proposed checks, NOT executed". O-001 through O-007 are verified during QA-15 implementation, as recorded in that file and in `docs/sprint-plan.md`. This task does not run them.
- Accepted risk, D-02 option A, PR comment https://github.com/dafl1605/trustworthy-qa-agent/pull/5#issuecomment-6560806263 (2026-11-01T16:39:36Z): O-001 through O-007 stay UNVERIFIED until the QA-15 clean session. F-01 is closed as that accepted risk. This acceptance does not score the probes and does not change hours.
- Probe-schedule follow-up, PR comment https://github.com/dafl1605/trustworthy-qa-agent/pull/5#issuecomment-6552415277: the owner asked to record that calendar in `docs/orchestrator-eval-probes.md`, `docs/sprint-plan.md`, and `docs/progress/2026-10-31.md`. `docs/ai-native-sdlc-adaptation.md` carries the same note from that follow-up (commits `0b28c43` and `45d1685`). No hour change. D-01 option B does not by itself list these three files.

## Dependencies and design alternatives
- Prerequisites: QA-01 storefront scaffold and QA-02 API are on `main` at `06afb86d019299d903a069432d60131ecba9042d`. No open PR covers QA-03.
- Choice: local React state and four real buttons. Copy is a pure module so `node:test` can lock it without a browser runner.
- Rejected: implementing product cards, cart, and checkout now. That is QA-04.
- Rejected: adding React Router, a component library, or Playwright in this task. Playwright is QA-06.
- Rejected: a Vite proxy. Nothing in this shell calls the API.
- Rejected: inventing a speaker name or committing a headshot. This public repo must not gain a personal image, and a username is not a biography.

## Risk review
- What can break? The storefront production build and the contract typecheck, if the new `.ts` import is rejected.
- Risk to fault semantics / gate / permissions? None. The shell cannot select a scenario and cannot write an order.
- Required human approval? Sending the speaker draft, supplying a real name and role, and supplying a headshot outside the repo. D-01 option B, keeping the checklist instruction in this PR, was approved in PR comment 6549488511. Orchestrator probes O-001 through O-007 were not executed for that configuration edit. They stay UNVERIFIED and are verified during QA-15 implementation, after QA-05, QA-06, QA-07, QA-11, QA-12, and QA-14 are in the tree. D-02 option A, PR comment 6560806263, accepts leaving those probes UNVERIFIED until QA-15 and closes F-01 as an accepted risk. That comment does not score them.

## Tests before implementation
- Positive: four sections resolve as known, with their own headings, and `placesOrder` stays false.
- Negative: no section copy contains `Order confirmed` or a scenario toggle.
- Unknown: `resolveShellView('not-a-section')` is unknown and says no order was placed.

## Implementation steps
1. Add the shell model and render it with semantic landmarks, a skip link, and visible focus.
2. Lock the model with a contract test.
3. Draft the English speaker note as unsent material with explicit placeholders.
4. Run typecheck, build, test, and a browser pass of the four sections, including a narrow viewport and a keyboard activation.

## Verification commands
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Storefront dev server on `127.0.0.1:5173`, without requiring the API

## Exit criteria and independent review
- The page exposes Catalog, Cart, Checkout, and Confirmation, and none of them submit an order.
- Loading the shell with the API stopped still shows the scaffold and no order id.
- Keyboard activation moves the visible section and the status text.
- At about 320px width the navigation fits without a horizontal page scroll.
- Speaker draft is present, unsent, and does not claim measured model scores.
- Status stays IN_REVIEW until an independent reviewer reads the PR head SHA. Not DONE.

## Evidence and actual execution (filled after running)
- Commands run and result: recorded in `docs/progress/2026-10-31.md` under QA-03. `pnpm typecheck` and `pnpm test` exited 0 after the final focus change. `node:test` reported 34 passed and 0 failed.
- Artifact paths: local run screenshots and the browser recording are outside the repo, under `/opt/cursor/artifacts/`.
- Actual elapsed hours: unknown
- Status: IN_REVIEW. Not DONE. An independent reviewer still has to read the PR head SHA. D-01 option B is recorded above. D-02 option A is recorded above: F-01 is an accepted risk and the probes stay UNVERIFIED until QA-15. The probe file was not re-run. Verification of O-001 through O-007 is recorded for QA-15 implementation in `docs/orchestrator-eval-probes.md`, `docs/sprint-plan.md`, and `docs/progress/2026-10-31.md`.
