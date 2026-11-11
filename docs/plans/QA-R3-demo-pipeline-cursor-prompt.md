# QA-R3 — Demo pipeline: Cursor Cloud implementation prompt

**Status:** PROPOSED plan, requested by the user on 2026-11-11 after the independent demo-readiness review. Option B ("scripted agent, labeled `scripted-mock`") was chosen by the user. Merge and any scope decision stay with a human. This file is a plan and a prompt. It is not an implementation and not a release decision.

**Budget:** charged to the 9 h contingency (QA-R3, W3-D7). The 54 h + 9 h baseline is unchanged. Estimate: up to 3 h. Measured hours: unknown.

## Why

The merged repo demos UI vs. independent read vs. gate (`pnpm demo:rehearsal`, `modelInvoked: false`), but nothing runs collector → agent → parser → validator → gate in one path. The talk is "Who Tests the AI That Tests Your Software?", so the demo should show an agent (scripted, labeled) that can be wrong while the independent validator and the deterministic gate are not.

## READY-TO-PASTE CURSOR CLOUD PROMPT

```
Repository: dafl1605/trustworthy-qa-agent. Work on THIS PR's branch only (docs/plan PR "QA-R3 demo pipeline plan"). Do not open another PR, push to main, force-push, or merge. Task: QA-R3 (contingency), objective: add ONE local command `pnpm demo:pipeline` that shows the full chain for the three fault modes with a scripted agent.

Read first: AGENTS.md, CLAUDE.md, docs/intent.md, docs/spec.md, docs/architecture-contracts.md, docs/sprint-plan.md, docs/plan-template.md. Skills: .claude/skills/trustworthy-ai-engineering/SKILL.md (required); backend-typescript-engineering only for the data adapters; playwright-sdet-engineering only if you reuse the checkout driver in tests/e2e/demo-rehearsal.ts.

Before coding, write docs/plans/QA-R3-demo-pipeline.md using docs/plan-template.md (files, risks, verification commands, rollback) and stop for human review only if you need to change data semantics, the validator, the gate, fault modes or tool permissions. This plan must NOT change them.

Implement the smallest increment, reusing existing exports only (@tqa/evidence-collector, @tqa/qa-agent runInvestigation + createScriptedProvider + checkModelDiagnosis, @tqa/validators verifyOrder, @tqa/quality-gate decideRelease, tests/e2e/demo-rehearsal.ts for the checkout driver):
1. New script tests/e2e/demo-pipeline.ts and root package.json script `demo:pipeline` (same style as demo:rehearsal: `pnpm run build && node --experimental-strip-types ...`).
2. For each mode NORMAL, GHOST_SUCCESS, VERIFICATION_UNAVAILABLE (unique runId per run, idempotent reset, harness stays local-only/token-gated): drive the checkout, collect evidence, run the scripted investigation, parse the diagnosis with checkModelDiagnosis, call verifyOrder (the validator's own read-only path, never agent text), then decideRelease with policy tqa-gate-1.
3. Scripted diagnoses: NORMAL -> SUCCESS citing real evidence ids; GHOST_SUCCESS -> scripted SUCCESS (deliberately wrong, must stay BLOCK with DIAGNOSIS_IGNORED); VERIFICATION_UNAVAILABLE -> scripted "order missing" claim (must stay HOLD, 503 is not 404).
4. Print a table with: mode, orderId, screen text, scripted diagnosis, evidence-check result, lookup status, verification, gate, reason codes, and the labels `provider: scripted-mock`, `modelInvoked: false`, `measuredFromModel: false`. Exit 0 only when the three rows match the matrix (200 FOUND/CONFIRMED/ALLOW; 404 ABSENT/DEFECT/BLOCK; 503 service_unavailable/UNKNOWN/HOLD). Exit 0 is not ALLOW; say so in the output and README.
5. Add a node test under tests/contract/ (positive, negative, uncertainty paths) that runs the pipeline logic without a browser if possible, asserts the matrix, asserts a forged/unknown evidenceId is not trusted, and asserts the agent session has no write/shell capability. Do not skip or weaken any existing test. The intentionally failing ghost oracle stays an expected negative result.
6. Docs: README runbook line for `pnpm demo:pipeline`, docs/speaker/demo-script.md (add the pipeline step to the existing 720 s plan without changing the total), and fix the stale statement in docs/speaker/slides.md lines about "does not identify a backup recording" (name docs/speaker/rehearsal/backup-recording.webm) updating any test that pins that sentence. Update docs/architecture.md and docs/architecture-contracts.md only to describe the new orchestration script. Update docs/progress/2026-11-11.md (or today's date) from docs/templates/daily-report.md.

Constraints: TypeScript strict, Zod, pnpm, SQLite, Playwright. Single runtime agent. No MCP, Jev, dashboards, runtime multi-agent, advanced CI/CD, external APIs, real LLM calls, secrets or real payment/personal data. Never present the scripted diagnosis as a live model result. Do not quote any percent. O-001..O-007 stay UNVERIFIED. Do not mark anything DONE; status IN_REVIEW.

Run and report real results: pnpm install --frozen-lockfile; pnpm typecheck; pnpm build; pnpm test (counts); pnpm demo:pipeline (output + exit code); pnpm test:e2e and pnpm test:e2e:ghost-oracle if the browser is available (otherwise say NOT_VERIFIED). Fill docs/templates/task-completion-checklist.md leaving unmet boxes unchecked. Report files changed, commands run with outcomes, artifact paths, estimated vs measured hours (or unknown), risks, the new head SHA, and confirm the same PR was updated.
```

## Exit criteria

- `pnpm demo:pipeline` prints the three-mode table, labeled `scripted-mock`, and exits 0 only on the matrix.
- Typecheck, build and tests pass with real outputs recorded.
- Validator, gate, fault semantics and golden dataset unchanged.
- Independent re-review on the new head SHA before human merge.
