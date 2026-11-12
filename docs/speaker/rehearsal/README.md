# Demo rehearsal

These files are the QA-17 backup and the timed log of the three checkout paths.

`backup-recording.webm` is the backup recording. Play it when the live checkout cannot be shown. The video shows the storefront confirmation. Each confirmation is held on screen so a person can see it. That hold is not a spoken pause. It shows `Order confirmed` for `NORMAL`, `GHOST_SUCCESS`, and `VERIFICATION_UNAVAILABLE`. It does not show `GET /api/orders/:orderId`, and it is not a release decision.

`rehearsal.json` records the lookup, `verifyOrder`, and `decideRelease` results for the same run, plus the wall-clock time of that automated rehearsal. `modelInvoked` is false. `spokenDeliveryMeasured` is false. The diagnosis attached to the gate is `scripted-for-rehearsal`. It is not a live model result. The planned speech segments sum to 720 seconds. That sum is a plan for the operator script, not a stopwatch reading from a person.

The operator script is `docs/speaker/demo-script.md`. The deck in `docs/speaker/slides.md` identifies `docs/speaker/rehearsal/backup-recording.webm`.

Regenerate only when the committed backup should be replaced:

```bash
pnpm demo:rehearsal
```

Exit 0 means the three paths matched the decision matrix. It does not mean `ALLOW`. The command mints new order ids and replaces both files. `tests/e2e/demo-rehearsal.ts` is not a Playwright spec. `pnpm test:e2e` does not run it, and it does not change the QA-15 regression inventory. The script starts the existing loopback API and Vite preview. It writes the harness token only to the gitignored runtime file and does not copy that token here.
