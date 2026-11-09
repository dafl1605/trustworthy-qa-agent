# Implementation plan — QA-06

Task ID: QA-06  
Spec IDs: S-001 UI plus authoritative read, S-002 limited UI PASS with an independent absence, S-003 503 stays UNKNOWN, S-007 five isolated runs. Gate decisions stay out of scope.  
Status: ACCEPTED for implementation. The scenario meanings stay the ones already fixed in `docs/spec.md` and `docs/architecture-contracts.md`. This task does not change fault semantics, the 54 h + 9 h baseline, or gate policy. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Objective and why

`docs/intent.md` asks for a checkout where Playwright can pass while persistence fails. QA-04 shows the confirmation. QA-05 can withhold the row or block the read. QA-06 puts a browser on that screen and keeps a separate order lookup.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/playwright-sdet-engineering/SKILL.md`
- Change: `tests/e2e/**`, root `package.json`, `pnpm-lock.yaml`, `apps/storefront/vite.config.ts` (proxy target only), `README.md`, `docs/architecture.md`, `.env.example`, this plan, `docs/progress/2026-11-09.md`
- Explicitly not change: fault behavior, storefront scenario controls, `packages/validators`, `packages/quality-gate`, `packages/evidence-collector`, orchestrator probes, the 54 h + 9 h budget

## Dependencies and design alternatives

- Prerequisite: `origin/main` at `98136544345fb19ef18f0e46f32240901d6ec123` (QA-05 merged). No open PR covers QA-06
- The browser uses role and label locators. The oracle is `GET /api/orders/:orderId` through Playwright's API client, not the confirmation JSON and not an LLM
- Rejected: expecting 404 inside the ghost test so Playwright stays green. That would hide the failed oracle
- Rejected: putting the ghost failure into `pnpm test` or `pnpm test:e2e`. Those commands stay green. The expected negative has its own command
- Rejected: a storefront scenario switch. The harness stays on loopback and the page still cannot choose the fault
- `TQA_API_ORIGIN` only changes the Vite dev/preview proxy. The client bundle does not read it

## Risk review

- A green `pnpm test:e2e` includes a ghost UI pass. The README states that this is limited coverage
- `demo:false-pass` exits 0 when the defect is reproduced. That exit code is not `ALLOW`
- The harness token is generated per run, written only to `test-results/e2e-runtime.json`, and is not committed
- Timeout is still not simulated. 503 `service_unavailable` is the unavailable case
- Required human approval: merge. No change to fault meanings or permissions

## Tests before implementation

- Positive: `NORMAL` confirmation, then 200 `FOUND` with the mug total 1299
- Negative: the same confirmation on `GHOST_SUCCESS`, then the persistence assertion fails on 404 `ABSENT`
- Unavailable: confirmation plus 503 `UNAVAILABLE`, asserted not to be 404

## Implementation steps

1. Add Playwright, a loopback API, and a preview server pointed at that API
2. Add the limited UI tests, the NORMAL oracle, the unavailable oracle, and five isolated NORMAL runs
3. Add the ghost oracle as an expected negative and a demo command that reports the real failure

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm demo:false-pass` (expected: Playwright oracle non-zero, demo process 0 only if five 404s were recorded)

## Exit criteria and independent review

- The limited UI passes for `GHOST_SUCCESS` without calling the order lookup
- The ghost oracle's failing assertion is still the 200 persistence check
- 503 is recorded as `UNKNOWN` and is not turned into a defect
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution (filled after running)

- Commands and results are in `docs/progress/2026-11-09.md` under QA-06
- `pnpm typecheck`, `pnpm test` (52 passed), and `pnpm test:e2e` (6 passed) exited 0 on the final tree
- `pnpm demo:false-pass` exited 0 after the oracle Playwright process exited 1 on five 404 `ABSENT` lookups
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR is open. Not DONE
