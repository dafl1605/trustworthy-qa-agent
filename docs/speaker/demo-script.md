# Demo script — 12-minute operator plan

**Status:** operator script for the meetup demo. Not sent.  
**Talk:** Who Tests the AI That Tests Your Software?  
**Event:** BrowserStack Online Meetup, 2026-11-25.  
**What this is:** the words and the order for showing `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`.  
**What this is not:** a measured spoken delivery. A person has not timed this script aloud. S-008 is not complete. The 35-minute talk rehearsal is still QA-18. The deck in `docs/speaker/slides.md` does not identify a backup recording. This script does.

The minute marks below are a plan. They are not a stopwatch reading from a person. The measured time in `docs/speaker/rehearsal/rehearsal.json` is the automated checkout rehearsal only.

## Backup

This file is the backup recording: `docs/speaker/rehearsal/backup-recording.webm`.

If the live checkout cannot be shown, play that video and read only the rows in `docs/speaker/rehearsal/rehearsal.json`. Say that those ids belong to the committed rehearsal. Do not describe a later run with these ids. Do not invent a model score.

The video shows the confirmation screen. Each confirmation is held on screen. The hold is not a spoken pause. The screen says `Order confirmed` for every mode. The note on the page is `This message is not proof that an order was saved.` The video is not the order lookup and it is not a release decision. The lookup, `verifyOrder`, and `decideRelease` results are in the JSON file.

`pnpm demo:rehearsal` can record a new video. That command mints new order ids and replaces `backup-recording.webm` and `rehearsal.json`. Exit 0 means the three paths matched the matrix below. It does not mean `ALLOW`. A live meetup run that is not committed will not match the ids in the committed file. Say that if you regenerate it.

## Plan open: 60 seconds, from 0. Open: a passing screen is not the order

Say the title. Say that a confirmation message is not proof the order was saved. Point at the catalog only long enough to show the three local products and the integer-cent prices. There is no name, address, or payment on the form. There is no scenario switch on the page.

## Plan normal: 180 seconds, from 60. NORMAL: the screen and the stored row agree

Place one Ceramic Mug with the harness in `NORMAL`, or play the matching stretch of the backup recording. The screen says `Order confirmed`. Then read the committed rehearsal row: lookup `200 FOUND`, verification `CONFIRMED`, gate `ALLOW`, policy `tqa-gate-1`. The total on the screen is 1299 cents. Say that this is the path where the screen and the stored row agree. Read the order id from `rehearsal.json` for the file you are showing. Do not memorize an id from an older run.

## Plan ghost: 240 seconds, from 240. GHOST_SUCCESS: the screen passes and the row is absent

Use `GHOST_SUCCESS` the same way. The screen still says `Order confirmed`. Say that a limited UI check of that sentence passes, and that this pass does not call `GET /api/orders/:orderId`. Then read the rehearsal row: lookup `404 ABSENT`, verification `DEFECT`, gate `BLOCK`. A scripted SUCCESS diagnosis left GHOST_SUCCESS at BLOCK. The reason codes are `VERIFICATION_DEFECT` and `DIAGNOSIS_IGNORED`. Say that this is a defect, not an unavailable read. The ghost-oracle Playwright assertion still expects HTTP 200 and still fails on this absence. That failure is the expected negative result. Do not call it a persistence pass. `pnpm demo:false-pass` exiting 0 means that defect was reproduced. It is not `ALLOW`.

## Plan unavailable: 180 seconds, from 480. VERIFICATION_UNAVAILABLE: a 503 is not a 404

Use `VERIFICATION_UNAVAILABLE`. The screen still says `Order confirmed`. Read the rehearsal row: lookup `503 UNAVAILABLE` with reason `service_unavailable`, verification `UNKNOWN`, gate `HOLD`. A scripted SUCCESS diagnosis left VERIFICATION_UNAVAILABLE at HOLD. A scripted claim that this 503 is a confirmed missing order also stayed HOLD, with reason codes `VERIFICATION_UNKNOWN` and `DIAGNOSIS_IGNORED`. Say that `HOLD` is not a softer `BLOCK`. A 503 is not a 404.

## Plan close: 60 seconds, from 660. Close: the backup recording is the screen, not the oracle

Repeat the split. The screen is the same sentence in all three modes. The independent read is what changes. No model was called for this rehearsal. `modelInvoked` is false. `spokenDeliveryMeasured` is false. Do not give a percent. Do not say the probes passed. O-001 through O-007 remain UNVERIFIED. If the live environment failed and you used the video, say again that the video is the backup of the screen and the JSON is the read.

## Matrix to read, not to rephrase

| Mode | Lookup | Verification | Gate |
|---|---|---|---|
| `NORMAL` | 200 `FOUND` | `CONFIRMED` | `ALLOW` |
| `GHOST_SUCCESS` | 404 `ABSENT` | `DEFECT` | `BLOCK` |
| `VERIFICATION_UNAVAILABLE` | 503 `UNAVAILABLE` `service_unavailable` | `UNKNOWN` | `HOLD` |

## Do not say

- Do not say S-008 is complete.
- Do not say a person has already timed this script.
- Do not turn the ghost screen into proof the order was saved.
- Do not turn the 503 into a missing order.
- Do not quote a reliability rate, a flakiness rate, or any percent.
- Do not present the scripted diagnosis as a live model result.
