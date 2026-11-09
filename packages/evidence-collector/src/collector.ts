import { randomUUID } from 'node:crypto';
import {
  CheckoutConfirmationSchema,
  EvidenceRecordSchema,
  EvidenceSourceSchema,
  type EvidenceRecord,
} from '@tqa/shared';
import * as z from 'zod';
import { EvidenceConflictError, EvidenceValidationError } from './errors.js';
import { prepareSummary, redactText } from './redact.js';
import {
  CheckoutEvidenceArtifactSchema,
  EvidenceDraftSchema,
  OrderLookupInputSchema,
  artifactUriSchema,
  type EvidenceDraft,
} from './schema.js';
import {
  artifactReferenceSummary,
  checkoutResponseSummary,
  draftsFromCheckoutEvidence,
  orderLookupSummary,
  rowCountSummary,
  uiConfirmationSummary,
} from './summaries.js';

export interface OrderCorrelation {
  runId: string;
  orderId: string;
  evidenceIds: string[];
}

export interface EvidenceSummary {
  evidenceId: string;
  runId: string;
  orderId?: string;
  source: EvidenceRecord['source'];
  kind: string;
  summary: string;
  artifactUri?: string;
}

/**
 * RESOLVED means every cited id is already in this index.
 * It does not mean the claim text is true, and it does not authorize ALLOW.
 * An empty citation is UNVERIFIED.
 */
export interface EvidenceCitation {
  status: 'UNVERIFIED' | 'RESOLVED' | 'UNKNOWN_IDS';
  found: EvidenceRecord[];
  unknown: string[];
}

interface PreparedEvidence {
  record: EvidenceRecord;
  orderId?: string;
}

export interface EvidenceCollectorOptions {
  now?: () => Date;
  createId?: () => string;
}

const UiConfirmationInputSchema = z.object({
  runId: z.uuid(),
  orderId: z.uuid(),
  message: z.string().min(1),
  observedAt: z.iso.datetime().optional(),
  evidenceId: z.string().min(1).max(200).optional(),
  artifactUri: artifactUriSchema.optional(),
});

const RowCountInputSchema = z.object({
  runId: z.uuid(),
  orderId: z.uuid(),
  rowCount: z.union([z.literal(0), z.literal(1)]),
  observedAt: z.iso.datetime().optional(),
  evidenceId: z.string().min(1).max(200).optional(),
});

const ArtifactInputSchema = z.object({
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  source: EvidenceSourceSchema,
  kind: z.string().min(1).max(80),
  artifactUri: artifactUriSchema,
  summary: z.string().min(1).optional(),
  observedAt: z.iso.datetime().optional(),
  evidenceId: z.string().min(1).max(200).optional(),
});

const LogInputSchema = z.object({
  runId: z.uuid(),
  orderId: z.uuid().optional(),
  text: z.string().min(1),
  observedAt: z.iso.datetime().optional(),
  evidenceId: z.string().min(1).max(200).optional(),
});

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new EvidenceValidationError();
  }
  return parsed.data;
}

function sameRecord(left: EvidenceRecord, right: EvidenceRecord): boolean {
  return (
    left.evidenceId === right.evidenceId &&
    left.runId === right.runId &&
    left.source === right.source &&
    left.observedAt === right.observedAt &&
    left.kind === right.kind &&
    left.summary === right.summary &&
    left.artifactUri === right.artifactUri
  );
}

/**
 * In-memory evidence index. It normalizes observations and correlates
 * runId with orderId. It does not open SQLite, run a shell, or decide a gate.
 * Log and file text is stored as data, never as an instruction.
 */
export class EvidenceCollector {
  private readonly recordsById = new Map<string, EvidenceRecord>();
  private readonly orderIdByEvidence = new Map<string, string | undefined>();
  private readonly orders = new Map<string, { runId: string; evidenceIds: string[] }>();
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: EvidenceCollectorOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  add(draft: EvidenceDraft): EvidenceRecord {
    const prepared = this.prepare(draft);
    this.assertCanStore(prepared);
    return this.commit(prepared);
  }

  recordUiConfirmation(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(UiConfirmationInputSchema, input);
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.runId,
      orderId: parsed.orderId,
      source: 'ui',
      observedAt: parsed.observedAt,
      kind: 'checkout-ui-confirmation',
      summary: uiConfirmationSummary(parsed.message),
      artifactUri: parsed.artifactUri,
    });
  }

  recordCheckoutResponse(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(
      z.object({
        confirmation: CheckoutConfirmationSchema,
        observedAt: z.iso.datetime().optional(),
        evidenceId: z.string().min(1).max(200).optional(),
        artifactUri: artifactUriSchema.optional(),
      }),
      input,
    );
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.confirmation.runId,
      orderId: parsed.confirmation.orderId,
      source: 'api',
      observedAt: parsed.observedAt,
      kind: 'checkout-response',
      summary: checkoutResponseSummary(parsed.confirmation),
      artifactUri: parsed.artifactUri,
    });
  }

  recordOrderLookup(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(OrderLookupInputSchema, input);
    if (parsed.lookup.code === 'FOUND' && parsed.lookup.order.runId !== parsed.runId) {
      throw new EvidenceConflictError('lookup runId does not match the supplied runId');
    }
    const orderId = parsed.lookup.code === 'FOUND' ? parsed.lookup.order.orderId : parsed.lookup.orderId;
    const kind =
      parsed.lookup.code === 'FOUND'
        ? 'order-lookup-found'
        : parsed.lookup.code === 'ABSENT'
          ? 'order-lookup-absent'
          : 'order-lookup-unavailable';
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.runId,
      orderId,
      source: 'api',
      observedAt: parsed.observedAt,
      kind,
      summary: orderLookupSummary(parsed.lookup),
      artifactUri: parsed.artifactUri,
    });
  }

  recordOrderRowCount(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(RowCountInputSchema, input);
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.runId,
      orderId: parsed.orderId,
      source: 'db',
      observedAt: parsed.observedAt,
      kind: 'orders-row-count',
      summary: rowCountSummary(parsed.orderId, parsed.rowCount),
    });
  }

  recordArtifact(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(ArtifactInputSchema, input);
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.runId,
      orderId: parsed.orderId,
      source: parsed.source,
      observedAt: parsed.observedAt,
      kind: parsed.kind,
      summary: artifactReferenceSummary(parsed.summary),
      artifactUri: parsed.artifactUri,
    });
  }

  recordLog(input: unknown): EvidenceRecord {
    const parsed = parseOrThrow(LogInputSchema, input);
    return this.add({
      evidenceId: parsed.evidenceId,
      runId: parsed.runId,
      orderId: parsed.orderId,
      source: 'log',
      observedAt: parsed.observedAt,
      kind: 'application-log',
      summary: parsed.text,
    });
  }

  ingestCheckoutEvidence(value: unknown): EvidenceRecord[] {
    const artifact = parseOrThrow(CheckoutEvidenceArtifactSchema, value);
    const prepared = draftsFromCheckoutEvidence(artifact).map((draft) => this.prepare(draft));
    this.assertBatch(prepared);
    return prepared.map((item) => this.commit(item));
  }

  ingestCheckoutEvidenceJson(text: string): EvidenceRecord[] {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new EvidenceValidationError();
    }
    return this.ingestCheckoutEvidence(value);
  }

  records(): EvidenceRecord[] {
    return [...this.recordsById.values()];
  }

  recordsForRun(runId: string): EvidenceRecord[] {
    return this.records().filter((record) => record.runId === runId);
  }

  correlationForOrder(orderId: string): OrderCorrelation | undefined {
    const link = this.orders.get(orderId);
    if (!link) {
      return undefined;
    }
    return { orderId, runId: link.runId, evidenceIds: [...link.evidenceIds] };
  }

  summariesForRun(runId: string): EvidenceSummary[] {
    return this.recordsForRun(runId).map((record) => {
      const orderId = this.orderIdByEvidence.get(record.evidenceId);
      return {
        evidenceId: record.evidenceId,
        runId: record.runId,
        ...(orderId ? { orderId } : {}),
        source: record.source,
        kind: record.kind,
        summary: record.summary,
        ...(record.artifactUri ? { artifactUri: record.artifactUri } : {}),
      };
    });
  }

  resolve(evidenceIds: readonly string[]): { found: EvidenceRecord[]; unknown: string[] } {
    const found: EvidenceRecord[] = [];
    const unknown: string[] = [];
    const seen = new Set<string>();
    for (const evidenceId of evidenceIds) {
      if (seen.has(evidenceId)) {
        continue;
      }
      seen.add(evidenceId);
      const record = this.recordsById.get(evidenceId);
      if (record) {
        found.push(record);
      } else {
        unknown.push(evidenceId);
      }
    }
    return { found, unknown };
  }

  citation(evidenceIds: readonly string[]): EvidenceCitation {
    if (evidenceIds.length === 0) {
      return { status: 'UNVERIFIED', found: [], unknown: [] };
    }
    const resolved = this.resolve(evidenceIds);
    if (resolved.unknown.length > 0) {
      return { status: 'UNKNOWN_IDS', found: resolved.found, unknown: resolved.unknown };
    }
    return { status: 'RESOLVED', found: resolved.found, unknown: [] };
  }

  private prepare(draft: EvidenceDraft): PreparedEvidence {
    const parsed = parseOrThrow(EvidenceDraftSchema, draft);
    const summary = prepareSummary(parsed.source, parsed.summary);
    if (summary.length === 0) {
      throw new EvidenceValidationError();
    }
    let artifactUri: string | undefined;
    if (parsed.artifactUri) {
      artifactUri = redactText(parsed.artifactUri);
      if (artifactUri.length === 0 || /[\s\0]/.test(artifactUri)) {
        throw new EvidenceValidationError();
      }
    }
    const record = parseOrThrow(EvidenceRecordSchema, {
      evidenceId: parsed.evidenceId ?? `ev-${this.createId()}`,
      runId: parsed.runId,
      source: parsed.source,
      observedAt: parsed.observedAt ?? this.now().toISOString(),
      kind: parsed.kind,
      summary,
      ...(artifactUri ? { artifactUri } : {}),
    });
    return { record, orderId: parsed.orderId };
  }

  private assertBatch(prepared: readonly PreparedEvidence[]): void {
    const seen = new Set<string>();
    const batchOrders = new Map<string, string>();
    for (const item of prepared) {
      if (seen.has(item.record.evidenceId)) {
        throw new EvidenceConflictError('evidence id already exists with different content');
      }
      seen.add(item.record.evidenceId);
      if (item.orderId) {
        const runId = batchOrders.get(item.orderId);
        if (runId && runId !== item.record.runId) {
          throw new EvidenceConflictError('orderId is already correlated to a different runId');
        }
        batchOrders.set(item.orderId, item.record.runId);
      }
      this.assertCanStore(item);
    }
  }

  private assertCanStore(prepared: PreparedEvidence): void {
    const current = this.recordsById.get(prepared.record.evidenceId);
    if (current) {
      const sameOrder = this.orderIdByEvidence.get(prepared.record.evidenceId) === prepared.orderId;
      if (!sameRecord(current, prepared.record) || !sameOrder) {
        throw new EvidenceConflictError('evidence id already exists with different content');
      }
      return;
    }
    if (!prepared.orderId) {
      return;
    }
    const link = this.orders.get(prepared.orderId);
    if (link && link.runId !== prepared.record.runId) {
      throw new EvidenceConflictError('orderId is already correlated to a different runId');
    }
  }

  private commit(prepared: PreparedEvidence): EvidenceRecord {
    const current = this.recordsById.get(prepared.record.evidenceId);
    if (current) {
      return current;
    }
    this.recordsById.set(prepared.record.evidenceId, prepared.record);
    this.orderIdByEvidence.set(prepared.record.evidenceId, prepared.orderId);
    if (prepared.orderId) {
      const link = this.orders.get(prepared.orderId);
      if (link) {
        link.evidenceIds.push(prepared.record.evidenceId);
      } else {
        this.orders.set(prepared.orderId, {
          runId: prepared.record.runId,
          evidenceIds: [prepared.record.evidenceId],
        });
      }
    }
    return prepared.record;
  }
}
