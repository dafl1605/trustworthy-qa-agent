export const SHELL_VIEW_IDS = ['catalog', 'cart', 'checkout', 'confirmation'] as const;

export type ShellViewId = (typeof SHELL_VIEW_IDS)[number];

export interface ShellView {
  id: ShellViewId;
  label: string;
  heading: string;
  body: string;
  status: string;
  placesOrder: false;
}

export const SHELL_VIEWS: readonly ShellView[] = [
  {
    id: 'catalog',
    label: 'Catalog',
    heading: 'Catalog',
    body: 'Three demo products. Prices come from the local catalog in integer cents.',
    status: 'Catalog section. Prices are loaded from the local API.',
    placesOrder: false,
  },
  {
    id: 'cart',
    label: 'Cart',
    heading: 'Cart',
    body: 'Up to 3 different products. Quantity per product is 1 to 99.',
    status: 'Cart section. The cart starts empty.',
    placesOrder: false,
  },
  {
    id: 'checkout',
    label: 'Checkout',
    heading: 'Checkout',
    body: 'Checkout submits the cart. The server calculates the total.',
    status: 'Checkout section. The form does not ask for a name or payment.',
    placesOrder: false,
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    heading: 'Confirmation',
    body: 'Shown only after checkout returns a message. That message is not proof the order was saved.',
    status: 'Confirmation section. A returned message is not proof the order was saved.',
    placesOrder: false,
  },
];

export const UNKNOWN_SECTION = {
  id: 'unknown',
  heading: 'Unknown section',
  body: 'This scaffold has no content for that section and did not place an order.',
  status: 'Unknown section. No order was placed.',
  placesOrder: false,
} as const;

export interface ResolvedShellSection {
  known: boolean;
  id: ShellViewId | 'unknown';
  label: string;
  heading: string;
  body: string;
  status: string;
  placesOrder: false;
}

export function isShellViewId(value: string): value is ShellViewId {
  return (SHELL_VIEW_IDS as readonly string[]).includes(value);
}

export function resolveShellView(id: string): ResolvedShellSection {
  const view = SHELL_VIEWS.find((item) => item.id === id);
  if (view === undefined) {
    return { known: false, label: 'Unknown', ...UNKNOWN_SECTION };
  }
  return { known: true, ...view };
}
