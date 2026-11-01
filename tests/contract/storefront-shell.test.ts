import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SHELL_VIEWS,
  UNKNOWN_SECTION,
  resolveShellView,
} from '../../apps/storefront/src/shell-model.ts';

const FORBIDDEN = /Order confirmed|GHOST_SUCCESS|VERIFICATION_UNAVAILABLE|\?scenario=/;

describe('storefront shell', () => {
  it('reserves four sections and does not place an order from any of them', () => {
    assert.deepEqual(
      SHELL_VIEWS.map((view) => view.id),
      ['catalog', 'cart', 'checkout', 'confirmation'],
    );

    for (const view of SHELL_VIEWS) {
      const resolved = resolveShellView(view.id);
      assert.equal(resolved.known, true);
      assert.equal(resolved.ready, false);
      assert.equal(resolved.placesOrder, false);
      assert.equal(resolved.label, view.label);
      assert.doesNotMatch(`${resolved.heading} ${resolved.body} ${resolved.status}`, FORBIDDEN);
    }
  });

  it('does not invent a confirmation for an unknown section', () => {
    const resolved = resolveShellView('not-a-section');
    assert.equal(resolved.known, false);
    assert.equal(resolved.id, 'unknown');
    assert.equal(resolved.heading, UNKNOWN_SECTION.heading);
    assert.equal(resolved.ready, false);
    assert.equal(resolved.placesOrder, false);
    assert.match(resolved.status, /No order was placed/);
    assert.doesNotMatch(`${resolved.heading} ${resolved.body} ${resolved.status}`, FORBIDDEN);
  });
});
