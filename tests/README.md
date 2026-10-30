# Test layout (QA-01 scaffold)

| Path | Purpose | Introduced in |
| --- | --- | --- |
| `tests/e2e/` | Playwright UI + independent oracle checks | QA-06 |
| `tests/evals/` | Labeled-case evaluation runner outputs | QA-13–QA-14 |
| `fixtures/golden-dataset/` | 12 labeled investigation cases | QA-13 |

No executable tests are wired at the monorepo root until Playwright and eval tasks land.
