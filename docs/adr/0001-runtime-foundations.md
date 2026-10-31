# ADR 0001 — Runtime foundations for QA-01

- Status: Conditionally accepted for QA-01 (human architecture decision, 2026-10-30)
- Date: 2026-10-30
- Task: QA-01
- Reviewed SHA that prompted this record: `fdf01cd`

## Context

`docs/intent.md` leaves three technical points for QA-01: the HTTP framework, the SQLite adapter, and the local test-harness safety mechanism. The MVP also needs stable CLI names and a diagnostics sink. The approved stack is TypeScript, React + Vite, Node.js, SQLite, and Zod. Business routes are QA-02. Fault behavior is QA-05.

This ADR records the QA-01 choices and the later human conditional approval. It does not claim that the future harness, token comparison, or any other security control has been implemented or verified.

## Tooling versions

- Node.js `>=22.13.0` (`package.json` `engines.node`). This cloud VM ran Node `22.23.4`.
- pnpm `10.33.4` (`package.json` `packageManager`).
- `runId` and `orderId` are UUID strings. Zod `z.uuid()` enforces that at shared contract boundaries. SQLite does not add a UUID CHECK.

## Decisions

1. **HTTP is Node.js `node:http`.** The API scaffold exposes `GET /health` and a JSON 404 for every other path. Express, Fastify, and Hono stay out until a route volume justifies the dependency.
2. **SQLite adapter is `better-sqlite3` 13.0.3.** It is synchronous, widely used, and publishes prebuilds. On this VM, Node 22.23.4 `node:sqlite` works but logs `ExperimentalWarning: SQLite is an experimental feature`. That fails the "minimal stable" choice requested in `docs/intent.md`.
3. **The server listens on `127.0.0.1` only.** `PORT` defaults to `3001` (see `.env.example`). A public bind is out of scope.
4. **Test harness remains a design only in QA-01.** Fault injection is not implemented here. When QA-05 adds the harness it must:
   - stay disabled by default
   - register only if `TQA_HARNESS=1` and `TQA_HARNESS_TOKEN` is a non-empty process secret
   - require header `x-tqa-harness-token` to match that secret with a timing-safe comparison
   - never write the token, or any other secret, to logs
   - stay off `/api/*` and off the storefront
   - reset idempotently by `runId`
   - stay unmounted (404) when either control is missing
5. **Diagnostics are one JSON object per line on stdout.** Keys matching secret, token, password, authorization, or API key are replaced with `[redacted]`. There is no file sink and no external telemetry. Redaction of field names is not a completed security review.
6. **No `dotenv` dependency.** Callers export variables themselves. `.env.example` remains placeholders only.
7. **Contract tests use `node:test`.** TypeScript tests run with `--experimental-strip-types`. Playwright is QA-06.

## Conditional approval (2026-10-30)

A human reviewed independent findings on PR #2 and approved this architecture for QA-01:

- `node:http`
- `better-sqlite3`
- localhost-only default bind
- JSON diagnostic logging
- `node:test`
- local-only protected test-harness design, disabled by default

The same decision forbids implementing fault injection in QA-01 and forbids claiming that token comparison, harness isolation, or other security controls were verified. Those remain QA-05 implementation and review work.

Passing typecheck, build, or contract tests does not auto-approve merge and does not authorize a quality-gate `ALLOW`. A human decides merge. An LLM claim never independently authorizes `ALLOW`.

## Schema consequences

`orders` and `order_items` store persisted checkout rows only. A missing row is the future 404 case. `VERIFICATION_UNAVAILABLE` is not a stored status: an unavailable authority must not look like a saved order. Money is integer cents. MVP currency is `USD`. UUID shape for `runId` and `orderId` is enforced by Zod at the boundary, not by a SQLite check.

## Consequences

QA-02 implements products, checkout, and order lookup on this server and schema. QA-05 implements the harness rules above without turning them into an open REST toggle. Replacing `better-sqlite3` with `node:sqlite` needs a new ADR once Node marks that module stable.
