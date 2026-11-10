# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/contract/` | Zod contracts, SQLite schema, checkout, harness, the evidence collector, the read-only tools, the bounded investigation loop, diagnosis claim checks, the independent validator, the quality gate, and the golden-dataset labels | QA-01, extended through QA-13 |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Labeled-case evaluation runner outputs | QA-14 |
| `fixtures/golden-dataset/` | 12 human-authored labels with decision-matrix provenance | QA-13 |

`pnpm test` runs `tests/contract/*.test.ts` and `tests/e2e/*.test.ts` with `node:test`. It does not run Playwright. `pnpm test:e2e` runs the regression project. The eval runner is still QA-14. The golden dataset is labels only and is checked by `tests/contract/golden-dataset.test.ts`.
