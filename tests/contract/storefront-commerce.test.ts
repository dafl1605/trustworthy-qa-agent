import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readdirSync, readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CheckoutConfirmationSchema, OrderLookupResultSchema } from '@tqa/shared';
import { createApp, listen } from '@tqa/api';
import { applySchema, openDatabase } from '@tqa/api/migrate';
import { loadCatalog, parseCatalogProducts, placeOrder } from '../../apps/storefront/src/api-client.ts';
import {
  COMMERCE_NOTICE,
  COMMERCE_VIEW_IDS,
  addProduct,
  beginCheckout,
  catalogFailed,
  catalogReady,
  checkoutFailed,
  createCommerceState,
  draftCheckout,
  estimateTotalCents,
  setLineQuantity,
  showConfirmation,
  type CatalogProduct,
  type CommerceState,
} from '../../apps/storefront/src/commerce-model.ts';
import { SHELL_VIEW_IDS } from '../../apps/storefront/src/shell-model.ts';

const runId = '11111111-1111-4111-8111-111111111111';
const nextRunId = '22222222-2222-4222-8222-222222222222';
const retryRunId = '33333333-3333-4333-8333-333333333333';
const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const mug: CatalogProduct = {
  sku: 'SKU-MUG',
  name: 'Ceramic Mug',
  description: 'Demo mug.',
  priceCents: 1299,
};
const tee: CatalogProduct = {
  sku: 'SKU-TEE',
  name: 'Cotton T-Shirt',
  description: 'Demo shirt.',
  priceCents: 2499,
};
const sticker: CatalogProduct = {
  sku: 'SKU-STK',
  name: 'Sticker Pack',
  description: 'Demo stickers.',
  priceCents: 399,
};
const extra: CatalogProduct = {
  sku: 'SKU-HAT',
  name: 'Demo Hat',
  description: 'Only used to prove the cart limit.',
  priceCents: 1000,
};

type ApiDatabase = ReturnType<typeof openDatabase>;

function ready(products: readonly CatalogProduct[], id = runId): CommerceState {
  return catalogReady(createCommerceState(id), products);
}

async function withApi(
  database: ApiDatabase | undefined,
  run: (baseUrl: string, db: ApiDatabase | undefined) => Promise<void>,
): Promise<void> {
  const server: Server = database === undefined ? createApp() : createApp({ database });
  await listen(server, 0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a loopback TCP address');
  }
  try {
    await run(`http://127.0.0.1:${address.port}`, database);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

describe('storefront commerce model', () => {
  it('uses the same four sections as the shell', () => {
    assert.deepEqual(COMMERCE_VIEW_IDS, SHELL_VIEW_IDS);
  });

  it('builds a checkout of one to three products without sending a price', () => {
    let state = ready([mug, tee, sticker]);
    state = addProduct(state, mug.sku);
    state = addProduct(state, mug.sku);
    state = addProduct(state, sticker.sku);
    assert.equal(estimateTotalCents(state.lines), 2997);
    const draft = draftCheckout(state);
    assert.equal(draft.ok, true);
    if (!draft.ok) {
      return;
    }
    assert.deepEqual(draft.payload, {
      runId,
      items: [
        { sku: 'SKU-MUG', quantity: 2 },
        { sku: 'SKU-STK', quantity: 1 },
      ],
    });
    assert.equal('priceCents' in draft.payload, false);
    assert.equal(state.confirmation, null);
  });

  it('rejects a fourth distinct product, a bad quantity, and an empty submit', () => {
    let state = ready([mug, tee, sticker, extra]);
    state = addProduct(state, mug.sku);
    state = addProduct(state, tee.sku);
    state = addProduct(state, sticker.sku);
    const blocked = addProduct(state, extra.sku);
    assert.equal(blocked.lines.length, 3);
    assert.equal(blocked.notice.text, COMMERCE_NOTICE.skuLimit);
    assert.equal(blocked.confirmation, null);

    const zero = setLineQuantity(state, mug.sku, 0);
    const tooMany = setLineQuantity(state, mug.sku, 100);
    assert.equal(zero.lines[0]?.quantity, 1);
    assert.equal(tooMany.lines[0]?.quantity, 1);
    assert.match(zero.notice.text, /1 to 99/);

    const empty = draftCheckout(ready([mug]));
    assert.deepEqual(empty, { ok: false, reason: 'empty' });
  });

  it('shows the returned confirmation and does not mark persistence as checked', () => {
    let state = ready([mug]);
    state = addProduct(state, mug.sku);
    state = showConfirmation(
      state,
      { orderId, runId, message: 'Order confirmed', totalCents: 1299 },
      nextRunId,
    );
    assert.equal(state.viewId, 'confirmation');
    assert.equal(state.lines.length, 0);
    assert.equal(state.runId, nextRunId);
    assert.equal(state.confirmation?.message, 'Order confirmed');
    assert.equal(state.confirmation?.totalCents, 1299);
    assert.equal(state.confirmation?.persistenceChecked, false);
    assert.match(state.notice.text, /not proof/);

    const mismatched = showConfirmation(
      ready([mug]),
      { orderId, runId: nextRunId, message: 'Order confirmed', totalCents: 1299 },
      retryRunId,
    );
    assert.equal(mismatched.confirmation, null);
    assert.equal(mismatched.runId, retryRunId);
    assert.equal(mismatched.notice.text, COMMERCE_NOTICE.invalid);
  });

  it('retires the runId after a failed attempt and clears a previous confirmation', () => {
    let state = addProduct(ready([mug]), mug.sku);
    state = showConfirmation(
      state,
      { orderId, runId, message: 'Order confirmed', totalCents: 1299 },
      nextRunId,
    );
    state = addProduct(state, mug.sku);
    const started = beginCheckout(state);
    assert.equal(started.checkoutPhase, 'submitting');
    assert.equal(started.confirmation, null);
    assert.equal(started.runId, nextRunId);

    const failed = checkoutFailed(started, 'network', retryRunId);
    assert.equal(failed.confirmation, null);
    assert.equal(failed.runId, retryRunId);
    assert.notEqual(failed.runId, nextRunId);
    assert.match(failed.notice.text, /No confirmation was returned/);
    const retry = draftCheckout(failed);
    assert.equal(retry.ok, true);
    if (!retry.ok) {
      return;
    }
    assert.equal(retry.payload.runId, retryRunId);
    assert.notEqual(retry.payload.runId, nextRunId);
  });

  it('keeps a failed catalog or checkout from inventing an order id', () => {
    const loaded = addProduct(ready([mug, tee]), mug.sku);
    const failedCatalog = catalogFailed(loaded);
    assert.equal(failedCatalog.catalogPhase, 'failed');
    assert.deepEqual(failedCatalog.products, []);
    assert.deepEqual(failedCatalog.lines, []);
    assert.equal(failedCatalog.confirmation, null);
    assert.match(failedCatalog.notice.text, /^Error:/);
    assert.doesNotMatch(failedCatalog.notice.text, /Order confirmed/);

    const failedCheckout = checkoutFailed(loaded, 'unavailable', nextRunId);
    assert.equal(failedCheckout.runId, nextRunId);
    assert.notEqual(failedCheckout.runId, loaded.runId);
    assert.equal(failedCheckout.confirmation, null);
    assert.equal(failedCheckout.lines.length, 1);
    assert.match(failedCheckout.notice.text, /not proof that an order is missing/);
    assert.doesNotMatch(failedCheckout.notice.text, /Order confirmed/);

    const duplicate = catalogReady(createCommerceState(runId), [mug, { ...mug }]);
    assert.equal(duplicate.catalogPhase, 'failed');
    assert.equal(duplicate.confirmation, null);
  });
});

describe('storefront API client', () => {
  it('does not call order lookup or name a fault scenario', () => {
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../../apps/storefront/src');
    const source = readdirSync(srcDir)
      .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
      .map((name) => readFileSync(join(srcDir, name), 'utf8'))
      .join('\n');
    assert.equal(source.includes('/api/orders'), false);
    assert.equal(source.includes('GHOST_SUCCESS'), false);
    assert.equal(source.includes('VERIFICATION_UNAVAILABLE'), false);
    assert.equal(source.includes('scenario='), false);
    assert.equal(source.includes('Order confirmed'), false);
    assert.match(source, /\/api\/products/);
    assert.match(source, /\/api\/checkout/);
    assert.match(source, /checkoutFailed\(current, result\.reason, crypto\.randomUUID\(\)\)/);
    assert.match(source, /checkoutFailed\(current, 'unavailable', crypto\.randomUUID\(\)\)/);
    assert.match(source, /if \(event\.key !== 'Enter'\)/);
  });

  it('rejects a catalog payload that is not the fixture shape', () => {
    assert.equal(parseCatalogProducts({ products: [{ sku: 'SKU-MUG', name: 'Mug', description: '', priceCents: 1.5 }] }), null);
    assert.equal(
      parseCatalogProducts({
        products: [
          { sku: 'SKU-MUG', name: 'Mug', description: '', priceCents: 1299 },
          { sku: 'SKU-MUG', name: 'Mug again', description: '', priceCents: 1299 },
        ],
      }),
      null,
    );
  });

  it('posts only runId and items and refuses a confirmation that fails the response shape', async () => {
    let seen: unknown;
    const fetchImpl: typeof fetch = async (_input, init) => {
      seen = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ message: 'Order confirmed', totalCents: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const result = await placeOrder(fetchImpl, 'http://127.0.0.1', {
      runId,
      items: [{ sku: 'SKU-MUG', quantity: 1 }],
    });
    assert.deepEqual(seen, { runId, items: [{ sku: 'SKU-MUG', quantity: 1 }] });
    assert.deepEqual(result, { ok: false, reason: 'invalid' });
  });

  it('shows a normal API confirmation without reading the order itself', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    try {
      await withApi(db, async (baseUrl) => {
        const catalog = await loadCatalog(globalThis.fetch, baseUrl);
        assert.equal(catalog.ok, true);
        if (!catalog.ok) {
          return;
        }
        assert.deepEqual(
          catalog.products.map((product) => product.sku),
          ['SKU-MUG', 'SKU-TEE', 'SKU-STK'],
        );

        const placed = await placeOrder(globalThis.fetch, baseUrl, {
          runId,
          items: [
            { sku: 'SKU-MUG', quantity: 2 },
            { sku: 'SKU-STK', quantity: 1 },
          ],
        });
        assert.equal(placed.ok, true);
        if (!placed.ok) {
          return;
        }
        const confirmation = CheckoutConfirmationSchema.parse(placed.confirmation);
        assert.equal(confirmation.totalCents, 2997);
        assert.equal(confirmation.runId, runId);
        assert.equal(confirmation.message, 'Order confirmed');

        const shown = showConfirmation(
          addProduct(ready(catalog.products), 'SKU-MUG'),
          placed.confirmation,
          nextRunId,
        );
        assert.equal(shown.confirmation?.persistenceChecked, false);
        assert.equal(shown.confirmation?.orderId, confirmation.orderId);

        const lookup = await fetch(`${baseUrl}/api/orders/${confirmation.orderId}`);
        const body = OrderLookupResultSchema.parse(await lookup.json());
        assert.equal(body.code, 'FOUND');
        if (body.code !== 'FOUND') {
          return;
        }
        assert.equal(body.order.totalCents, 2997);
      });
    } finally {
      if (db.open) {
        db.close();
      }
    }
  });

  it('does not invent a confirmation for an unknown SKU or a checkout 503', async () => {
    const db = openDatabase(':memory:');
    applySchema(db);
    try {
      await withApi(db, async (baseUrl) => {
        const rejected = await placeOrder(globalThis.fetch, baseUrl, {
          runId,
          items: [{ sku: 'SKU-NOPE', quantity: 1 }],
        });
        assert.deepEqual(rejected, { ok: false, reason: 'rejected' });
        const count = db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number };
        assert.equal(count.count, 0);
      });
      await withApi(undefined, async (baseUrl) => {
        const unavailable = await placeOrder(globalThis.fetch, baseUrl, {
          runId,
          items: [{ sku: 'SKU-MUG', quantity: 1 }],
        });
        assert.deepEqual(unavailable, { ok: false, reason: 'unavailable' });
      });
    } finally {
      if (db.open) {
        db.close();
      }
    }
  });
});
