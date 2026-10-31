# Trustworthy-qa-agent
Trustworthy AI-powered QA agent for test failure investigation, evidence validation, LLM evaluation, and automated quality gates.

# Trustworthy AI QA Agent — Cloud Development Starter Kit

A reference repository operating kit for the BrowserStack talk **Who Tests the AI That Tests Your Software?**.

The package provides: AI-Native SDLC intent/spec, repository guardrails, four domain skills, Cursor Cloud implementation instructions, Claude Code Web independent-review instructions, protected-main GitHub ruleset guide, and daily task templates.

After **QA-01**, the repo includes a pnpm monorepo scaffold (`apps/storefront`, `apps/api`, `packages/shared`) without checkout, fault injection, or agent behavior yet.

## Requirements

- Node.js `>=22.13.0` (verified on `22.23.4`)
- pnpm `10.33.4` (`packageManager` in `package.json`)
- `runId` and `orderId` are UUIDs (Zod `z.uuid()` at shared contract boundaries)

## Local commands (after QA-01)

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test
pnpm db:migrate
pnpm --filter @tqa/api start   # GET /health on 127.0.0.1:3001
```

See [`docs/architecture.md`](docs/architecture.md) for layout and ADRs.

- Cursor: [`docs/platforms/cursor/START_CURSOR.md`](docs/platforms/cursor/START_CURSOR.md)
- Claude: [`docs/platforms/claude/START_CLAUDE.md`](docs/platforms/claude/START_CLAUDE.md)
- Shared constraints: [`AGENTS.md`](AGENTS.md), [`docs/intent.md`](docs/intent.md), [`docs/spec.md`](docs/spec.md)
- Development plan: [`docs/sprint-plan.md`](docs/sprint-plan.md)
