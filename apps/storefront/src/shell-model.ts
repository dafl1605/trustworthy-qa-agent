export const SHELL_VIEW_IDS = ['catalog', 'cart', 'checkout', 'confirmation'] as const;

export type ShellViewId = (typeof SHELL_VIEW_IDS)[number];

export interface ShellView {
  id: ShellViewId;
  label: string;
  heading: string;
  body: string;
  status: string;
  ready: false;
  placesOrder: false;
}

export const SHELL_VIEWS: readonly ShellView[] = [
  {
    id: 'catalog',
    label: 'Catalog',
    heading: 'Catalog',
    body: 'Product cards are not on this screen yet. This scaffold only reserves the catalog section.',
    status: 'Catalog section. Product cards are not available.',
    ready: false,
    placesOrder: false,
  },
  {
    id: 'cart',
    label: 'Cart',
    heading: 'Cart',
    body: 'The cart is empty. Adding items is not part of this scaffold.',
    status: 'Cart section. The cart is empty and checkout is not available.',
    ready: false,
    placesOrder: false,
  },
  {
    id: 'checkout',
    label: 'Checkout',
    heading: 'Checkout',
    body: 'The checkout form is not on this screen yet. Nothing is submitted from this scaffold.',
    status: 'Checkout section. The checkout form is not available.',
    ready: false,
    placesOrder: false,
  },
  {
    id: 'confirmation',
    label: 'Confirmation',
    heading: 'Confirmation',
    body: 'There is no confirmation to show. No order was placed from this scaffold.',
    status: 'Confirmation section. No order was placed.',
    ready: false,
    placesOrder: false,
  },
];

export const UNKNOWN_SECTION = {
  id: 'unknown',
  heading: 'Unknown section',
  body: 'This scaffold has no content for that section and did not place an order.',
  status: 'Unknown section. No order was placed.',
  ready: false,
  placesOrder: false,
} as const;

export interface ResolvedShellSection {
  known: boolean;
  id: ShellViewId | 'unknown';
  label: string;
  heading: string;
  body: string;
  status: string;
  ready: false;
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
