# Regression baseline

`baseline.json` is the QA-15 functional freeze. It was produced from five `pnpm test:e2e` runs and five `pnpm test:e2e:ghost-oracle` runs on 2026-11-10. The writer is `tests/e2e/regression-baseline.ts`. That module does not launch a browser. It records file names, titles, statuses, exit codes, start timestamps, and durations.

A green regression row is not `ALLOW`. The ghost-oracle rows stay failures: the assertion expects HTTP 200, and each measured run exited 1 after a 404. Five runs on one machine are not a flakiness rate for any other environment and not a model score.

`pnpm test` reloads this file and rejects a copy that does not match the canonical freeze. It does not repeat the ten browser runs.
