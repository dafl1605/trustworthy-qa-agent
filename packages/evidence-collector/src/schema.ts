import {
  EvidenceSourceSchema,
  OrderLookupResultSchema,
  TestScenarioSchema,
} from '@tqa/shared';
import * as z from 'zod';

const identifierSchema = z.string().min(1).max(200).refine((value) => !/\s/.test(value));

export const artifactUriSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !/[\s\0]/.test(value));

export const EvidenceDraftSchema = z.object({
  evidenceId: identifierSchema.optional(),
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  source: EvidenceSourceSchema,
  observedAt: z.iso.datetime().optional(),
  kind: z.string().min(1).max(80),
  summary: z.string().min(1),
  artifactUri: artifactUriSchema.optional(),
});

export const CheckoutEvidenceArtifactSchema = z.object({
  evidenceId: identifierSchema,
  runId: z.uuid(),
  orderId: z.uuid(),
  scenario: TestScenarioSchema,
  observedAt: z.iso.datetime(),
  coverage: z.enum(['limited-ui', 'independent-oracle', 'repeatability']),
  summary: z.string().min(1),
  ui: z.object({
    result: z.enum(['PASS', 'FAIL']),
    message: z.string().min(1),
  }),
  oracle: z.object({
    consulted: z.boolean(),
    httpStatus: z.number().int().nullable(),
    code: z.enum(['FOUND', 'ABSENT', 'UNAVAILABLE']).nullable(),
    verificationStatus: z.enum(['CONFIRMED', 'DEFECT', 'UNKNOWN', 'NOT_CONSULTED']),
    assertion: z.enum(['PASS', 'FAIL', 'INCONCLUSIVE', 'NOT_CONSULTED']),
    totalCents: z.number().int().nullable(),
  }),
});

export const OrderLookupInputSchema = z.object({
  runId: z.uuid(),
  lookup: OrderLookupResultSchema,
  observedAt: z.iso.datetime().optional(),
  evidenceId: identifierSchema.optional(),
  artifactUri: artifactUriSchema.optional(),
});

export type EvidenceDraft = z.infer<typeof EvidenceDraftSchema>;
export type CheckoutEvidenceArtifact = z.infer<typeof CheckoutEvidenceArtifactSchema>;
