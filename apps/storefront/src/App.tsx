import { useEffect, useRef, useState } from 'react';
import { loadCatalog, placeOrder } from './api-client.js';
import {
  addProduct,
  beginCatalogLoad,
  beginCheckout,
  cartItemCount,
  catalogFailed,
  catalogReady,
  checkoutFailed,
  createCommerceState,
  draftCheckout,
  estimateTotalCents,
  formatUsdFromCents,
  rejectCheckoutDraft,
  removeLine,
  setLineQuantity,
  showConfirmation,
  showView,
  type CartLine,
  type CommerceState,
} from './commerce-model.js';
import { SHELL_VIEWS, resolveShellView, type ShellViewId } from './shell-model.js';

const API_BASE = '';

function navLabel(id: ShellViewId, label: string, lines: readonly CartLine[]): string {
  if (id !== 'cart') {
    return label;
  }
  const count = cartItemCount(lines);
  if (count === 0) {
    return label;
  }
  return count === 1 ? 'Cart, 1 item' : `Cart, ${count} items`;
}

function ProductList(props: {
  state: CommerceState;
  onAdd: (sku: string) => void;
}) {
  const { state, onAdd } = props;
  if (state.catalogPhase === 'loading') {
    return <p>Loading products.</p>;
  }
  if (state.catalogPhase === 'failed') {
    return <p>No products are available.</p>;
  }
  if (state.products.length === 0) {
    return <p>No products are available.</p>;
  }
  const locked = state.checkoutPhase === 'submitting';
  return (
    <ul className="product-list">
      {state.products.map((product) => (
        <li key={product.sku}>
          <article aria-labelledby={`product-${product.sku}`}>
            <h3 id={`product-${product.sku}`}>{product.name}</h3>
            <p>{product.description}</p>
            <p>
              {formatUsdFromCents(product.priceCents)}{' '}
              <span className="cents">({product.priceCents} cents)</span>
            </p>
            <button type="button" disabled={locked} onClick={() => onAdd(product.sku)}>
              Add {product.name} to cart
            </button>
          </article>
        </li>
      ))}
    </ul>
  );
}

function QuantityField(props: {
  line: CartLine;
  locked: boolean;
  onQuantity: (sku: string, quantity: number) => void;
}) {
  const { line, locked, onQuantity } = props;
  const [draft, setDraft] = useState(String(line.quantity));
  const fieldId = `qty-${line.sku}`;

  useEffect(() => {
    setDraft(String(line.quantity));
  }, [line.quantity]);

  function commit(raw: string) {
    const next = Number(raw);
    const valid = Number.isInteger(next) && next >= 1 && next <= 99;
    if (!valid) {
      onQuantity(line.sku, next);
      setDraft(String(line.quantity));
      return;
    }
    onQuantity(line.sku, next);
  }

  return (
    <>
      <label htmlFor={fieldId}>Quantity for {line.name}</label>
      <input
        id={fieldId}
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        step={1}
        value={draft}
        disabled={locked}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={(event) => {
          commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          commit(event.currentTarget.value);
        }}
      />
    </>
  );
}

function CartEditor(props: {
  state: CommerceState;
  onQuantity: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
}) {
  const { state, onQuantity, onRemove } = props;
  if (state.lines.length === 0) {
    return <p>The cart is empty.</p>;
  }
  const locked = state.checkoutPhase === 'submitting';
  return (
    <ul className="cart-list">
      {state.lines.map((line) => {
        return (
          <li key={line.sku}>
            <h3>{line.name}</h3>
            <QuantityField line={line} locked={locked} onQuantity={onQuantity} />
            <p>
              Line total {formatUsdFromCents(line.lineCents)}{' '}
              <span className="cents">({line.lineCents} cents)</span>
            </p>
            <button type="button" disabled={locked} onClick={() => onRemove(line.sku)}>
              Remove {line.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CheckoutForm(props: { state: CommerceState; onSubmit: () => void }) {
  const { state, onSubmit } = props;
  const draft = draftCheckout(state);
  const estimate = estimateTotalCents(state.lines);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="correlation-id">Correlation id</label>
      <input
        id="correlation-id"
        readOnly
        value={state.runId}
        aria-describedby="correlation-help"
      />
      <p id="correlation-help">Generated for this checkout attempt. It is not a payment detail.</p>
      {state.lines.length === 0 ? (
        <p>Add a product before placing an order.</p>
      ) : (
        <ul className="checkout-summary">
          {state.lines.map((line) => (
            <li key={line.sku}>
              {line.name}, quantity {line.quantity}, {formatUsdFromCents(line.lineCents)}
            </li>
          ))}
        </ul>
      )}
      <p id="catalog-estimate">
        {estimate === null
          ? 'Catalog estimate is unavailable. The server calculates the charged total.'
          : `Catalog estimate ${formatUsdFromCents(estimate)} (${estimate} cents). The server calculates the charged total.`}
      </p>
      <p>This demo does not collect a name, address, or payment.</p>
      <button type="submit" disabled={!draft.ok} aria-describedby="catalog-estimate">
        Place order
      </button>
    </form>
  );
}

function ConfirmationPanel(props: { state: CommerceState }) {
  const { confirmation } = props.state;
  if (confirmation === null) {
    return <p>No checkout confirmation is available.</p>;
  }
  return (
    <>
      <p>{confirmation.message}</p>
      <dl>
        <div>
          <dt>Order id</dt>
          <dd>{confirmation.orderId}</dd>
        </div>
        <div>
          <dt>Correlation id</dt>
          <dd>{confirmation.runId}</dd>
        </div>
        <div>
          <dt>Server total</dt>
          <dd>
            {formatUsdFromCents(confirmation.totalCents)} ({confirmation.totalCents} cents)
          </dd>
        </div>
      </dl>
      <p className="note">This message is not proof that an order was saved.</p>
    </>
  );
}

export function App() {
  const [state, setState] = useState(() => createCommerceState(crypto.randomUUID()));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);
  const submitting = useRef(false);
  const section = resolveShellView(state.viewId);

  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [state.viewId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((current) => beginCatalogLoad(current));
    void loadCatalog(globalThis.fetch, API_BASE, controller.signal).then((result) => {
      if (!active || (!result.ok && result.reason === 'aborted')) {
        return;
      }
      setState((current) => (result.ok ? catalogReady(current, result.products) : catalogFailed(current)));
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  function showSection(id: ShellViewId) {
    setState((current) => showView(current, id));
  }

  function onPlaceOrder() {
    if (submitting.current) {
      return;
    }
    const draft = draftCheckout(state);
    if (!draft.ok) {
      if (draft.reason === 'submitting') {
        return;
      }
      setState(rejectCheckoutDraft(state, draft.reason));
      return;
    }
    const payload = draft.payload;
    submitting.current = true;
    setState(beginCheckout(state));
    void placeOrder(globalThis.fetch, API_BASE, payload).then((result) => {
      submitting.current = false;
      if (!result.ok && result.reason === 'aborted') {
        return;
      }
      setState((current) => {
        if (current.checkoutPhase !== 'submitting' || current.runId !== payload.runId) {
          return current;
        }
        if (result.ok) {
          return showConfirmation(current, result.confirmation, crypto.randomUUID());
        }
        if (result.reason === 'rejected' || result.reason === 'network' || result.reason === 'invalid') {
          return checkoutFailed(current, result.reason, crypto.randomUUID());
        }
        if (result.reason === 'unavailable') {
          return checkoutFailed(current, 'unavailable', crypto.randomUUID());
        }
        return current;
      });
    });
  }

  const busy = state.catalogPhase === 'loading' || state.checkoutPhase === 'submitting';

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header>
        <p className="eyebrow">Demo store</p>
        <h1>Trustworthy QA Storefront</h1>
        <nav aria-label="Store sections">
          <ul className="section-nav">
            {SHELL_VIEWS.map((view) => {
              const selected = view.id === section.id;
              return (
                <li key={view.id}>
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    aria-controls="store-section"
                    onClick={() => {
                      showSection(view.id);
                    }}
                  >
                    {navLabel(view.id, view.label, state.lines)}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1} aria-busy={busy}>
        <section id="store-section" aria-labelledby="section-heading">
          <h2 id="section-heading" ref={headingRef} tabIndex={-1}>
            {section.heading}
          </h2>
          <p>{section.body}</p>
          {state.viewId === 'catalog' ? (
            <ProductList
              state={state}
              onAdd={(sku) => {
                setState((current) => addProduct(current, sku));
              }}
            />
          ) : null}
          {state.viewId === 'cart' ? (
            <CartEditor
              state={state}
              onQuantity={(sku, quantity) => {
                setState((current) => setLineQuantity(current, sku, quantity));
              }}
              onRemove={(sku) => {
                setState((current) => removeLine(current, sku));
              }}
            />
          ) : null}
          {state.viewId === 'checkout' ? <CheckoutForm state={state} onSubmit={onPlaceOrder} /> : null}
          {state.viewId === 'confirmation' ? <ConfirmationPanel state={state} /> : null}
        </section>
        <p role={state.notice.tone === 'error' ? 'alert' : 'status'}>{state.notice.text}</p>
        <p className="note">A message on this page is not proof that an order was saved.</p>
      </main>
    </div>
  );
}
