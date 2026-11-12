import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createApp, listen } from '@tqa/api';
import { applySchema, openDatabase } from '@tqa/api/migrate';
import { READ_ONLY_TOOL_NAMES, checkModelDiagnosis } from '@tqa/qa-agent';
import { decideRelease } from '@tqa/quality-gate';
import {
  CheckoutConfirmationSchema,
  OrderLookupResultSchema,
  type TestScenario,
} from '@tqa/shared';
import { pipelineProblems, runDemoPipeline, type DemoPipelineRun } from '../e2e/demo-pipeline-core.ts';

const token = 'tqa-test-token';

async function withFileApi(run: (ctx: { baseUrl: string; databasePath: string }) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'tqa-qa-r3-'));
  const databasePath = join(dir, 'orders.sqlite');
  const db = openDatabase(databasePath);
  applySchema(db);
  const server: Server = createApp({ database: db, harness: { token } });
  await listen(server, 0);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a loopback TCP address');
  }
  try {
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, databasePath });
  } finally {
    server.close();
    await once(server, 'close');
    if (db.open) {
      db.close();
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

async function resetRun(baseUrl: string, runId: string): Promise<void> {
  const response = await fetch(`${baseUrl}/harness/runs/${runId}/reset`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tqa-harness-token': token,
    },
  });
  assert.equal(response.status, 200);
  const again = await fetch(`${baseUrl}/harness/runs/${runId}/reset`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tqa-harness-token': token,
    },
  });
  assert.equal(again.status, 200);
}

async function arm(baseUrl: string, runId: string, scenario: TestScenario): Promise<void> {
  await resetRun(baseUrl, runId);
  const response = await fetch(`${baseUrl}/harness/runs/${runId}/scenario`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tqa-harness-token': token,
    },
    body: JSON.stringify({ scenario }),
  });
  assert.equal(response.status, 200);
}

async function placeOrder(baseUrl: string, runId: string, scenario: TestScenario): Promise<{ orderId: string; message: string }> {
  await arm(baseUrl, runId, scenario);
  const response = await fetch(`${baseUrl}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      runId,
      items: [{ sku: 'SKU-MUG', quantity: 1 }],
    }),
  });
  assert.equal(response.status, 200);
  const confirmation = CheckoutConfirmationSchema.parse(await response.json());
  assert.equal(confirmation.runId, runId);
  assert.equal(confirmation.message, 'Order confirmed');
  return { orderId: confirmation.orderId, message: confirmation.message };
}

describe('demo pipeline', () => {
  it('keeps the scripted agent off the gate for all three modes', async () => {
    const runs = {
      NORMAL: '11111111-1111-4111-8111-111111111111',
      GHOST_SUCCESS: '22222222-2222-4222-8222-222222222222',
      VERIFICATION_UNAVAILABLE: '33333333-3333-4333-8333-333333333333',
    } as const satisfies Record<TestScenario, string>;

    await withFileApi(async ({ baseUrl, databasePath }) => {
      const completed: DemoPipelineRun[] = [];
      for (const scenario of ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'] as const) {
        const placed = await placeOrder(baseUrl, runs[scenario], scenario);
        const response = await fetch(`${baseUrl}/api/orders/${placed.orderId}`);
        const lookup = OrderLookupResultSchema.parse(await response.json());
        assert.equal(lookup.status, response.status);
        const run = await runDemoPipeline({
          scenario,
          runId: runs[scenario],
          orderId: placed.orderId,
          screenText: placed.message,
          lookup,
          databasePath,
        });
        completed.push(run);
        assert.equal(run.report.orderClassified, false);
        assert.equal(run.report.gateDecision, null);
        assert.equal(run.report.resultOrigin, 'scripted-mock');
        assert.equal(run.checked.releaseAuthorized, false);
        assert.equal(run.checked.gateDecision, null);
        const wrapped = checkModelDiagnosis({
          runId: run.row.runId,
          evidence: run.evidence,
          modelOutput: run.report.untrustedFinalText,
        });
        assert.equal(wrapped.parseStatus, 'UNPARSEABLE');
      }

      assert.deepEqual(pipelineProblems(completed.map((run) => run.row)), []);
      const ghost = completed[1];
      const unavailable = completed[2];
      assert.ok(ghost);
      assert.ok(unavailable);
      assert.equal(ghost.row.gate, 'BLOCK');
      assert.deepEqual(ghost.row.reasonCodes, ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED']);
      assert.equal(unavailable.row.gate, 'HOLD');
      assert.equal(unavailable.row.lookupStatus === 503 && unavailable.row.lookupCode === 'ABSENT', false);
      assert.notEqual(unavailable.row.gate, 'BLOCK');

      const forged = checkModelDiagnosis({
        runId: ghost.row.runId,
        evidence: ghost.evidence,
        modelOutput: {
          runId: ghost.row.runId,
          diagnosis: 'SUCCESS',
          summary: 'The stored lookup found this order.',
          claims: [{ text: 'The stored lookup found this order.', evidenceIds: ['forged-evidence-not-in-index'] }],
          missingEvidence: [],
          needsHumanReview: false,
        },
      });
      assert.equal(forged.claims[0]?.citation, 'UNKNOWN_IDS');
      assert.equal(forged.claims[0]?.support, 'UNKNOWN');
      assert.notEqual(forged.checkedDiagnosis, 'SUCCESS');
      assert.equal(forged.releaseAuthorized, false);
      assert.equal(forged.gateDecision, null);
      const stillBlocked = decideRelease({
        verification: ghost.verification,
        diagnosis: {
          runId: ghost.row.runId,
          diagnosis: 'SUCCESS',
          summary: 'The stored lookup found this order.',
          claims: [{ text: 'The stored lookup found this order.', evidenceIds: ['forged-evidence-not-in-index'] }],
          missingEvidence: [],
          needsHumanReview: false,
        },
      });
      assert.equal(stillBlocked.decision, 'BLOCK');
      assert.deepEqual([...stillBlocked.reasonCodes], ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED']);

      const shell = await ghost.session.call('shell', { command: 'id' });
      const write = await ghost.session.call('write_database', { sql: 'DROP TABLE orders' });
      assert.equal(shell.status, 'DENIED');
      assert.equal(write.status, 'DENIED');
      assert.equal((READ_ONLY_TOOL_NAMES as readonly string[]).includes('shell'), false);
      assert.equal((READ_ONLY_TOOL_NAMES as readonly string[]).includes('write_database'), false);
      assert.equal(JSON.stringify(ghost.report).includes('child_process'), false);
      const source = readFileSync(fileURLToPath(new URL('../e2e/demo-pipeline-core.ts', import.meta.url)), 'utf8');
      assert.equal(source.includes('child_process'), false);
      assert.equal(source.includes('writeFile'), false);
      assert.equal(source.includes('createOpenAiCompatibleProvider'), false);
    });
  });

  it('rejects a row that stores a 503 as a missing order', () => {
    const problems = pipelineProblems([
      {
        mode: 'NORMAL',
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        runId: '11111111-1111-4111-8111-111111111111',
        screenText: 'Order confirmed',
        scriptedDiagnosis: 'SUCCESS',
        evidenceCheck: 'CITED',
        lookupStatus: 200,
        lookupCode: 'FOUND',
        unavailableReason: null,
        verification: 'CONFIRMED',
        gate: 'ALLOW',
        reasonCodes: ['VERIFICATION_CONFIRMED'],
        provider: 'scripted-mock',
        modelInvoked: false,
        measuredFromModel: false,
        policyVersion: 'tqa-gate-1',
        investigationOrderClassified: false,
        investigationGateDecision: null,
      },
      {
        mode: 'GHOST_SUCCESS',
        orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        runId: '22222222-2222-4222-8222-222222222222',
        screenText: 'Order confirmed',
        scriptedDiagnosis: 'SUCCESS',
        evidenceCheck: 'UNVERIFIED',
        lookupStatus: 404,
        lookupCode: 'ABSENT',
        unavailableReason: null,
        verification: 'DEFECT',
        gate: 'ALLOW',
        reasonCodes: ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED'],
        provider: 'scripted-mock',
        modelInvoked: false,
        measuredFromModel: false,
        policyVersion: 'tqa-gate-1',
        investigationOrderClassified: false,
        investigationGateDecision: null,
      },
      {
        mode: 'VERIFICATION_UNAVAILABLE',
        orderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        runId: '33333333-3333-4333-8333-333333333333',
        screenText: 'Order confirmed',
        scriptedDiagnosis: 'ORDER_NOT_PERSISTED',
        evidenceCheck: 'UNKNOWN',
        lookupStatus: 503,
        lookupCode: 'ABSENT',
        unavailableReason: 'service_unavailable',
        verification: 'UNKNOWN',
        gate: 'HOLD',
        reasonCodes: ['VERIFICATION_UNKNOWN', 'DIAGNOSIS_IGNORED'],
        provider: 'scripted-mock',
        modelInvoked: false,
        measuredFromModel: false,
        policyVersion: 'tqa-gate-1',
        investigationOrderClassified: false,
        investigationGateDecision: null,
      },
    ]);
    assert.ok(problems.some((problem) => problem.includes('GHOST_SUCCESS gate')));
    assert.ok(problems.some((problem) => problem.includes('collapsed 503 into ABSENT')));
  });
});
