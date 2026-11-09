import { expect, test } from '@playwright/test';
import { lookupOrder, mugPriceCents, placeMugOrder, resetRun } from './checkout-flow.ts';
import { writeEvidence } from './evidence.ts';

test('five consecutive NORMAL checkouts use distinct ids and each order is stored', async ({ page, request }) => {
  test.setTimeout(60_000);
  const runs: { runId: string; orderId: string }[] = [];
  for (let index = 0; index < 5; index += 1) {
    const placed = await placeMugOrder(page, request, 'NORMAL');
    expect(runs.some((run) => run.runId === placed.runId)).toBe(false);
    expect(runs.some((run) => run.orderId === placed.orderId)).toBe(false);
    const lookup = await lookupOrder(request, placed.orderId);
    expect(lookup.status).toBe(200);
    expect(lookup.body.code).toBe('FOUND');
    if (lookup.body.code !== 'FOUND') {
      throw new Error('Repeatability lookup was not FOUND');
    }
    expect(lookup.body.order.runId).toBe(placed.runId);
    expect(lookup.body.order.totalCents).toBe(mugPriceCents());
    const firstReset = await resetRun(request, placed.runId);
    expect(firstReset.deletedOrders).toBe(1);
    expect(firstReset.scenario).toBe('NORMAL');
    const secondReset = await resetRun(request, placed.runId);
    expect(secondReset.deletedOrders).toBe(0);
    const afterReset = await lookupOrder(request, placed.orderId);
    expect(afterReset.status).toBe(404);
    expect(afterReset.body.code).toBe('ABSENT');
    runs.push({ runId: placed.runId, orderId: placed.orderId });
  }
  const first = runs[0];
  if (first === undefined) {
    throw new Error('Repeatability produced no runs');
  }
  writeEvidence({
    evidenceId: `repeatability:${first.runId}`,
    runId: first.runId,
    orderId: first.orderId,
    scenario: 'NORMAL',
    observedAt: new Date().toISOString(),
    coverage: 'repeatability',
    summary: `Five isolated NORMAL checkouts were confirmed, then reset. Run ids: ${runs.map((run) => run.runId).join(', ')}.`,
    ui: { result: 'PASS', message: 'Order confirmed' },
    oracle: {
      consulted: true,
      httpStatus: 200,
      code: 'FOUND',
      verificationStatus: 'CONFIRMED',
      assertion: 'PASS',
      totalCents: mugPriceCents(),
    },
  });
});
