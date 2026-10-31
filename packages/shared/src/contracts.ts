import * as z from 'zod';

export const TestScenarioSchema = z.enum([
  'NORMAL',
  'GHOST_SUCCESS',
  'VERIFICATION_UNAVAILABLE',
]);

export const GateSchema = z.enum(['ALLOW', 'BLOCK', 'HOLD']);

export const VerificationStatusSchema = z.enum(['CONFIRMED', 'DEFECT', 'UNKNOWN']);

export const DiagnosisSchema = z.enum([
  'SUCCESS',
  'ORDER_NOT_PERSISTED',
  'INCONCLUSIVE',
  'OTHER',
]);

export const EvidenceSourceSchema = z.enum(['ui', 'api', 'db', 'trace', 'log']);

export const EvidenceRecordSchema = z.object({
  evidenceId: z.string().min(1),
  runId: z.uuid(),
  source: EvidenceSourceSchema,
  observedAt: z.iso.datetime(),
  kind: z.string().min(1),
  summary: z.string().min(1),
  artifactUri: z.string().min(1).optional(),
});

export const DiagnosisClaimSchema = z.object({
  text: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

export const AgentDiagnosisSchema = z.object({
  runId: z.uuid(),
  diagnosis: DiagnosisSchema,
  summary: z.string().min(1),
  claims: z.array(DiagnosisClaimSchema),
  missingEvidence: z.array(z.string().min(1)),
  needsHumanReview: z.boolean(),
});

export const GateDecisionSchema = z.object({
  runId: z.uuid(),
  decision: GateSchema,
  reasonCodes: z.array(z.string().min(1)).min(1),
  verificationId: z.string().min(1),
  policyVersion: z.string().min(1),
});

export const OrderItemRecordSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});

export const OrderRecordSchema = z.object({
  orderId: z.uuid(),
  runId: z.uuid(),
  totalCents: z.number().int().nonnegative(),
  currency: z.literal('USD'),
  createdAt: z.iso.datetime(),
  items: z.array(OrderItemRecordSchema).min(1).max(3),
});

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('trustworthy-qa-api'),
});

export const CheckoutItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const CheckoutRequestSchema = z.object({
  runId: z.uuid(),
  items: z.array(CheckoutItemSchema).min(1).max(3),
});

export const ProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().positive(),
});

export const CheckoutConfirmationSchema = z.object({
  orderId: z.uuid(),
  runId: z.uuid(),
  message: z.string().min(1),
  totalCents: z.number().int().nonnegative(),
});

/**
 * Authoritative order lookup. 404 ABSENT is a verified missing order.
 * 503 UNAVAILABLE is UNKNOWN and must never be collapsed into ABSENT.
 */
export const OrderLookupResultSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('FOUND'),
    status: z.literal(200),
    order: OrderRecordSchema,
  }),
  z.object({
    code: z.literal('ABSENT'),
    status: z.literal(404),
    orderId: z.uuid(),
  }),
  z.object({
    code: z.literal('UNAVAILABLE'),
    status: z.literal(503),
    orderId: z.uuid(),
    reason: z.enum(['timeout', 'service_unavailable']),
  }),
]);

export type TestScenario = z.infer<typeof TestScenarioSchema>;
export type Gate = z.infer<typeof GateSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type Diagnosis = z.infer<typeof DiagnosisSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type AgentDiagnosis = z.infer<typeof AgentDiagnosisSchema>;
export type GateDecision = z.infer<typeof GateDecisionSchema>;
export type OrderItemRecord = z.infer<typeof OrderItemRecordSchema>;
export type OrderRecord = z.infer<typeof OrderRecordSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type CheckoutConfirmation = z.infer<typeof CheckoutConfirmationSchema>;
export type OrderLookupResult = z.infer<typeof OrderLookupResultSchema>;

export const PRODUCT_FIXTURES: readonly Product[] = [
  {
    sku: 'SKU-MUG',
    name: 'Ceramic Mug',
    description: 'Demo mug. No real storefront catalog yet.',
    priceCents: 1299,
  },
  {
    sku: 'SKU-TEE',
    name: 'Cotton T-Shirt',
    description: 'Demo shirt. Price is integer cents.',
    priceCents: 2499,
  },
  {
    sku: 'SKU-STK',
    name: 'Sticker Pack',
    description: 'Demo stickers. Three fixtures total.',
    priceCents: 399,
  },
];
