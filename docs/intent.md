# Intent — Trustworthy AI QA Agent MVP v1.0

**Status:** Recorded from user-approved baseline; changes require explicit user approval.  
**Event:** BrowserStack Online Meetup, 2026-11-25.  
**Audience:** Manual QA and SDET practitioners with 2–5 years of experience.

## Problem
A passing UI test may not demonstrate that a business transaction succeeded. A model's persuasive diagnosis may also be incorrect or unsupported by source evidence.

## Desired outcome
Demonstrate a reproducible checkout where Playwright passes while persistence fails, and a bounded AI investigator, independently verified facts and deterministic quality gate produce transparent ALLOW/BLOCK/HOLD decisions.

## Success signals
- NORMAL: persistence confirmed; `ALLOW`.
- GHOST_SUCCESS: superficial UI PASS but missing order independently confirmed; `BLOCK`.
- VERIFICATION_UNAVAILABLE: authoritative read inaccessible; `HOLD` rather than guessed status.
- Single runtime agent, read-only tools, structured evidence-linked diagnoses.
- Dataset of 12 labeled cases, measured evaluation results, repeatable 12-minute demo, English deck and reproducible repo.

## Constraints
- TypeScript strict, React/Vite, Node.js/SQLite, Playwright, Zod; no real payments or personal data.
- 54 hours planned + 9 hours reserve. 3 hours/day Mon–Fri and 6 hours total/weekend, over 3 weeks.
- No MCP, Jev, production multiagent orchestration, advanced CI/CD, custom dashboard, deployment, real payments or authentication.
- Avoid fictional tests, measured metrics or claimed progress. Everything testable must be evidenced.

## Human decisions required
- Change of scope or schedule; modifications to gate policy or permissions; replacing independent oracle with model outputs; publication of technical claims without data.

## Open technical points to settle within QA-01
- HTTP framework and SQLite adapter (choose minimal stable options).
- Exact test-harness safety mechanism (loopback + test-only process/secret).
- CLI execution names and diagnostics sink; no commitment to unverified commands.
