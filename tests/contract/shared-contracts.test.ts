import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AgentDiagnosisSchema,
  EvidenceRecordSchema,
  GateDecisionSchema,
  CheckoutRequestSchema,
  OrderLookupResultSchema,
  OrderRecordSchema,
  PRODUCT_FIXTURES,
  ProductSchema,
  VerificationStatusSchema,
} from '@tqa/shared';

const runId = '11111111-1111-4111-8111-111111111111';
const observedAt = '2026-10-30T23:41:08.000Z';

describe('shared contracts', () => {
  it('accepts an evidence record, a diagnosis, and a gate decision', () => {
    const evidence = EvidenceRecordSchema.parse({
      evidenceId: 'evidence-1',
      runId,
      source: 'db',
      observedAt,
      kind: 'order-lookup',
      summary: 'Order row was read from SQLite.',
    });
    const diagnosis = AgentDiagnosisSchema.parse({
      runId,
      diagnosis: 'ORDER_NOT_PERSISTED',
      summary: 'The order id was not in the database.',
      claims: [{ text: 'No matching order row.', evidenceIds: [evidence.evidenceId] }],
      missingEvidence: [],
      needsHumanReview: false,
    });
    const decision = GateDecisionSchema.parse({
      runId,
      decision: 'BLOCK',
      reasonCodes: ['ORDER_ABSENT'],
      verificationId: 'verification-1',
      policyVersion: '0',
    });

    assert.equal(diagnosis.claims[0]?.evidenceIds[0], evidence.evidenceId);
    assert.equal(decision.decision, 'BLOCK');
  });

  it('rejects a checkout request with four line items', () => {
    const parsed = CheckoutRequestSchema.safeParse({
      runId,
      items: [
        { sku: 'sku-1', quantity: 1 },
        { sku: 'sku-2', quantity: 1 },
        { sku: 'sku-3', quantity: 1 },
        { sku: 'sku-4', quantity: 1 },
      ],
    });
    assert.equal(parsed.success, false);
  });

  it('rejects a claim with no evidence id and a fourth line item', () => {
    const claim = AgentDiagnosisSchema.safeParse({
      runId,
      diagnosis: 'SUCCESS',
      summary: 'Unsupported claim.',
      claims: [{ text: 'The order exists.', evidenceIds: [] }],
      missingEvidence: [],
      needsHumanReview: true,
    });
    assert.equal(claim.success, false);

    const order = OrderRecordSchema.safeParse({
      orderId: '22222222-2222-4222-8222-222222222222',
      runId,
      totalCents: 100,
      currency: 'USD',
      createdAt: observedAt,
      items: [
        { sku: 'sku-1', quantity: 1, unitPriceCents: 25 },
        { sku: 'sku-2', quantity: 1, unitPriceCents: 25 },
        { sku: 'sku-3', quantity: 1, unitPriceCents: 25 },
        { sku: 'sku-4', quantity: 1, unitPriceCents: 25 },
      ],
    });
    assert.equal(order.success, false);
  });

  it('keeps UNKNOWN distinct from DEFECT and rejects MISSING', () => {
    assert.equal(VerificationStatusSchema.parse('UNKNOWN'), 'UNKNOWN');
    assert.equal(VerificationStatusSchema.parse('DEFECT'), 'DEFECT');
    assert.notEqual(
      VerificationStatusSchema.parse('UNKNOWN'),
      VerificationStatusSchema.parse('DEFECT'),
    );
    assert.equal(VerificationStatusSchema.safeParse('MISSING').success, false);
  });

  it('keeps UNAVAILABLE lookup as 503 and rejects collapsing it into 404', () => {
    const orderId = '22222222-2222-4222-8222-222222222222';
    const unavailable = OrderLookupResultSchema.parse({
      code: 'UNAVAILABLE',
      status: 503,
      orderId,
      reason: 'timeout',
    });
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.code, 'UNAVAILABLE');

    const absent = OrderLookupResultSchema.parse({
      code: 'ABSENT',
      status: 404,
      orderId,
    });
    assert.equal(absent.status, 404);

    assert.equal(
      OrderLookupResultSchema.safeParse({
        code: 'UNAVAILABLE',
        status: 404,
        orderId,
        reason: 'timeout',
      }).success,
      false,
    );
  });

  it('exposes three USD-priced catalog fixtures', () => {
    assert.equal(PRODUCT_FIXTURES.length, 3);
    for (const product of PRODUCT_FIXTURES) {
      assert.equal(ProductSchema.parse(product).sku, product.sku);
      assert.ok(product.priceCents > 0);
    }
  });
});
