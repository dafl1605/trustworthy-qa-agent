---
name: frontend-react-engineering
description: Implement or review React, Vite and TypeScript storefront UI, catalog, cart, checkout, confirmation, responsive layout, accessibility and frontend performance. Use for QA-03, QA-04 and apps/storefront changes; not for SQLite, LLM agent or quality gates.
---
# Frontend React Engineering

## Purpose and boundaries
Deliver a small, accessible, testable **demonstration** storefront, not a full commerce platform. Read `AGENTS.md` and `docs/architecture-contracts.md`. Do not add login, payment gateways, analytics, CMS, external fonts/images/CDNs or large UI kits without approval.

## AI-native SDLC validation loop
- Read the relevant user intent and acceptance conditions in `docs/intent.md` and `docs/spec.md`; propose the minimum file-change plan before writing UI code.
- Specify observable UI outcomes first; include loading, request failure, keyboard navigation and a narrow viewport in the acceptance checks.
- After implementing, run a build and relevant Playwright checks; inspect a real screenshot/browser state when available. Never state visual validation occurred without an actual inspection.
- Request a separate review against the spec before DONE. Do not repair the intentionally superficial UI oracle by changing the product's intended fault-injection behavior.

## Implementation workflow
1. Read current task pack, components and shared TypeScript/Zod API contracts. State files to modify. Never silently change a shared contract.
2. Build 3 static product cards, cart, form with accessible labels, confirmation view, and loading/error states using React + Vite. Fetch from local API; no fabricated completion on request failure.
3. Use semantic HTML; buttons are real `button`s, inputs have associated labels, form validation errors are announced, focus visible, keyboard navigable. Avoid solely color-based status.
4. Ensure `runId`/`orderId` used for correlation, never expose fault-mode toggles to regular UI.
5. Keep state local and minimal; avoid unnecessary state libraries. Avoid waterfall network requests, huge images, blocking scripts and heavy packages.
6. Use responsive layout and a neutral, original design (do not copy BrowserStack proprietary design/assets).
7. Review UI with Playwright accessibility-oriented locators (`getByRole`, `getByLabel`) and check a narrow viewport.

## Quality bar
- UI happy path and `GHOST_SUCCESS` both show visual confirmation if API returns success; frontend must **not** query order persistence just to artificially make superficial test fail.
- `VERIFICATION_UNAVAILABLE` must not be confused with checkout failure; uncertainty belongs to verifier/gate, not fabricated UI state.
- No silent console errors; meaningful loading/failure messaging, no leaking stack traces or secrets.
- Run available `pnpm build`, `pnpm typecheck`, and targeted UI tests; record actual outcomes. If not configured yet, state that explicitly.

## Done = output
Changed files, component behavior, accessibility checks performed, relevant test commands/results, blockers, screenshots **only if actually captured**, hours used/unknown and next task.

## Sources on demand
- https://react.dev/learn
- https://vite.dev/guide/
- https://www.w3.org/TR/WCAG22/
- https://vercel.com/docs/agent-resources/skills
