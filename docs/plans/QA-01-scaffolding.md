# Implementation plan — QA-01 scaffolding

Task ID: QA-01  
Spec IDs: none exercised yet (S-001..S-008 belong to later tasks)  
Status: ACCEPTED for scaffolding only. The user task named this scope. Evidence is recorded after commands run, in `docs/progress/2026-10-30.md`.

## Task pack

- `taskId`: QA-01
- `ownerRole`: Architect / backend TypeScript (skill `backend-typescript-engineering`)
- `objective`: pnpm workspace, strict TypeScript, storefront and API scaffolds, shared Zod contracts, test directories, initial SQLite schema, build and typecheck scripts
- `estimatedHours`: 3 (planned slot, not a measured duration)
- `scope`: repository skeleton and domain contracts. No checkout, catalog, fault injection, agent, validator, or gate behavior
- `dependencies`: repository operating docs on `main` (`913cc86`). No previous sprint task exists
- `allowedFiles`: workspace manifests, `tsconfig*`, `apps/storefront/**`, `apps/api/**`, `packages/shared/**`, `tests/**`, `fixtures/golden-dataset/**`, `docs/architecture.md`, `docs/adr/**`, `docs/plans/QA-01-scaffolding.md`, `docs/progress/2026-10-30.md`
- `skillToLoad`: `.claude/skills/backend-typescript-engineering/SKILL.md`
- `acceptanceCriteria`: `pnpm typecheck`, `pnpm build`, and contract tests pass; `GET /health` only; schema creates `orders` and `order_items`; existing config files stay untouched
- `verificationCommands`: `pnpm install`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:migrate` against a temp file, loopback `GET /health`, storefront dev render
- `evidenceArtifacts`: command logs and `docs/progress/2026-10-30.md`
- `risks`: native SQLite install; treating scaffold routes as business behavior
- `outOfScope`: QA-02 routes, QA-03+ UI flows, Playwright, evals, LLM, gate policy

## Objective and why

`docs/intent.md` needs a reproducible TypeScript checkout later. This task only creates the workspace those later tasks extend. A passing UI test still does not prove persistence; this scaffold must not pretend that it does.

## Scope and files

- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, backend skill
- Change: new workspace, apps, shared contracts, schema, architecture note, ADR, this plan, daily progress
- Explicitly not change: `AGENTS.md`, `.gitignore`, `.env.example`, skills, GitHub rules, sprint baseline hours

## Dependencies and design alternatives

- Prerequisites: Node.js 22.23.4 and pnpm 10.33.4 on the cloud VM
- HTTP: Node.js `node:http`. Express, Fastify, and Hono add a dependency the route count does not need
- SQLite: `better-sqlite3` 13.0.3. `node:sqlite` runs here but prints `ExperimentalWarning` on Node 22.23.4, so it is not the stable adapter `docs/intent.md` asks QA-01 to choose
- Validation: Zod 4, because the approved stack requires runtime schemas
- Test runner: `node:test` plus Node type stripping. Vitest is deferred
- Env files: no `dotenv`. The process environment is the source; `.env.example` stays documentation
- Branch: `feature/QA-01-scaffolding`, as this task requested. `docs/platforms/cursor/START_CURSOR.md` mentions `feature/QA-01-bootstrap`; the explicit task instruction wins

## Risk review

- Scaffold routes must not include checkout or order lookup. Those semantics belong to QA-02 and QA-05
- Fault injection is not mounted. The harness decision is recorded for QA-05 and is not a public route
- No change to NORMAL / GHOST_SUCCESS / VERIFICATION_UNAVAILABLE behavior, because that behavior does not exist yet
- Human approval is not required for this scaffold. It is required before changing those fault semantics later

## Tests before implementation

- Positive: shared schemas accept one valid evidence record, diagnosis, and gate decision; schema migration creates both tables and keeps a row on a second apply; `GET /health` returns the shared health schema
- Negative: invalid enums, empty claim evidence, negative money, foreign-key violations, and `/api/checkout` are rejected
- Unknown: `VERIFICATION_UNAVAILABLE` is not implemented. The contract test only locks the word `UNKNOWN` as distinct from `DEFECT` and rejects a fake status such as `MISSING`

## Implementation steps

1. Add the pnpm workspace and strict base TypeScript config
2. Add `@tqa/shared` Zod contracts from `docs/architecture-contracts.md`
3. Add `@tqa/api` loopback server with `GET /health` and the SQLite schema applicator
4. Add `@tqa/storefront` Vite + React placeholder with no catalog or checkout
5. Add `tests/contract`, plus empty `tests/e2e`, `tests/evals`, and `fixtures/golden-dataset`
6. Record the HTTP, SQLite, logging, and harness decisions in an ADR and `docs/architecture.md`
7. Run the verification commands and write the daily progress file from actual output

## Verification commands

- `pnpm install`: workspace links and `better-sqlite3` install script
- `pnpm typecheck`: shared, api, storefront, and contract tests
- `pnpm build`: library `tsc` output and Vite production bundle
- `pnpm test`: contract tests
- `pnpm db:migrate` with `DATABASE_PATH` outside the repo
- `GET /health` on 127.0.0.1 and a browser load of the storefront placeholder

## Exit criteria and independent review

- Scaffold matches the QA-01 list in the user task and the sprint output (`pnpm build`, initial `docs/architecture.md`)
- Status after the PR is `IN_REVIEW`, not `DONE`. Claude's independent review of the PR head SHA is still required. This agent does not merge

## Calendar note

Historical sprint text places QA-01 on 2026-10-28. The repository had no application on 2026-10-30, so this is the actual start. The 54h + 9h baseline is unchanged. Later tasks keep their order and budgets; dates slide forward in each day's progress note instead of rewriting history as if 28 Oct work had happened.

## Evidence and actual execution (filled after running)

- Commands run and result: recorded in `docs/progress/2026-10-30.md`. Latest re-check: `pnpm typecheck`, `pnpm build`, `pnpm test` (11 passed, 0 failed), and `pnpm db:migrate` exited 0.
- Artifact paths: `docs/progress/2026-10-30.md`
- Actual elapsed hours: about 15 minutes of wall clock (17:39–17:54 America/Mexico_City). This is not a claim that the 3h planning slot was saved.
- Status: IN_REVIEW. Acceptance commands passed. Independent review of the PR head SHA has not happened, so this task is not DONE.
