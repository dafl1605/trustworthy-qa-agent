import { expect, test } from '@playwright/test';
import { lookupOrder, placeMugOrder } from './checkout-flow.ts';
import { evidenceIdFor, writeEvidence, type CheckoutEvidence } from './evidence.ts';

/**
 * This test is an expected negative result.
 * The UI confirmation is visible, then the persistence assertion fails because
 * GHOST_SUCCESS does not store the order. Do not weaken the 200 expectation
 * to make the Playwright status green. `pnpm demo:false-pass` records that failure.
 */
test('independent oracle requires a persisted order @expected-negative', async ({ page, request }) => {
  const placed = await placeMugOrder(page, request, 'GHOST_SUCCESS');
  const lookup = await lookupOrder(request, placed.orderId);
  const code = lookup.body.code === 'FOUND' || lookup.body.code === 'ABSENT' || lookup.body.code === 'UNAVAILABLE'
    ? lookup.body.code
    : null;
  const verificationStatus =
    lookup.status === 200 && lookup.body.code === 'FOUND'
      ? 'CONFIRMED'
      : lookup.status === 404 && lookup.body.code === 'ABSENT'
        ? 'DEFECT'
        : lookup.status === 503 && lookup.body.code === 'UNAVAILABLE'
          ? 'UNKNOWN'
          : 'NOT_CONSULTED';
  const evidence: CheckoutEvidence = {
    evidenceId: evidenceIdFor(placed.runId, 'independent-oracle'),
    runId: placed.runId,
    orderId: placed.orderId,
    scenario: 'GHOST_SUCCESS',
    observedAt: new Date().toISOString(),
    coverage: 'independent-oracle',
    summary:
      'The screen showed Order confirmed. The independent lookup did not find a stored order. That failed assertion is the expected negative result.',
    ui: { result: 'PASS', message: placed.confirmationMessage },
    oracle: {
      consulted: true,
      httpStatus: lookup.status,
      code,
      verificationStatus,
      assertion: verificationStatus === 'CONFIRMED' ? 'PASS' : verificationStatus === 'UNKNOWN' ? 'INCONCLUSIVE' : 'FAIL',
      totalCents: lookup.body.code === 'FOUND' ? lookup.body.order.totalCents : null,
    },
  };
  const path = writeEvidence(evidence);
  await test.info().attach('oracle-evidence', { path, contentType: 'application/json' });
  expect(
    lookup.status,
    'Independent oracle: the confirmation is not proof. The order must be persisted and return 200 FOUND.',
  ).toBe(200);
  expect(lookup.body.code).toBe('FOUND');
});
