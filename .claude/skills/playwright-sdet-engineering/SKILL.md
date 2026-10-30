---
name: playwright-sdet-engineering
description: Implement Playwright TypeScript E2E, API assertions, fixtures, scenario reset, runId correlation, traces, JSON reports and deterministic regression for the BrowserStack demo. Use for QA-06, QA-15, tests/e2e or test infrastructure; not for changing the product's fault modes.
---
# Playwright SDET Engineering

## Mission
Demonstrate a *passing superficial UI test* that misses a real business defect, then show an independent oracle that catches it. Read `AGENTS.md` and `docs/architecture-contracts.md` before testing.

## AI-native SDLC validation loop
- Start with acceptance cases traced to `docs/spec.md`, not with locators or implementation details. Include tests for misleading PASS, authoritative absence and unavailable data.
- Validate changes to test semantics by a distinct review pass; never fix a red oracle by deleting or weakening its assertion.
- Produce machine-readable results. Repeat tests for flakiness; report the distribution, not only the final green run.

## Workflow
1. Inspect app/API contracts and test harness; design fixtures with fresh `runId`, isolated DB and deterministic scenario reset.
2. Create intentionally limited UI test: select product, checkout, assert confirmation **only**. It must PASS in NORMAL and GHOST_SUCCESS. Label it clearly as limited coverage.
3. Create independent oracle test checking authoritative order persistence/total using APIRequestContext or trusted readonly adapter; NORMAL PASS, GHOST_SUCCESS detects failure, VERIFICATION_UNAVAILABLE inconclusive.
4. Distinguish an expected negative test result from a hidden PASS: demo runner may handle a failing process explicitly but must surface the true failed assertion and exit/report status truthfully.
5. Use `getByRole`/`getByLabel`, auto-wait assertions, no hard sleeps, test isolation, fixtures not cross-test shared global state.
6. In demo mode save traces on PASS, screenshots as needed, JSON results and network evidence. In ordinary regression mode avoid unnecessary huge artifacts.
7. Correlate `runId`, `orderId`, evidence record IDs and artifact paths. Exercise five consecutive isolated demo runs before final sign-off.
8. Run actual tests and capture command outputs; report any flakiness instead of retrying until green without investigation.

## Deliverables & acceptance
- Test demonstrates false PASS and oracle failure with actual evidence, not an invented screenshot.
- 503/timeout reported as unknown without transforming to 404; do not mark a fail as business defect if source unavailable.
- Targeted tests + reports documented and reproducible using documented `pnpm` scripts.

## Sources on demand
- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/test-fixtures
- https://playwright.dev/docs/api-testing
- https://playwright.dev/docs/trace-viewer
- https://playwright.dev/docs/test-reporters
