import { expect, test } from '@playwright/test';
import { lookupOrder, placeMugOrder } from './checkout-flow.ts';

/**
 * Control that the injected GHOST_SUCCESS defect is still present.
 * A green result means the order lookup is still 404 ABSENT.
 * This file is not the independent oracle. It does not replace
 * oracle-ghost.spec.ts, and it is not tagged @expected-negative.
 * The expected-negative project still requires HTTP 200 and stays red.
 */
test('control: injected GHOST_SUCCESS is still absent from the order read', async ({ page, request }) => {
  const placed = await placeMugOrder(page, request, 'GHOST_SUCCESS');
  const lookup = await lookupOrder(request, placed.orderId);
  expect(
    lookup.status,
    'Defect control: GHOST_SUCCESS must still withhold the order. HTTP 404 means the injected absence is present. This does not replace the red oracle in oracle-ghost.spec.ts.',
  ).toBe(404);
  expect(lookup.body.code).toBe('ABSENT');
});
