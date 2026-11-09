import { EvidenceSourceSchema, OrderLookupResultSchema } from '@tqa/shared';
import * as z from 'zod';

export const READ_ONLY_TOOL_NAMES = [
  'get_test_result',
  'list_evidence',
  'get_network_events',
  'lookup_order',
  'get_application_logs',
] as const;

export const ReadOnlyToolNameSchema = z.enum(READ_ONLY_TOOL_NAMES);

export const DEFAULT_MAX_CALLS = 5;
export const MAX_CALL_BUDGET = 5;
export const DEFAULT_MAX_RECORDS = 20;
export const MAX_RECORD_CAP = 20;
export const DEFAULT_TIMEOUT_MS = 1000;
export const MAX_TIMEOUT_MS = 5000;
export const MAX_SOURCE_ROWS = 100;

const identifierSchema = z.string().min(1).max(200);

export const SuppliedTestResultSchema = z.strictObject({
  evidenceId: identifierSchema,
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  observedAt: z.iso.datetime(),
  coverage: z.enum(['limited-ui', 'independent-oracle', 'repeatability']),
  uiResult: z.enum(['PASS', 'FAIL']),
  uiMessage: z.string().min(1).max(500),
  oracleConsulted: z.boolean(),
  oracleHttpStatus: z.number().int().min(100).max(599).nullable(),
  oracleCode: z.enum(['FOUND', 'ABSENT', 'UNAVAILABLE']).nullable(),
});

export const NetworkEventSchema = z.strictObject({
  eventId: identifierSchema,
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  observedAt: z.iso.datetime(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (value) => value.startsWith('/') && !value.includes('..') && !value.includes('://') && !/[\s\0]/.test(value),
      { message: 'path must be a local path' },
    ),
  httpStatus: z.number().int().min(100).max(599),
});

export const ApplicationLogSchema = z.strictObject({
  logId: identifierSchema,
  runId: z.uuid(),
  observedAt: z.iso.datetime(),
  text: z.string().min(1).max(4000),
});

export const LimitsSchema = z.strictObject({
  maxCalls: z.number().int().min(1).max(MAX_CALL_BUDGET).default(DEFAULT_MAX_CALLS),
  maxRecords: z.number().int().min(1).max(MAX_RECORD_CAP).default(DEFAULT_MAX_RECORDS),
  timeoutMs: z.number().int().min(1).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
});

export const SourcesSchema = z.strictObject({
  testResults: z.array(SuppliedTestResultSchema).max(MAX_SOURCE_ROWS),
  networkEvents: z.array(NetworkEventSchema).max(MAX_SOURCE_ROWS),
  logs: z.array(ApplicationLogSchema).max(MAX_SOURCE_ROWS),
});

const runInput = {
  runId: z.uuid(),
  limit: z.number().int().min(1).max(MAX_RECORD_CAP).optional(),
};

export const GetTestResultInputSchema = z.strictObject({
  runId: z.uuid(),
  evidenceId: identifierSchema.optional(),
});

export const ListEvidenceInputSchema = z.strictObject(runInput);

export const GetNetworkEventsInputSchema = z.strictObject({
  ...runInput,
  orderId: z.uuid().optional(),
});

export const LookupOrderInputSchema = z.strictObject({
  runId: z.uuid(),
  orderId: z.uuid(),
});

export const GetApplicationLogsInputSchema = z.strictObject(runInput);

const toolRecordSchema = z.strictObject({
  recordId: identifierSchema,
  kind: z.string().min(1).max(80),
  summary: z.string().min(1).max(280),
});

const summarySchema = z.string().min(1).max(280);

export const ToolResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('OK'),
    tool: ReadOnlyToolNameSchema,
    observation: z.enum(['LIST', 'TEST_RESULT', 'NETWORK', 'LOGS', 'FOUND', 'ABSENT', 'RUN_MISMATCH']),
    summary: summarySchema,
    records: z.array(toolRecordSchema).max(MAX_RECORD_CAP),
    truncated: z.boolean(),
  }),
  z.strictObject({
    status: z.literal('INVALID_INPUT'),
    tool: ReadOnlyToolNameSchema,
    summary: summarySchema,
  }),
  z.strictObject({
    status: z.literal('TIMEOUT'),
    tool: z.literal('lookup_order'),
    summary: summarySchema,
  }),
  z.strictObject({
    status: z.literal('UNAVAILABLE'),
    tool: ReadOnlyToolNameSchema,
    reason: z.enum(['timeout', 'service_unavailable', 'source_error']),
    summary: summarySchema,
  }),
  z.strictObject({
    status: z.literal('NOT_FOUND'),
    tool: z.literal('get_test_result'),
    summary: summarySchema,
  }),
  z.strictObject({
    status: z.literal('DENIED'),
    tool: z.string().min(1).max(80),
    summary: summarySchema,
  }),
  z.strictObject({
    status: z.literal('LIMIT'),
    tool: z.string().min(1).max(80),
    summary: summarySchema,
  }),
]);

export const EvidenceSummaryInputSchema = z.strictObject({
  evidenceId: identifierSchema,
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  source: EvidenceSourceSchema,
  kind: z.string().min(1).max(80),
  summary: z.string().min(1).max(4000),
  artifactUri: z.string().min(1).max(1024).optional(),
});

export const LookupValueSchema = OrderLookupResultSchema;

export type ReadOnlyToolName = z.infer<typeof ReadOnlyToolNameSchema>;
export type SuppliedTestResult = z.infer<typeof SuppliedTestResultSchema>;
export type NetworkEvent = z.infer<typeof NetworkEventSchema>;
export type ApplicationLog = z.infer<typeof ApplicationLogSchema>;
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type EvidenceSummaryInput = z.infer<typeof EvidenceSummaryInputSchema>;

export interface EvidenceReader {
  summariesForRun(runId: string): readonly EvidenceSummaryInput[];
}

/**
 * Read-only order lookup. The function must not write.
 * It should stop when `signal` is aborted. A 404 from this port is not a 503,
 * and this port is not the independent validator.
 */
export interface OrderLookupPort {
  (request: { runId: string; orderId: string; signal: AbortSignal }): Promise<unknown>;
}

export interface InvestigationSources {
  testResults?: readonly unknown[];
  networkEvents?: readonly unknown[];
  logs?: readonly unknown[];
  evidence: EvidenceReader;
  lookupOrder?: OrderLookupPort;
}

export interface ToolSessionOptions {
  now?: () => Date;
  createId?: () => string;
  maxCalls?: number;
  maxRecords?: number;
  timeoutMs?: number;
}

export interface ToolCallLog {
  callId: string;
  tool: string;
  status: ToolResult['status'];
  startedAt: string;
  finishedAt: string;
  argumentSummary: string;
}
