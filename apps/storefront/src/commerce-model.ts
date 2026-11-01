export const CART_SKU_LIMIT = 3;
export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;
export const SKU_MAX_LENGTH = 64;

export const COMMERCE_VIEW_IDS = ['catalog', 'cart', 'checkout', 'confirmation'] as const;

export type CommerceViewId = (typeof COMMERCE_VIEW_IDS)[number];

export const COMMERCE_NOTICE = {
  loading: 'Loading products.',
  catalogFailed:
    'Error: the catalog could not be loaded. No prices are shown and nothing was submitted.',
  catalogNotReady: 'Error: the catalog is not loaded, so the cart cannot change.',
  cartLocked: 'Error: the cart cannot change while checkout is in progress.',
  unknownSku: 'Error: that product is not in the catalog. Nothing was added.',
  skuLimit:
    'Error: the cart already has 3 different products. Remove one before adding another.',
  quantity: 'Error: quantity must be from 1 to 99. The cart was not changed.',
  emptyCart: 'Error: the cart is empty. Nothing was submitted.',
  estimateInvalid: 'Error: the catalog estimate is not a safe total. Nothing was submitted.',
  placing: 'Placing the order.',
  rejected: 'Error: the order was not accepted. No confirmation was returned.',
  unavailable:
    'Error: checkout could not be completed. No confirmation was returned. This is not proof that an order is missing.',
  network: 'Error: checkout could not be reached. No confirmation was returned.',
  invalid:
    'Error: checkout returned a response that could not be shown. No confirmation was displayed.',
  confirmed:
    'Checkout returned a confirmation message. A message on this page is not proof that an order was saved.',
} as const;

export function catalogReadyNotice(count: number): string {
  return count === 1 ? 'Catalog loaded. 1 product.' : `Catalog loaded. ${count} products.`;
}

export function addedNotice(name: string): string {
  return `Added ${name} to the cart.`;
}

export function removedNotice(name: string): string {
  return `Removed ${name} from the cart.`;
}

export function quantityNotice(name: string, quantity: number): string {
  return `Quantity for ${name} is ${quantity}.`;
}

export interface CatalogProduct {
  sku: string;
  name: string;
  description: string;
  priceCents: number;
}

export interface CartLine {
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineCents: number;
}

export interface ShownConfirmation {
  orderId: string;
  runId: string;
  message: string;
  totalCents: number;
  persistenceChecked: false;
}

export interface ShopNotice {
  tone: 'neutral' | 'error';
  text: string;
}

export type CatalogPhase = 'loading' | 'ready' | 'failed';
export type CheckoutPhase = 'idle' | 'submitting' | 'failed';

export interface CommerceState {
  viewId: CommerceViewId;
  catalogPhase: CatalogPhase;
  products: readonly CatalogProduct[];
  lines: readonly CartLine[];
  checkoutPhase: CheckoutPhase;
  confirmation: ShownConfirmation | null;
  runId: string;
  notice: ShopNotice;
}

export interface CheckoutPayload {
  runId: string;
  items: { sku: string; quantity: number }[];
}

export type CheckoutDraft =
  | { ok: true; payload: CheckoutPayload }
  | { ok: false; reason: 'empty' | 'submitting' | 'catalog_not_ready' | 'total' | 'sku_limit' | 'quantity' };

export type CheckoutFailureReason = 'rejected' | 'unavailable' | 'network' | 'invalid';

const FAILURE_NOTICE: Record<CheckoutFailureReason, string> = {
  rejected: COMMERCE_NOTICE.rejected,
  unavailable: COMMERCE_NOTICE.unavailable,
  network: COMMERCE_NOTICE.network,
  invalid: COMMERCE_NOTICE.invalid,
};

export function createCommerceState(runId: string): CommerceState {
  return {
    viewId: 'catalog',
    catalogPhase: 'loading',
    products: [],
    lines: [],
    checkoutPhase: 'idle',
    confirmation: null,
    runId,
    notice: { tone: 'neutral', text: COMMERCE_NOTICE.loading },
  };
}

export function showView(state: CommerceState, viewId: CommerceViewId): CommerceState {
  return { ...state, viewId };
}

export function beginCatalogLoad(state: CommerceState): CommerceState {
  return {
    ...state,
    catalogPhase: 'loading',
    notice: { tone: 'neutral', text: COMMERCE_NOTICE.loading },
  };
}

function noticeError(state: CommerceState, text: string): CommerceState {
  return { ...state, notice: { tone: 'error', text } };
}

function isCatalogProduct(value: CatalogProduct): boolean {
  return (
    value.sku.length >= 1 &&
    value.sku.length <= SKU_MAX_LENGTH &&
    value.name.length >= 1 &&
    typeof value.description === 'string' &&
    Number.isSafeInteger(value.priceCents) &&
    value.priceCents > 0
  );
}

export function catalogReady(state: CommerceState, products: readonly CatalogProduct[]): CommerceState {
  const seen = new Set<string>();
  for (const product of products) {
    if (!isCatalogProduct(product) || seen.has(product.sku)) {
      return catalogFailed(state);
    }
    seen.add(product.sku);
  }

  const bySku = new Map(products.map((product) => [product.sku, product]));
  const lines: CartLine[] = [];
  for (const line of state.lines) {
    const product = bySku.get(line.sku);
    if (product === undefined) {
      continue;
    }
    const lineCents = line.quantity * product.priceCents;
    if (!Number.isSafeInteger(lineCents)) {
      continue;
    }
    lines.push({
      sku: product.sku,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: line.quantity,
      lineCents,
    });
  }

  return {
    ...state,
    catalogPhase: 'ready',
    products: products.map((product) => ({ ...product })),
    lines,
    notice: { tone: 'neutral', text: catalogReadyNotice(products.length) },
  };
}

export function catalogFailed(state: CommerceState): CommerceState {
  return {
    ...state,
    catalogPhase: 'failed',
    products: [],
    lines: [],
    notice: { tone: 'error', text: COMMERCE_NOTICE.catalogFailed },
  };
}

function lineFor(product: CatalogProduct, quantity: number): CartLine | undefined {
  const lineCents = quantity * product.priceCents;
  if (!Number.isSafeInteger(lineCents)) {
    return undefined;
  }
  return {
    sku: product.sku,
    name: product.name,
    unitPriceCents: product.priceCents,
    quantity,
    lineCents,
  };
}

export function addProduct(state: CommerceState, sku: string): CommerceState {
  if (state.checkoutPhase === 'submitting') {
    return noticeError(state, COMMERCE_NOTICE.cartLocked);
  }
  if (state.catalogPhase !== 'ready') {
    return noticeError(state, COMMERCE_NOTICE.catalogNotReady);
  }
  const product = state.products.find((item) => item.sku === sku);
  if (product === undefined) {
    return noticeError(state, COMMERCE_NOTICE.unknownSku);
  }
  const existing = state.lines.find((item) => item.sku === sku);
  if (existing === undefined && state.lines.length >= CART_SKU_LIMIT) {
    return noticeError(state, COMMERCE_NOTICE.skuLimit);
  }
  const quantity = existing === undefined ? 1 : existing.quantity + 1;
  if (quantity > QUANTITY_MAX) {
    return noticeError(state, COMMERCE_NOTICE.quantity);
  }
  const line = lineFor(product, quantity);
  if (line === undefined) {
    return noticeError(state, COMMERCE_NOTICE.quantity);
  }
  const lines =
    existing === undefined
      ? [...state.lines, line]
      : state.lines.map((item) => (item.sku === sku ? line : item));
  return { ...state, lines, notice: { tone: 'neutral', text: addedNotice(product.name) } };
}

export function setLineQuantity(state: CommerceState, sku: string, quantity: number): CommerceState {
  if (state.checkoutPhase === 'submitting') {
    return noticeError(state, COMMERCE_NOTICE.cartLocked);
  }
  if (state.catalogPhase !== 'ready') {
    return noticeError(state, COMMERCE_NOTICE.catalogNotReady);
  }
  const existing = state.lines.find((item) => item.sku === sku);
  if (existing === undefined) {
    return state;
  }
  if (!Number.isSafeInteger(quantity) || quantity < QUANTITY_MIN || quantity > QUANTITY_MAX) {
    return noticeError(state, COMMERCE_NOTICE.quantity);
  }
  const product = state.products.find((item) => item.sku === sku);
  const line =
    product === undefined
      ? lineFor(
          {
            sku: existing.sku,
            name: existing.name,
            description: '',
            priceCents: existing.unitPriceCents,
          },
          quantity,
        )
      : lineFor(product, quantity);
  if (line === undefined) {
    return noticeError(state, COMMERCE_NOTICE.quantity);
  }
  return {
    ...state,
    lines: state.lines.map((item) => (item.sku === sku ? line : item)),
    notice: { tone: 'neutral', text: quantityNotice(line.name, quantity) },
  };
}

export function removeLine(state: CommerceState, sku: string): CommerceState {
  if (state.checkoutPhase === 'submitting') {
    return noticeError(state, COMMERCE_NOTICE.cartLocked);
  }
  const existing = state.lines.find((item) => item.sku === sku);
  if (existing === undefined) {
    return state;
  }
  return {
    ...state,
    lines: state.lines.filter((item) => item.sku !== sku),
    notice: { tone: 'neutral', text: removedNotice(existing.name) },
  };
}

export function estimateTotalCents(lines: readonly CartLine[]): number | null {
  let total = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(total + line.lineCents)) {
      return null;
    }
    total += line.lineCents;
  }
  return total;
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatUsdFromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`;
}

export function draftCheckout(state: CommerceState): CheckoutDraft {
  if (state.catalogPhase !== 'ready') {
    return { ok: false, reason: 'catalog_not_ready' };
  }
  if (state.checkoutPhase === 'submitting') {
    return { ok: false, reason: 'submitting' };
  }
  if (state.lines.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (state.lines.length > CART_SKU_LIMIT) {
    return { ok: false, reason: 'sku_limit' };
  }
  for (const line of state.lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < QUANTITY_MIN || line.quantity > QUANTITY_MAX) {
      return { ok: false, reason: 'quantity' };
    }
  }
  if (estimateTotalCents(state.lines) === null) {
    return { ok: false, reason: 'total' };
  }
  return {
    ok: true,
    payload: {
      runId: state.runId,
      items: state.lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
    },
  };
}

export function rejectCheckoutDraft(
  state: CommerceState,
  reason: Exclude<Extract<CheckoutDraft, { ok: false }>['reason'], 'submitting'>,
): CommerceState {
  const text =
    reason === 'empty'
      ? COMMERCE_NOTICE.emptyCart
      : reason === 'catalog_not_ready'
        ? COMMERCE_NOTICE.catalogNotReady
        : reason === 'sku_limit'
          ? COMMERCE_NOTICE.skuLimit
          : reason === 'quantity'
            ? COMMERCE_NOTICE.quantity
            : COMMERCE_NOTICE.estimateInvalid;
  return noticeError(state, text);
}

export function beginCheckout(state: CommerceState): CommerceState {
  return {
    ...state,
    checkoutPhase: 'submitting',
    notice: { tone: 'neutral', text: COMMERCE_NOTICE.placing },
  };
}

export interface ConfirmationInput {
  orderId: string;
  runId: string;
  message: string;
  totalCents: number;
}

export function showConfirmation(
  state: CommerceState,
  confirmation: ConfirmationInput,
  nextRunId: string,
): CommerceState {
  if (
    confirmation.orderId.length === 0 ||
    confirmation.runId !== state.runId ||
    confirmation.message.trim().length === 0 ||
    !Number.isSafeInteger(confirmation.totalCents) ||
    confirmation.totalCents < 0
  ) {
    return checkoutFailed(state, 'invalid');
  }
  return {
    ...state,
    viewId: 'confirmation',
    checkoutPhase: 'idle',
    lines: [],
    runId: nextRunId,
    confirmation: {
      orderId: confirmation.orderId,
      runId: confirmation.runId,
      message: confirmation.message,
      totalCents: confirmation.totalCents,
      persistenceChecked: false,
    },
    notice: { tone: 'neutral', text: COMMERCE_NOTICE.confirmed },
  };
}

export function checkoutFailed(state: CommerceState, reason: CheckoutFailureReason): CommerceState {
  return {
    ...state,
    checkoutPhase: 'failed',
    notice: { tone: 'error', text: FAILURE_NOTICE[reason] },
  };
}
