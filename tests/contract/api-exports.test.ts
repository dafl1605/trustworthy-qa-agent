import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as api from '@tqa/api';

describe('api public exports', () => {
  it('does not re-export database write utilities from the package root', () => {
    assert.equal('applySchema' in api, false);
    assert.equal('openDatabase' in api, false);
    assert.equal(typeof api.createApp, 'function');
    assert.equal(typeof api.listen, 'function');
    assert.equal(typeof api.readDatabasePath, 'function');
    assert.equal(typeof api.readPort, 'function');
    assert.equal(typeof api.formatLog, 'function');
  });
});
