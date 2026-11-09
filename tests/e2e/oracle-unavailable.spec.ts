import { expect, test } from '@playwright/test';
import { lookupOrder, placeMugOrder } from './checkout-flow.ts';
import { evidenceIdFor, writeEvidence } from './evidence.ts';

test('unavailable verification stays 503 UNKNOWN and is not a 404 defect', async ({ page, request }) => {
  const placed = await placeMugOrder(page, request, 'VERIFICATION_UNAVAILABLE');
  const lookup = await lookupOrder(request, placed.orderId);
  expect(lookup.status).not.toBe(404);
  expect(lookup.status).toBe(503);
  expect(lookup.body.code).toBe('UNAVAILABLE');
  if (lookup.body.code !== 'UNAVAILABLE') {
    throw new Error('Unavailable lookup was rewritten to another code');
  }
  expect(lookup.body.reason).toBe('service_unavailable');
  expect(lookup.body.orderId).toBe(placed.orderId);
  const path = writeEvidence({
    evidenceId: evidenceIdFor(placed.runId, 'independent-oracle'),
    runId: placed.runId,
    orderId: placed.orderId,
    scenario: 'VERIFICATION_UNAVAILABLE',
    observedAt: new Date().toISOString(),
    coverage: 'independent-oracle',
    summary:
      'Authoritative lookup returned 503 service_unavailable. The result is UNKNOWN, not a confirmed missing order.',
    ui: { result: 'PASS', message: placed.confirmationMessage },
    oracle: {
      consulted: true,
      httpStatus: lookup.status,
      code: 'UNAVAILABLE',
      verificationStatus: 'UNKNOWN',
      assertion: 'INCONCLUSIVE',
      totalCents: null,
    },
  });
  await test.info().attach('oracle-evidence', { path, contentType: 'application/json' });
});
