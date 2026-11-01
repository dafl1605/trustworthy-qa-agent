# Implementation plan — QA-04 catalog, cart, checkout, and confirmation

Task ID: QA-04  
Spec IDs: S-001 UI confirmation path only. S-002 and S-003 stay unimplemented. The UI must not turn a checkout response into a persistence proof.  
Status: ACCEPTED for this orchestrator run. QA-01, QA-02, and QA-03 are on `origin/main` at `7b87af954dc4888337adcebe7258e5d417015cef`. No open PR covers QA-04.

## Objective and why
Replace the storefront scaffold with a local catalog, cart, checkout, and confirmation so a person can place a normal order against the existing API. A confirmation message is what the checkout response returned. It is not an independent check that the order was saved. See `docs/intent.md`: a UI message is not proof of persistence.

## Scope and files
- Read: `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md`, `docs/sprint-plan.md`, `.claude/skills/frontend-react-engineering/SKILL.md`, current storefront and checkout API
- Change:
  - `apps/storefront/src/commerce-model.ts`
  - `apps/storefront/src/api-client.ts`
  - `apps/storefront/src/App.tsx`
  - `apps/storefront/src/shell-model.ts`
  - `apps/storefront/src/styles.css`
  - `apps/storefront/vite.config.ts`
  - `tests/contract/storefront-shell.test.ts`
  - `tests/contract/storefront-commerce.test.ts`
  - `docs/architecture.md`
  - `docs/plans/QA-04-storefront-commerce.md`
  - `docs/progress/2026-11-01.md`
  - `README.md`
- Explicitly not change: shared Zod contracts, SQLite schema, fault modes, harness routes, sprint-plan hours, skills, gate policy, speaker draft

## Dependencies and design alternatives
- Prerequisites: QA-02 checkout API and QA-03 section shell are merged. No open implementation PR.
- Choice: local React state, a pure cart model tested with `node:test`, and `fetch` of `GET /api/products` plus `POST /api/checkout`. The Vite dev and preview servers proxy `/api` to `127.0.0.1:3001`, so the API stays loopback-only and does not gain a CORS policy.
- Rejected: adding `@tqa/shared` or Zod to the browser bundle. The client checks the JSON fields it renders and the server remains the price authority.
- Rejected: `GET /api/orders/:orderId` from the storefront. That read is the authoritative lookup. The page must not perform it in order to decorate or retract a confirmation.
- Rejected: a scenario toggle, payment fields, customer name, React Router, or a component library.
- Rejected: implementing `GHOST_SUCCESS` or `VERIFICATION_UNAVAILABLE`. Those remain QA-05. This UI already shows a confirmation whenever checkout returns one, and it treats a failed checkout as "no confirmation", not as a verified missing order.

## Risk review
- What can break? The storefront production build, the shell contract test, and the cart rules (4th SKU, quantity bounds, empty submit).
- Risk to fault semantics / gate / permissions? The public API still persists a normal checkout. No new fault route is added. The page cannot select a scenario.
- Required human approval? None for this scope. Sending speaker material and changing the 54h + 9h baseline stay out of scope.

## Tests before implementation
- Positive: one to three catalog SKUs build a checkout body of `runId` and `items` only; a real API confirmation is shown with the server total; `persistenceChecked` stays false.
- Negative: empty cart, unknown SKU, 4th distinct SKU, and quantity outside 1–99 do not submit a confirmation. A 400 does not invent an order id.
- Unknown: catalog or checkout network/HTTP failure leaves `confirmation` unset. A checkout 503 says the attempt did not return a confirmation and is not proof the order is missing. The storefront source does not call `/api/orders`.

## Implementation steps
1. Add the pure commerce model and the loopback API client.
2. Render catalog, cart, checkout, and confirmation in the existing shell.
3. Lock the model and client with contract tests, including a live API checkout.
4. Run typecheck, build, test, and a browser pass of the purchase path, a narrow viewport, and a stopped API.

## Verification commands
- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- API on `127.0.0.1:3001` and the storefront dev server on `127.0.0.1:5173`

## Exit criteria and independent review
- The catalog lists the three fixture products with integer-cent prices from the API.
- The cart holds at most 3 distinct SKUs and quantities 1–99.
- Checkout shows the returned message, order id, correlation id, and server total.
- The page states that the message is not proof the order was saved, and it does not call the order lookup.
- A failed catalog load or failed checkout does not invent an order id.
- Keyboard and a narrow viewport still reach the controls.
- Status stays IN_REVIEW until an independent reviewer reads the PR head SHA. Not DONE.

## Evidence and actual execution (filled after running)
- Commands run and result: recorded in `docs/progress/2026-11-01.md`. Final `pnpm typecheck` and `pnpm test` exited 0. `node:test` reported 44 passed and 0 failed.
- Artifact paths: local browser recording and screenshots are outside the repo, under `/opt/cursor/artifacts/`.
- Actual elapsed hours: unknown
- Status: IN_REVIEW. Not DONE. An independent reviewer still has to read the PR head SHA.
