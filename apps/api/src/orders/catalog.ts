import { PRODUCT_FIXTURES, type CheckoutItem, type OrderItemRecord, type Product } from '@tqa/shared';

const productsBySku = new Map(PRODUCT_FIXTURES.map((product) => [product.sku, product]));

export function listProducts(): Product[] {
  return PRODUCT_FIXTURES.map((product) => ({
    sku: product.sku,
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
  }));
}

export type PricedCheckout =
  | { ok: true; totalCents: number; items: OrderItemRecord[] }
  | { ok: false; sku: string };

/**
 * Prices come only from the fixture catalog. Client-supplied amounts are not an input.
 */
export function priceCheckout(items: readonly CheckoutItem[]): PricedCheckout {
  const priced: OrderItemRecord[] = [];
  let totalCents = 0;
  for (const item of items) {
    const product = productsBySku.get(item.sku);
    if (product === undefined) {
      return { ok: false, sku: item.sku };
    }
    const lineCents = item.quantity * product.priceCents;
    if (!Number.isSafeInteger(lineCents) || !Number.isSafeInteger(totalCents + lineCents)) {
      return { ok: false, sku: item.sku };
    }
    totalCents += lineCents;
    priced.push({
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
    });
  }
  return { ok: true, totalCents, items: priced };
}
