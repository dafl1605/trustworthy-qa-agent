# Implementation plan — QA-05

Task ID: QA-05  
Spec IDs: S-001 persistence and readback, S-002 ghost confirmation with an independent absence, S-003 unavailable read that stays distinct from absence.  
Status: ACCEPTED for implementation. The scenario meanings were already fixed by `docs/spec.md`, `docs/architecture-contracts.md`, and ADR 0001. This task does not change the decision matrix or the 54 h + 9 h baseline. Merge still requires a human. Status after the PR is `IN_REVIEW`, not `DONE`.

## Objective and why

`docs/intent.md` needs a checkout whose screen can say the order succeeded while the business row is missing, and a separate case where the authoritative read cannot answer. QA-02 persisted every successful checkout. QA-04 can already show that confirmation. QA-05 adds the three modes, an isolated reset, and an order read that does not trust the confirmation JSON.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `docs/adr/0001-runtime-foundations.md`, `.claude/skills/backend-typescript-engineering/SKILL.md`
- Change: `apps/api/src/app.ts`, `apps/api/src/main.ts`, `apps/api/src/index.ts`, `apps/api/src/harness/**`, `apps/api/src/orders/verify-order.ts`, `apps/api/package.json`, `tests/contract/harness.test.ts`, `tests/contract/api-exports.test.ts`, `docs/architecture.md`, `README.md`, `.env.example`, this plan, `docs/progress/2026-11-09.md`
- Explicitly not change: `AGENTS.md`, sprint-plan hours, skills, storefront UI, `schema.sql` order tables, `packages/validators`, `packages/quality-gate`, Playwright, gate policy

## Dependencies and design alternatives

- Prerequisite: `origin/main` at `28028160db45e6b5f66d14c2d05eb488e9de945c` (QA-04 merged). No open PR and no other feature branch
- HTTP stays on `node:http`. No new dependency
- Rejected: a public `?scenario=` switch. QA-02 tests still require that query to persist when the run was not armed
- Rejected: a storefront toggle. The UI must be able to show a ghost confirmation without choosing the fault
- Rejected: storing the scenario on `orders`. ADR 0001 says `VERIFICATION_UNAVAILABLE` is not an order status
- Rejected: creating `packages/validators` or returning `ALLOW` / `BLOCK` / `HOLD`. Those are QA-11 and QA-12. This task's adapter returns `CONFIRMED`, `DEFECT`, or `UNKNOWN` from its own `SELECT`
- Harness metadata (`harness_runs`, `harness_checkouts`) is created only when the harness is mounted. A ghost writes `persisted = 0` there and writes nothing to `orders` or `order_items`

## Risk review

- A ghost response uses the same confirmation shape as a saved order. The log event is `harness.fault`, not `api.checkout_persisted`
- An unavailable read is 503 `service_unavailable` and adapter `UNKNOWN`. It is not 404 and not `DEFECT`. A different unknown id stays 404
- The mode does not simulate a timeout. `timeout` remains a lookup reason for a later real timeout. Both are `UNKNOWN`
- Disabling the token unmounts the control routes. It does not delete scenario rows. A run left in `VERIFICATION_UNAVAILABLE` still fails authoritative reads until reset. New ghosts are armed only while the harness is mounted
- Required human approval: merge. No change to fault meanings, gate policy, or permissions

## Tests before implementation

- Positive: `NORMAL` persists the server total, `GET` is `FOUND`, and `verifyPersistedOrder` is `CONFIRMED`
- Negative: `GHOST_SUCCESS` returns `Order confirmed`, zero `orders` and `order_items` rows, `GET` 404 `ABSENT`, adapter `DEFECT`. Public query and JSON `scenario` do not arm the fault. Wrong, missing, and query-string tokens do not change the run and are not logged
- Unavailable: `VERIFICATION_UNAVAILABLE` still commits the row, `GET` is 503, the adapter is `UNKNOWN` without the price or SKU, and an unrelated id stays 404. Reset is idempotent and does not delete another run

## Implementation steps

1. Mount `/harness/*` only with `TQA_HARNESS=1` and a non-empty token. Require loopback and a timing-safe header compare
2. Arm one scenario per `runId`. Default `NORMAL`
3. Ghost skips `store.persist`. Unavailable persists, then blocks authoritative reads for that run
4. Reset deletes only that run's business rows and harness metadata
5. Add `verifyPersistedOrder` with its own `SELECT`

## Verification commands

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- Loopback curl for the three modes on a temp database

## Exit criteria and independent review

- The three modes match the table in `docs/architecture.md`
- The storefront has no new scenario control
- An LLM claim is not an `ALLOW`
- Status after the PR is `IN_REVIEW`, not `DONE`

## Evidence and actual execution (filled after running)

- Commands and results are in `docs/progress/2026-11-09.md`
- Actual elapsed hours: unknown
- Status: IN_REVIEW once the PR is open. Not DONE
