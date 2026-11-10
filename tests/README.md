# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/contract/` | Zod contracts, SQLite schema, checkout, harness, the evidence collector, the read-only tools, the bounded investigation loop, diagnosis claim checks, the independent validator, the quality gate, the golden-dataset labels, and the speaker-slide citations | QA-01, extended through QA-16 |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Eval runner that scores supplied observations against the twelve golden labels | QA-14 |
| `fixtures/golden-dataset/` | 12 human-authored labels with decision-matrix provenance | QA-13 |
| `fixtures/regression-baseline/` | Measured five-run regression freeze. Not a release decision | QA-15 |

`pnpm test` runs `tests/contract/*.test.ts`, `tests/e2e/*.test.ts`, and `tests/evals/*.test.ts` with `node:test`. It does not run Playwright. `tests/e2e/speaker-captures.ts` is a manual capture script, not a `*.spec.ts`, so the regression project does not include it. `pnpm test:e2e` runs the regression project. The golden dataset is labels only and is checked by `tests/contract/golden-dataset.test.ts`. `tests/evals/runner.ts` scores observations against those labels. A scripted score is not a live model result. `tests/e2e/regression-baseline.ts` parses an already measured Playwright report and the committed per-run freeze. It does not start a browser, it does not invent a passing status, and it does not score O-001 through O-007.
