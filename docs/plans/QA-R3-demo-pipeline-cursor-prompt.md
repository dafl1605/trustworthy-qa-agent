# QA-R3 — Demo pipeline: Cursor Cloud implementation prompt

**Status:** PROPOSED plan. Implementation is waiting for decision D-01. The user asked for this plan on 2026-11-11 and chose a scripted agent labeled `scripted-mock`. That choice selects the provider label. It does not approve a new command. Merge stays with a human. This file is a plan and a prompt. It is not an implementation and not a release decision.

**D-01, still pending:** `docs/sprint-plan.md` W3-D7 defines QA-R3 as tests, critical repairs, and no new features. `pnpm demo:pipeline` would be a new command, so the PR body's "Scope impact: None" does not cover it. A later human comment on PR #24, outside a generated review, has to use one of these sentences exactly before anyone runs the prompt below:

1. `Apruebo D-01 opción A: pnpm demo:pipeline es una excepción documentada a «no features nuevos» en QA-R3, cargada a las 9 h de contingencia, y la implementación queda en el PR #24.`
2. `Apruebo D-01 opción A: pnpm demo:pipeline es una excepción documentada a «no features nuevos» en QA-R3, cargada a las 9 h de contingencia, y la implementación va en un PR nuevo, no en el PR #24.`
3. `Apruebo D-01 opción B: no implementar pnpm demo:pipeline.`

Sentence 1 keeps the work on this PR. The same change then updates the PR title and body, which today say the PR is docs only. Sentence 2 keeps this PR as the plan. Sentence 3 stops the command. This file does not choose among them. A generated review is not that approval.

**Budget:** charged to the 9 h contingency (QA-R3, W3-D7) only after sentence 1 or 2. The 54 h + 9 h baseline is unchanged. Estimate: up to 3 h. Measured hours: unknown.

## Why

The merged repo demos UI vs. independent read vs. gate (`pnpm demo:rehearsal`, `modelInvoked: false`), but nothing runs collector → agent → parser → validator → gate in one path. The talk is "Who Tests the AI That Tests Your Software?", so the demo should show an agent (scripted, labeled) that can be wrong while the independent validator and the deterministic gate are not.

## READY-TO-PASTE CURSOR CLOUD PROMPT

```
Repository: dafl1605/trustworthy-qa-agent. Task: QA-R3 (contingency). Objective, after D-01 approval only: add ONE local command `pnpm demo:pipeline` that shows the full chain for the three fault modes with a scripted agent.

AUTHORIZATION: do not implement this prompt until a human comment on PR #24 records D-01 with one of the three exact sentences in the Status section of docs/plans/QA-R3-demo-pipeline-cursor-prompt.md. A generated review is not that approval. Until that sentence exists, do not add tests/e2e/demo-pipeline.ts, do not add the package.json script, and do not edit README, slides, the demo script, architecture, or tests for this task. Sentence 1 means stay on PR #24 (claude/magical-maxwell-ueysus), update the title and body so they no longer say the PR is docs only, and do not open another PR. Sentence 2 means open the implementation on a new branch and a new PR, and leave PR #24 as this plan. Sentence 3 means stop. Do not push to main, force-push, or merge.

Read first: AGENTS.md, CLAUDE.md, docs/intent.md, docs/spec.md, docs/architecture-contracts.md, docs/sprint-plan.md, docs/plan-template.md. Skills: .claude/skills/trustworthy-ai-engineering/SKILL.md (required); backend-typescript-engineering only for the data adapters; playwright-sdet-engineering only if you reuse the checkout driver in tests/e2e/demo-rehearsal.ts.

Before coding, write docs/plans/QA-R3-demo-pipeline.md using docs/plan-template.md (files, risks, verification commands, rollback) and stop for human review only if you need to change data semantics, the validator, the gate, fault modes or tool permissions. This plan must NOT change them.

Implement the smallest increment, reusing existing exports only (@tqa/evidence-collector, @tqa/qa-agent runInvestigation + createScriptedProvider + checkModelDiagnosis, @tqa/validators verifyOrder, @tqa/quality-gate decideRelease, tests/e2e/demo-rehearsal.ts for the checkout driver):
1. New script tests/e2e/demo-pipeline.ts and root package.json script `demo:pipeline` (same style as demo:rehearsal: `pnpm run build && node --experimental-strip-types ...`).
2. For each mode NORMAL, GHOST_SUCCESS, VERIFICATION_UNAVAILABLE (unique runId per run, idempotent reset, harness stays local-only/token-gated): drive the checkout, collect evidence, run the scripted investigation, parse the diagnosis with checkModelDiagnosis, call verifyOrder (the validator's own read-only path, never agent text), then decideRelease with policy tqa-gate-1.
3. Scripted diagnoses: NORMAL -> SUCCESS citing real evidence ids; GHOST_SUCCESS -> scripted SUCCESS (deliberately wrong, must stay BLOCK with DIAGNOSIS_IGNORED); VERIFICATION_UNAVAILABLE -> scripted "order missing" claim (must stay HOLD, 503 is not 404).
4. Print a table with: mode, orderId, screen text, scripted diagnosis, evidence-check result, lookup status, verification, gate, reason codes, and the labels `provider: scripted-mock`, `modelInvoked: false`, `measuredFromModel: false`. Exit 0 only when the three rows match the matrix (200 FOUND/CONFIRMED/ALLOW; 404 ABSENT/DEFECT/BLOCK; 503 service_unavailable/UNKNOWN/HOLD). Exit 0 is not ALLOW; say so in the output and README.
5. Add a node test under tests/contract/ (positive, negative, uncertainty paths) that runs the pipeline logic without a browser if possible, asserts the matrix, asserts a forged/unknown evidenceId is not trusted, and asserts the agent session has no write/shell capability. Do not skip or weaken any existing test. The intentionally failing ghost oracle stays an expected negative result.
6. Docs, in the same change as the command:
   - README runbook line for `pnpm demo:pipeline`.
   - Timing. At reviewed head 20bad916 the 720 s plan is five segments in docs/speaker/demo-script.md, tests/e2e/demo-rehearsal.ts (PLANNED_SPEECH_SEGMENTS), and docs/speaker/rehearsal/rehearsal.json: open 60 s from 0, normal 180 s from 60, ghost 240 s from 240, unavailable 180 s from 480, close 60 s from 660. tests/contract/demo-rehearsal.test.ts requires those ids, a sum of 720, and twelveMinuteBudgetMs of 720000. tests/contract/talk-notes.test.ts requires the outline demo segment to stay 720 s inside 2100 s. Add the pipeline step by shortening the existing ghost segment. A human D-01 comment may name another of those five segments; otherwise use ghost. Do not add a sixth segment. Do not change the 720 s total or the 2100 s outline. Those assertions stay green. Do not weaken or delete them.
   - Slides. At that same head the exact sentence "This deck does not identify a backup recording." is on docs/speaker/slides.md lines 7 and 178. Re-find that sentence if the lines moved. Line 186 is a different sentence ("S-008 still needs a timed rehearsal and an identified backup recording.") and is not this claim. The file docs/speaker/rehearsal/backup-recording.webm already exists. Update both occurrences so the deck names that file. Update every check that pins the old sentence, and keep a failing check if the deck denies the file or claims S-008 is complete: tests/contract/speaker-slides.test.ts (the recording-claim include and the replaceAll negative case), tests/contract/demo-rehearsal.test.ts (the include on the slides file), and tests/contract/talk-notes.test.ts (the include on the slides file, plus the required prose in docs/speaker/talk-notes.md and README.md). Also update docs/speaker/deliverables.md and docs/speaker/rehearsal/README.md where they still say the deck does not identify the recording. Do not delete those assertions.
   - Update docs/architecture.md and docs/architecture-contracts.md only to describe the new orchestration script.
   - Update docs/progress/2026-11-11.md (or the file for the implementation date) from docs/templates/daily-report.md. Status stays IN_REVIEW.

Constraints: TypeScript strict, Zod, pnpm, SQLite, Playwright. Single runtime agent. No MCP, Jev, dashboards, runtime multi-agent, advanced CI/CD, external APIs, real LLM calls, secrets or real payment/personal data. Never present the scripted diagnosis as a live model result. Do not quote any percent. O-001..O-007 stay UNVERIFIED. Do not mark anything DONE; status IN_REVIEW.

Run and report real results: pnpm install --frozen-lockfile; pnpm typecheck; pnpm build; pnpm test (counts); pnpm demo:pipeline (output + exit code); pnpm test:e2e and pnpm test:e2e:ghost-oracle if the browser is available (otherwise say NOT_VERIFIED). Fill the task-completion checklist in the progress note, leaving unmet boxes unchecked. Do not overwrite docs/templates/task-completion-checklist.md. Report files changed, commands run with outcomes, artifact paths, estimated vs measured hours (or unknown), risks, the new head SHA, and which PR received the commits.
```

## Exit criteria

- D-01 is recorded with one of the three sentences above before any of the following is treated as done.
- `pnpm demo:pipeline` prints the three-mode table, labeled `scripted-mock`, and exits 0 only on the matrix.
- Typecheck, build and tests pass with real outputs recorded.
- Validator, gate, fault semantics and golden dataset unchanged.
- Independent re-review on the new head SHA before human merge.

## Review record — head 20bad916

Independent review comment `6806296555` on PR #24. This section records the triage. It is not D-01 approval.

| ID | Classification | Severity | Disposition |
|---|---|---|---|
| F-01 / D-01 | VALID. The sprint line and the new command conflict, and the PR says scope impact none. | P1 | Waiting for one of the three human sentences. The command stays unimplemented. |
| F-02 | VALID. The old prompt told an implementer to put code on this docs-only PR. | P2 | The prompt above now follows the D-01 sentence: PR #24 or a new PR. Title and body change only with sentence 1. |
| F-03 | PARTIALLY_VALID. The slide sentence was unnamed. Line 186 is a different sentence. The pin is in three test files, not one. | P2 | Step 6 now names lines 7 and 178 and the three tests. Slides stay unchanged in this commit. |
| F-04 | VALID. The 720 s total had no source segment. The five durations sum to 720 and the tests pin that sum. | P2 | Step 6 shortens the ghost segment unless the human sentence names another segment. The script stays unchanged in this commit. |
| F-05 | VALID as a checklist gap for SHA 20bad916. Checking the box on a later SHA would claim a review that has not happened. | P3 | The PR checklist stays unchecked until a review of the post-fix head exists. |
