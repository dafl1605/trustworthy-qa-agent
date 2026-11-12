# Talk notes — 35-minute English outline

**Status:** outline for the speaker. Not sent. Not a measured spoken delivery.  
**Talk:** Who Tests the AI That Tests Your Software?  
**Event:** BrowserStack Online Meetup, 2026-11-25.  
**Audience:** Manual QA and SDET practitioners with about 2–5 years of experience.  
**What this is:** the planned order of the 35-minute content, including the 12-minute demo.  
**What this is not:** a stopwatch reading. A person has not timed the talk aloud. S-008 is not complete. `spokenDeliveryMeasured` is false. `spokenElapsedSeconds` in `docs/speaker/talk-rehearsal.json` is null. `modelInvoked` is false.

The segments below are a plan. They sum to 2100 seconds. The demo segment is 720 seconds. Those 720 seconds are the same plan as `docs/speaker/demo-script.md`. Do not add them a second time. The automated checkout time in `docs/speaker/rehearsal/rehearsal.json` is not a spoken duration.

The deck in `docs/speaker/slides.md` identifies `docs/speaker/rehearsal/backup-recording.webm`. This outline does too. The proposal in `docs/speaker/2026-11-25-browserstack-draft.md` has not been sent. The speaker name, role, experience, contact, and headshot stay outside this file. Do not invent them.

## Plan open: 180 seconds, from 0. Open: a passing screen and a confident diagnosis are not the order

Say the title. Say that a checkout screen can report success while the order was never stored. Say that a model can explain that result and still be wrong. Do not introduce a measured model score. The local catalog has three products and integer-cent prices. The form has no name, address, or payment.

## Plan screen: 300 seconds, from 180. Screen: Order confirmed is the same sentence in all three modes

Show the three confirmation captures in `docs/speaker/captures/`, or the backup recording if you are not on the live storefront. The screen says `Order confirmed` for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. The note on the page is `This message is not proof that an order was saved.` The confirmation page does not call `GET /api/orders/:orderId`. A limited UI check of that sentence can pass for the ghost path. That pass is not persistence.

## Plan matrix: 240 seconds, from 480. Matrix: NORMAL ALLOW, GHOST_SUCCESS BLOCK, VERIFICATION_UNAVAILABLE HOLD

Read the three rows. Policy version `tqa-gate-1` is the decision.

| Mode | Lookup | Verification | Gate |
|---|---|---|---|
| `NORMAL` | 200 `FOUND` | `CONFIRMED` | `ALLOW` |
| `GHOST_SUCCESS` | 404 `ABSENT` | `DEFECT` | `BLOCK` |
| `VERIFICATION_UNAVAILABLE` | 503 `UNAVAILABLE` `service_unavailable` | `UNKNOWN` | `HOLD` |

`HOLD` is not a softer `BLOCK`. A 503 is not a 404. A scripted SUCCESS diagnosis left GHOST_SUCCESS at BLOCK. A scripted SUCCESS diagnosis left VERIFICATION_UNAVAILABLE at HOLD. A scripted claim that the 503 is a confirmed missing order also stayed HOLD.

## Plan pipeline: 300 seconds, from 720. Pipeline: one read-only agent, an independent read, and policy tqa-gate-1

Name the split, in this order. The storefront shows the confirmation. Playwright can record that screen. The evidence collector links `runId` and `orderId` and does not decide the gate. One runtime agent can call five read-only tools. Its diagnosis is not the release decision. `@tqa/validators` reads the order file on its own connection. `@tqa/quality-gate` applies `tqa-gate-1`. Text that says to ignore policy is not copied into the decision. There is one runtime agent. There is no runtime multi-agent system in this repo.

## Plan demo: 720 seconds, from 1020. Demo: follow the 12-minute operator script or play the backup recording

Follow `docs/speaker/demo-script.md` for this segment. The backup recording is `docs/speaker/rehearsal/backup-recording.webm`. If the live checkout cannot be shown, play that file and read only the rows in `docs/speaker/rehearsal/rehearsal.json`. Say that those ids belong to the committed rehearsal. The video shows `Order confirmed` for one mug in each mode. The video is not the order lookup and it is not a release decision. `pnpm demo:rehearsal` exiting 0 means the three paths matched the matrix. It does not mean `ALLOW`. `pnpm test:e2e` passing does not mean `ALLOW`. `pnpm test:e2e:ghost-oracle` is expected to fail the ghost case with 404 `ABSENT`. The assertion still expects HTTP 200. That failure is the expected negative result. `pnpm demo:false-pass` exiting 0 means that false UI pass was reproduced. It is not `ALLOW`.

## Plan limits: 240 seconds, from 1740. Limits: quote the freeze and the scripted eval only as written

Read these sentences. Do not turn them into a rate.

`fixtures/regression-baseline/baseline.json` says: Five measured regression runs and five measured expected-negative runs on this machine. This is not a release decision, not a model score, and not a flakiness rate for any other environment.

`tests/evals/runner.ts` says: n=12. These counts are not a reliability rate and do not generalize. The runner did not call a model and did not open SQLite. measuredFromModel records only the caller-supplied source. Scripted stimuli do not include collected evidence ids, so an empty citation is uncovered rather than a measured linkage rate.

`measuredFromModel` is false for that scripted run. Twelve cases are not a reliability rate. O-001 through O-007 remain UNVERIFIED. `pnpm test` does not score them. Do not report those probes as passing.

## Plan close: 120 seconds, from 1980. Close: questions stay inside the committed files

Repeat the split. The screen can pass in all three modes. The independent read and policy `tqa-gate-1` make `ALLOW`, `BLOCK`, or `HOLD`. If a question asks for a number that is not in `docs/speaker/deliverables.md`, do not supply one. The 54-hour baseline and the 9-hour contingency are unchanged. Sending the proposal is a separate human decision.

## Do not say

- Do not say S-008 is complete.
- Do not say a person has already timed this outline.
- Do not claim a stopwatch reading for this outline.
- Do not turn the ghost screen into proof the order was saved.
- Do not turn the 503 into a missing order.
- Do not quote a percent.
- Do not quote a reliability rate or a flakiness rate.
- Do not present the scripted diagnosis as a live model result.
- Do not say the materials have been sent.
