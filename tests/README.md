# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/contract/` | Zod contracts, SQLite schema, checkout, harness, the evidence collector, the read-only tools, the bounded investigation loop, diagnosis claim checks, the independent validator, the quality gate, and the golden-dataset labels | QA-01, extended through QA-13 |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Eval runner that scores supplied observations against the twelve golden labels | QA-14 |
| `fixtures/golden-dataset/` | 12 human-authored labels with decision-matrix provenance | QA-13 |
| `fixtures/regression-baseline/` | Measured five-run regression freeze. Not a release decision | QA-15 |

`pnpm test` runs `tests/contract/*.test.ts`, `tests/e2e/*.test.ts`, and `tests/evals/*.test.ts` with `node:test`. It does not run Playwright. `pnpm test:e2e` runs the regression project. The golden dataset is labels only and is checked by `tests/contract/golden-dataset.test.ts`. `tests/evals/runner.ts` scores observations against those labels. A scripted score is not a live model result. `tests/e2e/regression-baseline.ts` checks the shape of an already measured Playwright report. It does not start a browser, and it does not score O-001 through O-007.
