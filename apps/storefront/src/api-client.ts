import type { CatalogProduct, CheckoutPayload, ConfirmationInput } from './commerce-model.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LoadCatalogResult =
  | { ok: true; products: CatalogProduct[] }
  | { ok: false; reason: 'network' | 'http' | 'invalid' | 'aborted' };

export type PlaceOrderResult =
  | { ok: true; confirmation: ConfirmationInput }
  | { ok: false; reason: 'rejected' | 'unavailable' | 'network' | 'invalid' | 'aborted' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCatalogProducts(body: unknown): CatalogProduct[] | null {
  if (!isRecord(body) || !Array.isArray(body.products)) {
    return null;
  }
  const products: CatalogProduct[] = [];
  const seen = new Set<string>();
  for (const entry of body.products) {
    if (!isRecord(entry)) {
      return null;
    }
    const { sku, name, description, priceCents } = entry;
    if (typeof sku !== 'string' || sku.length < 1 || sku.length > 64) {
      return null;
    }
    if (typeof name !== 'string' || name.length < 1) {
      return null;
    }
    if (typeof description !== 'string') {
      return null;
    }
    if (typeof priceCents !== 'number' || !Number.isSafeInteger(priceCents) || priceCents <= 0) {
      return null;
    }
    if (seen.has(sku)) {
      return null;
    }
    seen.add(sku);
    products.push({ sku, name, description, priceCents });
  }
  return products;
}

export function parseConfirmationBody(body: unknown, expectedRunId: string): ConfirmationInput | null {
  if (!isRecord(body)) {
    return null;
  }
  const { orderId, runId, message, totalCents } = body;
  if (typeof orderId !== 'string' || !UUID_PATTERN.test(orderId)) {
    return null;
  }
  if (typeof runId !== 'string' || runId !== expectedRunId || !UUID_PATTERN.test(runId)) {
    return null;
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return null;
  }
  if (typeof totalCents !== 'number' || !Number.isSafeInteger(totalCents) || totalCents < 0) {
    return null;
  }
  return { orderId, runId, message, totalCents };
}

function failureForStatus(status: number): 'rejected' | 'unavailable' {
  return status >= 500 ? 'unavailable' : 'rejected';
}

async function readBody(response: Response): Promise<unknown | undefined> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Reads the fixture catalog and posts a checkout.
 * It does not look up an order after checkout. A confirmation is not a persistence check.
 */
export async function loadCatalog(
  fetchImpl: typeof fetch,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<LoadCatalogResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/api/products`, {
      method: 'GET',
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      signal,
    });
  } catch {
    return { ok: false, reason: signal?.aborted === true ? 'aborted' : 'network' };
  }
  if (response.status !== 200) {
    return { ok: false, reason: 'http' };
  }
  const body = await readBody(response);
  if (body === undefined) {
    return { ok: false, reason: 'invalid' };
  }
  const products = parseCatalogProducts(body);
  if (products === null) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, products };
}

export async function placeOrder(
  fetchImpl: typeof fetch,
  baseUrl: string,
  payload: CheckoutPayload,
  signal?: AbortSignal,
): Promise<PlaceOrderResult> {
  if (!UUID_PATTERN.test(payload.runId) || payload.items.length < 1 || payload.items.length > 3) {
    return { ok: false, reason: 'rejected' };
  }
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/api/checkout`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        runId: payload.runId,
        items: payload.items.map((item) => ({ sku: item.sku, quantity: item.quantity })),
      }),
    });
  } catch {
    return { ok: false, reason: signal?.aborted === true ? 'aborted' : 'network' };
  }
  if (response.status !== 200) {
    return { ok: false, reason: failureForStatus(response.status) };
  }
  const body = await readBody(response);
  if (body === undefined) {
    return { ok: false, reason: 'invalid' };
  }
  const confirmation = parseConfirmationBody(body, payload.runId);
  if (confirmation === null) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, confirmation };
}
