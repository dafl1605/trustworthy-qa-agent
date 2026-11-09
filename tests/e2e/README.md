# End-to-end tests

QA-06 uses Playwright against the built storefront and a loopback API. The storefront still has no scenario control. The fixture arms `NORMAL`, `GHOST_SUCCESS`, or `VERIFICATION_UNAVAILABLE` through the local harness, then the browser only checks the confirmation screen.

## Browser

`@playwright/test` is pinned to `1.65.0`. Install the Chromium build that matches that package before the first browser run:

```bash
pnpm exec playwright install chromium
```

Without that browser, `pnpm test:e2e` fails with `Executable doesn't exist`. Installing Chromium does not change the assertions.

## What a green result means

`pnpm test:e2e` runs the regression project. It includes a limited UI test that passes for every scenario, including `GHOST_SUCCESS`. That pass does not read `GET /api/orders/:orderId`. A green regression run is not proof that an order was saved.

The same project runs `fault-ghost-characterization.spec.ts`. That test places one `GHOST_SUCCESS` order and expects HTTP 404 `ABSENT`. A pass means the injected defect is still present. It is not tagged `@expected-negative` and it does not replace `oracle-ghost.spec.ts`.

The same command also runs:

- an independent oracle for `NORMAL`, which requires HTTP 200 `FOUND` and the server total
- an unavailable-read test, which requires HTTP 503 `UNAVAILABLE` and treats that as `UNKNOWN`, not as 404
- five consecutive `NORMAL` checkouts with distinct ids, a confirming read, and an idempotent reset

`pnpm test:e2e:ghost-oracle` runs the persistence oracle against `GHOST_SUCCESS`. The assertion expects HTTP 200. The lookup is 404 `ABSENT`, so Playwright exits non-zero. That failure is the expected negative result. Do not change the assertion to expect 404 just to make the command exit 0.

`pnpm demo:false-pass` runs the limited ghost UI test and then the ghost oracle five times. It exits 0 only when the UI command exited 0 and all five oracle lookups were 404 `ABSENT` while Playwright itself exited non-zero. An exit 0 from this demo means the false PASS was reproduced.

JSON evidence is written under `test-results/evidence/`. Those files are local artifacts, not a release decision. The gate `ALLOW` / `BLOCK` / `HOLD` is still QA-12.
