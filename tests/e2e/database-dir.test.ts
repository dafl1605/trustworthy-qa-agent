import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { removeTemporaryDatabase, temporaryDatabaseDirectory } from './database-dir.ts';

const scratch = mkdtempSync(join(tmpdir(), 'tqa-qa06-path-test-'));

after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('temporary e2e database directory', () => {
  it('accepts only a numeric tqa-qa06 directory directly under the temp root', () => {
    const root = join(scratch, 'tmp');
    const databasePath = join(root, 'tqa-qa06-4242', 'orders.sqlite');
    assert.equal(temporaryDatabaseDirectory(databasePath, root), join(root, 'tqa-qa06-4242'));
    assert.equal(temporaryDatabaseDirectory(join(root, 'tqa-qa06-4242', 'nested', 'orders.sqlite'), root), null);
    assert.equal(temporaryDatabaseDirectory(join(root, 'other', 'orders.sqlite'), root), null);
    assert.equal(temporaryDatabaseDirectory(join(root, 'tqa-qa06-12abc', 'orders.sqlite'), root), null);
    assert.equal(temporaryDatabaseDirectory(join(root, 'tqa-qa06-4242', '..', 'orders.sqlite'), root), null);
    assert.equal(temporaryDatabaseDirectory('', root), null);
  });

  it('removes the matching directory and leaves a lookalike path', () => {
    const root = join(scratch, 'delete');
    const databasePath = join(root, 'tqa-qa06-9001', 'orders.sqlite');
    const decoy = join(root, 'tqa-qa06-keep', 'orders.sqlite');
    mkdirSync(join(root, 'tqa-qa06-9001'), { recursive: true });
    mkdirSync(join(root, 'tqa-qa06-keep'), { recursive: true });
    writeFileSync(databasePath, 'sqlite');
    writeFileSync(decoy, 'keep');
    assert.equal(removeTemporaryDatabase(databasePath, root), true);
    assert.equal(removeTemporaryDatabase(decoy, root), false);
    assert.equal(existsSync(databasePath), false);
    assert.equal(readFileSync(decoy, 'utf8'), 'keep');
  });
});
