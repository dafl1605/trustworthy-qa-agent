import { expect, test } from '@playwright/test';
import { lookupOrder, mugPriceCents, placeMugOrder } from './checkout-flow.ts';
import { evidenceIdFor, writeEvidence } from './evidence.ts';

test('independent oracle confirms a NORMAL order and its server total', async ({ page, request }) => {
  const placed = await placeMugOrder(page, request, 'NORMAL');
  const lookup = await lookupOrder(request, placed.orderId);
  expect(lookup.status).toBe(200);
  expect(lookup.body.code).toBe('FOUND');
  if (lookup.body.code !== 'FOUND') {
    throw new Error('NORMAL lookup was not FOUND');
  }
  expect(lookup.body.order.runId).toBe(placed.runId);
  expect(lookup.body.order.totalCents).toBe(mugPriceCents());
  expect(lookup.body.order.items).toEqual([
    { sku: 'SKU-MUG', quantity: 1, unitPriceCents: mugPriceCents() },
  ]);
  const path = writeEvidence({
    evidenceId: evidenceIdFor(placed.runId, 'independent-oracle'),
    runId: placed.runId,
    orderId: placed.orderId,
    scenario: 'NORMAL',
    observedAt: new Date().toISOString(),
    coverage: 'independent-oracle',
    summary: 'Authoritative lookup found the order with the server-calculated total.',
    ui: { result: 'PASS', message: placed.confirmationMessage },
    oracle: {
      consulted: true,
      httpStatus: lookup.status,
      code: 'FOUND',
      verificationStatus: 'CONFIRMED',
      assertion: 'PASS',
      totalCents: lookup.body.order.totalCents,
    },
  });
  await test.info().attach('oracle-evidence', { path, contentType: 'application/json' });
});
