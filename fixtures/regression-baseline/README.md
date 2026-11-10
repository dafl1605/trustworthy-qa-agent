# Regression baseline

`baseline.json` is the QA-15 functional freeze. The writer is `tests/e2e/regression-baseline.ts`. That module does not launch a browser. For each run it records the command, exit code, start timestamp, duration, spec base name, title, project name, and statuses. Each ghost-oracle run also records `observedLookupStatus`. The loader parses those fields. It does not invent a passing status for a run that omitted one.

A green regression row is not `ALLOW`. The ghost-oracle rows stay failures: the assertion expects HTTP 200, each measured run exited 1, and the stored lookup status is 404. A 503 or a timeout is not frozen as a missing order. Five runs on one machine are not a flakiness rate for any other environment and not a model score.

`pnpm test` reloads this file and rejects a copy that does not match the canonical freeze. It does not repeat the ten browser runs.
