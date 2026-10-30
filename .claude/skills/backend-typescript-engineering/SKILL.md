---
name: backend-typescript-engineering
description: Build or review Node.js + TypeScript API, SQLite persistence, Zod contracts, checkout business logic, local fault injection, order verification read adapters and test isolation. Use for QA-01, QA-02, QA-05, apps/api and shared DB contracts; not for React styling or agent prompts.
---
# Backend TypeScript Engineering

## Purpose
Small auditable checkout backend with **real SQLite persistence** and deterministic fault injection. Read `AGENTS.md` and `docs/architecture-contracts.md` first. Keep server stateless except persistence and explicitly scoped test harness state.

## AI-native SDLC validation loop
- Derive route contracts, DB effects and failure semantics from `docs/spec.md`. Present a small implementation plan and identify changes to invariants before editing.
- Cover `200 persisted`, `404 absent`, and `503 unavailable` with executable contract/integration checks. An unavailable authoritative lookup is UNKNOWN, never a confirmed missing order.
- Use a feedback loop of test -> failure review -> correction -> rerun, and obtain separate review of fault-injection and validator-access boundaries.

## Implementation workflow
1. Inspect existing routes, database and shared Zod contracts; implement minimal HTTP framework and local SQLite migrations.
2. Products are fixtures; calculate `totalCents` on server using `sku`, quantity and trusted catalog prices. Reject invalid quantities, missing SKUs and malformed `runId`.
3. `POST /api/checkout` generates `orderId`, returns confirmation. In NORMAL persist `orders` and `order_items` atomically; in GHOST_SUCCESS return confirmation but do **not** persist. Log a private test-harness fault event.
4. `GET /api/orders/:orderId` distinguishes 200 valid, 404 truly absent and 503 source unavailable; errors are typed. `VERIFICATION_UNAVAILABLE` must block ALL authoritative read-side checks for that run, including validator adapter, so HOLD is genuine.
5. Provide read-only **independent** verifier adapter with its own query, not simply replaying the LLM's tool results.
6. Scenario selection and reset are available only to local tests/CLI, bound to loopback and protected; no public UI fault toggle. Reset is idempotent and runs isolated by `runId`.
7. Use parameterized SQL, controlled file paths, structured timestamped logs and redaction. Never log secrets or real payment details.
8. Add unit/integration tests for modes, 404 vs 503, persistence and repeated resets.

## Acceptance checklist
- NORMAL: persisted order and expected total with reproducible ID correlation.
- GHOST_SUCCESS: UI-compatible response but zero matching persisted rows; NOT silently swallowed as an ordinary successful business result.
- VERIFICATION_UNAVAILABLE: authoritative reads unavailable -> UNKNOWN, never inferred missing/404.
- `pnpm build`, typecheck and relevant integration tests were genuinely executed or explicitly recorded as unavailable.

## Sources on demand
- https://nodejs.org/en/learn
- https://www.typescriptlang.org/docs/handbook/intro.html
- https://zod.dev/
- https://www.sqlite.org/lang.html
