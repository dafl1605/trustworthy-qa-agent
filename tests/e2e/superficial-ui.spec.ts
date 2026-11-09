import { expect, test } from '@playwright/test';
import type { TestScenario } from '@tqa/shared';
import { placeMugOrder } from './checkout-flow.ts';
import { evidenceIdFor, writeEvidence } from './evidence.ts';

const scenarios: readonly TestScenario[] = ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'];

for (const scenario of scenarios) {
  test(`limited UI coverage records confirmation only for ${scenario}`, async ({ page, request }) => {
    const placed = await placeMugOrder(page, request, scenario);
    expect(placed.confirmationMessage).toBe('Order confirmed');
    const path = writeEvidence({
      evidenceId: evidenceIdFor(placed.runId, 'limited-ui'),
      runId: placed.runId,
      orderId: placed.orderId,
      scenario,
      observedAt: new Date().toISOString(),
      coverage: 'limited-ui',
      summary:
        'Superficial UI PASS. This test does not read the order. The same confirmation can appear when nothing was saved.',
      ui: { result: 'PASS', message: placed.confirmationMessage },
      oracle: {
        consulted: false,
        httpStatus: null,
        code: null,
        verificationStatus: 'NOT_CONSULTED',
        assertion: 'NOT_CONSULTED',
        totalCents: null,
      },
    });
    await test.info().attach('limited-ui-evidence', { path, contentType: 'application/json' });
  });
}
