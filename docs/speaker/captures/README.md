# Speaker captures

These files are the QA-16 screenshots and the reads taken with them.

`observations.json` records four PNG hashes, three order ids, the lookup code, the `verifyOrder` status, and the `decideRelease` result. `modelInvoked` is false. The diagnosis attached to the gate is `scripted-for-slide`. It is not a live model result.

The PNGs show the storefront only. They do not show the harness token, the database path, or a personal headshot. Another run mints new order ids, so the hashes change with the ids on screen.

Regenerate only when the slides should cite a new capture:

```bash
pnpm build
pnpm exec playwright install chromium
node --experimental-strip-types tests/e2e/speaker-captures.ts
```

`tests/e2e/speaker-captures.ts` is not a Playwright spec. `pnpm test:e2e` does not run it, and it does not change the QA-15 regression inventory. The script starts the existing loopback API and Vite preview, drives one mug checkout in each fault mode, reads the order, and then asks the validator and the gate. It writes the token only to the gitignored runtime file and does not copy that token here.
