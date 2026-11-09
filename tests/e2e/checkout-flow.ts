import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  OrderLookupResultSchema,
  PRODUCT_FIXTURES,
  type OrderLookupResult,
  type TestScenario,
} from '@tqa/shared';
import { CONFIRMATION_MESSAGE, MUG_SKU } from './endpoints.ts';
import { readRuntime } from './runtime.ts';

export interface PlacedOrder {
  scenario: TestScenario;
  runId: string;
  orderId: string;
  confirmationMessage: string;
}

export function mugPriceCents(): number {
  const mug = PRODUCT_FIXTURES.find((product) => product.sku === MUG_SKU);
  if (mug === undefined) {
    throw new Error('SKU-MUG is missing from the catalog fixtures');
  }
  return mug.priceCents;
}

function harnessHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-tqa-harness-token': readRuntime().harnessToken,
  };
}

export async function resetRun(
  request: APIRequestContext,
  runId: string,
): Promise<{ deletedOrders: number; scenario: string }> {
  const response = await request.post(`${readRuntime().apiOrigin}/harness/runs/${runId}/reset`, {
    headers: harnessHeaders(),
  });
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) {
    throw new Error('Harness reset response is invalid');
  }
  const record = body as Record<string, unknown>;
  if (typeof record.deletedOrders !== 'number' || typeof record.scenario !== 'string') {
    throw new Error('Harness reset response is missing deletedOrders');
  }
  return { deletedOrders: record.deletedOrders, scenario: record.scenario };
}

async function armScenario(request: APIRequestContext, runId: string, scenario: TestScenario): Promise<void> {
  await resetRun(request, runId);
  const response = await request.post(`${readRuntime().apiOrigin}/harness/runs/${runId}/scenario`, {
    headers: harnessHeaders(),
    data: { scenario },
  });
  expect(response.status()).toBe(200);
}

async function definitionText(page: Page, term: string): Promise<string> {
  const region = page.getByRole('region', { name: 'Confirmation' });
  const terms = region.getByRole('term');
  const definitions = region.getByRole('definition');
  const count = await terms.count();
  for (let index = 0; index < count; index += 1) {
    const label = (await terms.nth(index).innerText()).trim();
    if (label === term) {
      return (await definitions.nth(index).innerText()).trim();
    }
  }
  throw new Error(`Confirmation is missing ${term}`);
}

/**
 * Drives the storefront through catalog, cart, and checkout.
 * The harness arm is fixture setup. It is not the persistence oracle.
 */
export async function placeMugOrder(
  page: Page,
  request: APIRequestContext,
  scenario: TestScenario,
): Promise<PlacedOrder> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
  const addMug = page.getByRole('button', { name: 'Add Ceramic Mug to cart' });
  await expect(addMug).toBeEnabled();
  await addMug.click();
  await page.getByRole('button', { name: 'Cart, 1 item' }).click();
  await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  const runId = await page.getByLabel('Correlation id').inputValue();
  await armScenario(request, runId, scenario);
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Confirmation' })).toBeVisible();
  await expect(page.getByText(CONFIRMATION_MESSAGE, { exact: true })).toBeVisible();
  const orderId = await definitionText(page, 'Order id');
  const shownRunId = await definitionText(page, 'Correlation id');
  expect(shownRunId).toBe(runId);
  return {
    scenario,
    runId,
    orderId,
    confirmationMessage: CONFIRMATION_MESSAGE,
  };
}

export async function lookupOrder(
  request: APIRequestContext,
  orderId: string,
): Promise<{ status: number; body: OrderLookupResult }> {
  const response = await request.get(`${readRuntime().apiOrigin}/api/orders/${orderId}`);
  const parsed = OrderLookupResultSchema.safeParse(await response.json());
  const httpStatus = response.status();
  if (!parsed.success) {
    throw new Error(`Order lookup did not match the contract (HTTP ${httpStatus})`);
  }
  if (parsed.data.status !== httpStatus) {
    throw new Error(`Order lookup HTTP ${httpStatus} does not match body status ${parsed.data.status}`);
  }
  return { status: httpStatus, body: parsed.data };
}
