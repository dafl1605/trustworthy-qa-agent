# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/contract/` | Zod contracts, SQLite schema, and `GET /health` | QA-01 |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Labeled-case evaluation runner outputs | QA-13–QA-14 |
| `fixtures/golden-dataset/` | 12 labeled investigation cases | QA-13 |

`pnpm test` runs `tests/contract` with `node:test`. Playwright and evals are not wired yet.
