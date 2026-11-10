# Implementation plan — QA-10

Task ID: QA-10  
Spec IDs: S-004. S-002 and S-003 stay distinct in claim checks: a 404 citation can support `ORDER_NOT_PERSISTED`, and a 503 or timeout citation stays `UNKNOWN` rather than a missing order. No gate decision is produced.  
Status: ACCEPTED for implementation. QA-01 through QA-09 are merged on `main` at `2dab1baf2cd70715663d3b801ce329c87e549ca2`. No open PR covers QA-10. This plan does not change fault semantics, validator ownership, gate policy, or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Task pack

- `taskId`: QA-10
- `ownerRole`: Agent (skill `trustworthy-ai-engineering`)
- `objective`: parse one model diagnosis with the existing Zod contract, mark claims against the evidence index, and abstain when the citation is empty, unknown, or not a lookup fact
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: `@tqa/qa-agent` diagnosis check, contract tests, architecture and README notes
- `dependencies`: `origin/main` at `2dab1baf2cd70715663d3b801ce329c87e549ca2` (QA-09 merged as PR #14)
- `allowedFiles`: `packages/qa-agent/**`, `tests/contract/qa-agent-diagnosis.test.ts`, `tests/contract/qa-agent-tools.test.ts`, `README.md`, `tests/README.md`, `docs/architecture.md`, `docs/plans/QA-10-diagnosis.md`, `docs/progress/2026-11-09.md`
- `skillToLoad`: `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- `acceptanceCriteria`: a Zod-valid diagnosis is parsed; empty `evidenceIds` are `UNVERIFIED`; unknown ids are `UNKNOWN` and are not treated as absence; a 503 or timeout citation does not become `ORDER_NOT_PERSISTED`; a UI-only success claim is unverified; a cited 200 `FOUND` can keep `SUCCESS` and a cited 404 `ABSENT` can keep `ORDER_NOT_PERSISTED`; `releaseAuthorized` stays false and `gateDecision` stays null
- `verificationCommands`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`, `pnpm test`
- `evidenceArtifacts`: command results in `docs/progress/2026-11-09.md`
- `risks`: treating a cited label as a gate decision, treating a row count or a log line as the authoritative read, or describing this parser as a live model result
- `outOfScope`: `packages/validators`, `packages/quality-gate`, evals, orchestrator probes, fault-mode changes, wiring the checker into `runInvestigation` or Playwright

## Objective and why

`docs/intent.md` says a persuasive diagnosis can be unsupported. QA-09 stores the model note as untrusted text and does not parse it. QA-10 is the parser and the evidence-id check. The independent validator remains QA-11.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/trustworthy-ai-engineering/SKILL.md`
- Change: the files in the task pack
- Explicitly not change: `packages/shared` contracts, the investigation report schema, fault harness behavior, storefront, Playwright specs, gate policy, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: QA-09 is merged. `AgentDiagnosisSchema` and `EvidenceCollector.citation` already exist
- `checkModelDiagnosis` is a separate function. `runInvestigation` still returns `orderClassified: false` and `gateDecision: null`
- A claim is `CITED` only when every cited record belongs to the same `runId` and the lookup kinds agree with the model's label: `order-lookup-found` with `SUCCESS`, or `order-lookup-absent` with `ORDER_NOT_PERSISTED`
- Rejected: upgrading `INCONCLUSIVE` to `SUCCESS` because a found record exists. Disagreement abstains
- Rejected: treating `orders-row-count`, a UI confirmation, a checkout response, or a log line as that lookup fact
- Rejected: a second model that judges the claim text. Support uses the record `kind`, not the summary sentence
- Rejected: emitting `ALLOW`, `BLOCK`, or `HOLD`

## Risk review

- `checkedDiagnosis` is the model's label when the citation matches. It is not a release decision
- Unknown ids and unavailable lookups abstain with `INCONCLUSIVE`. They are not rewritten to `ORDER_NOT_PERSISTED`
- Required human approval: merge. No change to fault meanings

## Tests before implementation

- Positive: `SUCCESS` cites `order-lookup-found`; `ORDER_NOT_PERSISTED` cites a UI record plus `order-lookup-absent`
- Negative: UI-only success, empty ids, a fabricated id, a log instruction, a caller row count, and a `SUCCESS` label on a 404 record
- Unavailable: 503 `service_unavailable` and 503 `timeout` stay `UNKNOWN`; a summary that says 404 does not override kind `order-lookup-unavailable`

## Implementation steps

1. Add `checkModelDiagnosis` and `CheckedDiagnosisSchema`
2. Compare claims with `EvidenceCollector.citation` using lookup kinds only
3. Lock the behavior in `tests/contract/qa-agent-diagnosis.test.ts`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

## Exit criteria and independent review

- The checker does not decide a gate and does not read SQLite
- The investigation loop still does not parse a diagnosis
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution

- `pnpm install --frozen-lockfile` exited 0. The lockfile did not change. Log: `/opt/cursor/artifacts/qa10-frozen-install.log`.
- `pnpm typecheck` exited 0. Log: `/opt/cursor/artifacts/qa10-typecheck.log`.
- `pnpm build` exited 0. Vite wrote `dist/assets/index--P-9X6xF.js` at 234.64 kB and `dist/assets/index-CzBEO2Fm.css` at 2.70 kB, built in 139 ms. Log: `/opt/cursor/artifacts/qa10-build.log`.
- `pnpm test` exited 0. Node reported `tests 127`, `pass 127`, `fail 0`, `duration_ms 2146.51897`. The new diagnosis file contributed 17 of those tests. Log: `/opt/cursor/artifacts/qa10-test.log`.
- Playwright browser projects were not re-run. This task does not change `tests/e2e` specs, the storefront, or the API. `pnpm test` still ran the node tests under `tests/e2e/*.test.ts`.
- Measured hours: unknown. The 3 h figure is the planned slot.
- Status: IN_REVIEW after the pull request. Not DONE.
