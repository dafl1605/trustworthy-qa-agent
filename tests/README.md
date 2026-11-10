# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/contract/` | Zod contracts, SQLite schema, checkout, harness, the evidence collector, the read-only tools, the bounded investigation loop, diagnosis claim checks, and the independent validator | QA-01, extended through QA-11 |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Labeled-case evaluation runner outputs | QA-13–QA-14 |
| `fixtures/golden-dataset/` | 12 labeled investigation cases | QA-13 |

`pnpm test` runs `tests/contract/*.test.ts` and `tests/e2e/*.test.ts` with `node:test`. It does not run Playwright. `pnpm test:e2e` runs the regression project. Eval cases are still QA-13 and QA-14.
