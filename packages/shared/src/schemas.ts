import { z } from 'zod';

export const testScenarioSchema = z.enum([
  'NORMAL',
  'GHOST_SUCCESS',
  'VERIFICATION_UNAVAILABLE',
]);
export type TestScenario = z.infer<typeof testScenarioSchema>;

export const gateSchema = z.enum(['ALLOW', 'BLOCK', 'HOLD']);
export type Gate = z.infer<typeof gateSchema>;

export const verificationStatusSchema = z.enum([
  'CONFIRMED',
  'DEFECT',
  'UNKNOWN',
]);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const diagnosisSchema = z.enum([
  'SUCCESS',
  'ORDER_NOT_PERSISTED',
  'INCONCLUSIVE',
  'OTHER',
]);
export type Diagnosis = z.infer<typeof diagnosisSchema>;

export const evidenceRecordSchema = z.object({
  evidenceId: z.string().min(1),
  runId: z.string().min(1),
  source: z.enum(['ui', 'api', 'db', 'trace', 'log']),
  observedAt: z.string().datetime(),
  kind: z.string().min(1),
  summary: z.string(),
  artifactUri: z.string().optional(),
});
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

export const agentDiagnosisSchema = z.object({
  runId: z.string().min(1),
  diagnosis: diagnosisSchema,
  summary: z.string(),
  claims: z.array(
    z.object({
      text: z.string(),
      evidenceIds: z.array(z.string()),
    }),
  ),
  missingEvidence: z.array(z.string()),
  needsHumanReview: z.boolean(),
});
export type AgentDiagnosis = z.infer<typeof agentDiagnosisSchema>;

export const gateDecisionSchema = z.object({
  runId: z.string().min(1),
  decision: gateSchema,
  reasonCodes: z.array(z.string()),
  verificationId: z.string().min(1),
  policyVersion: z.string().min(1),
});
export type GateDecision = z.infer<typeof gateDecisionSchema>;

export const checkoutItemSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const checkoutRequestSchema = z.object({
  runId: z.string().min(1),
  items: z.array(checkoutItemSchema).min(1).max(3),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const productSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().positive(),
});
export type Product = z.infer<typeof productSchema>;

export const checkoutConfirmationSchema = z.object({
  orderId: z.string().min(1),
  runId: z.string().min(1),
  message: z.string(),
  totalCents: z.number().int().nonnegative(),
});
export type CheckoutConfirmation = z.infer<typeof checkoutConfirmationSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
