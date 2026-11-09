import assert from 'node:assert/strict';
import { resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import config from './playwright.config.ts';

describe('playwright artifact paths', () => {
  it('keeps traces and the JSON report under the repository test-results directory', () => {
    const repoRoot = resolve(import.meta.dirname, '../..');
    const resultsDir = `${repoRoot}${sep}test-results`;
    assert.equal(config.outputDir, `${resultsDir}${sep}output`);
    const jsonReporter = config.reporter?.[1];
    assert.ok(Array.isArray(jsonReporter));
    assert.equal(jsonReporter[0], 'json');
    const options = jsonReporter[1];
    assert.equal(
      typeof options === 'object' && options !== null && 'outputFile' in options ? options.outputFile : null,
      `${resultsDir}${sep}playwright-report.json`,
    );
    assert.equal(String(config.outputDir).includes(`${sep}tests${sep}e2e${sep}test-results`), false);
  });
});
