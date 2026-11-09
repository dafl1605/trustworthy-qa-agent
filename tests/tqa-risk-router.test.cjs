'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyFiles, makePlan } = require('../.github/scripts/tqa-risk-router.cjs');

test('standard UI change with passing CI does not auto-run AI', () => {
  const plan = makePlan({ files: [{filename: 'apps/storefront/src/App.tsx', additions: 25, deletions: 3}], conclusion: 'success' });
  assert.equal(plan.tier, 'standard-review');
  assert.deepEqual(plan.add, ['tqa-standard-review', 'tqa-ci-passed']);
});

test('validator, domain contracts and CI workflows escalate to Claude', () => {
  for (const filename of ['apps/api/src/validator/index.ts', 'packages/shared/src/contracts.ts', '.github/workflows/tqa-auto-pr.yml']) {
    const plan = makePlan({ files: [{filename, additions: 2}], conclusion: 'success', autoCloudFix: true });
    assert.equal(plan.tier, 'l2-review');
    assert.ok(plan.add.includes('needs-claude-review'));
    assert.ok(!plan.add.includes('cursor-fix-requested'));
  }
});

test('CI failure can trigger one Cloud remediation only when opted in', () => {
  const files = [{filename:'apps/storefront/src/Cart.tsx', additions:15}];
  const first = makePlan({files, conclusion:'failure', autoCloudFix:true});
  assert.ok(first.add.includes('cursor-fix-requested'));
  assert.ok(first.add.includes('tqa-cloud-attempted'));
  const again = makePlan({files, conclusion:'failure', autoCloudFix:true, existingLabels: first.add});
  assert.ok(!again.add.includes('cursor-fix-requested'));
});

test('dry by default: no Cloud label on failed CI', () => {
  const plan = makePlan({files:['apps/storefront/src/Cart.tsx'], conclusion:'failure'});
  assert.ok(plan.add.includes('tqa-ci-failed'));
  assert.ok(!plan.add.includes('cursor-fix-requested'));
});

test('once CI recovers, stale failed label is removed', () => {
  const plan = makePlan({files:['apps/storefront/src/Cart.tsx'], conclusion:'success', existingLabels:['tqa-ci-failed','tqa-standard-review']});
  assert.deepEqual(plan.remove, ['tqa-ci-failed']);
  assert.deepEqual(plan.add, ['tqa-ci-passed']);
});

test('large PR escalates even without protected paths', () => {
  const files = Array.from({length: 26}, (_, i) => ({filename:`apps/storefront/src/component${i}.tsx`, additions:3}));
  assert.equal(classifyFiles(files).tier, 'l2-review');
});
