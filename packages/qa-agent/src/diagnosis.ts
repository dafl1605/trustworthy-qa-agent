import { redactText } from '@tqa/evidence-collector';
import {
  AgentDiagnosisSchema,
  DiagnosisSchema,
  EvidenceRecordSchema,
  type Diagnosis,
  type EvidenceRecord,
} from '@tqa/shared';
import * as z from 'zod';
import { DiagnosisConfigError } from './errors.js';

const TEXT_LIMIT = 280;
const MAX_CLAIMS = 20;
const MAX_IDS = 20;
const MAX_MODEL_CHARS = 8_000;
const DIAGNOSIS_KEYS = ['runId', 'diagnosis', 'summary', 'claims', 'missingEvidence', 'needsHumanReview'];
const CLAIM_KEYS = ['text', 'evidenceIds'];

const CitationSchema = z.strictObject({
  status: z.enum(['UNVERIFIED', 'RESOLVED', 'UNKNOWN_IDS']),
  found: z.array(EvidenceRecordSchema),
  unknown: z.array(z.string().min(1)),
});

export const ClaimCheckSchema = z.strictObject({
  text: z.string().min(1).max(TEXT_LIMIT),
  evidenceIds: z.array(z.string().min(1).max(200)).max(MAX_IDS),
  citation: z.enum(['UNVERIFIED', 'RESOLVED', 'UNKNOWN_IDS']),
  support: z.enum(['UNVERIFIED', 'UNKNOWN', 'CITED']),
  unknownEvidenceIds: z.array(z.string().min(1).max(200)).max(MAX_IDS),
});

export const CheckedDiagnosisSchema = z.strictObject({
  runId: z.uuid(),
  parseStatus: z.enum(['PARSED', 'UNPARSEABLE', 'RUN_MISMATCH']),
  modelDiagnosis: DiagnosisSchema.nullable(),
  checkedDiagnosis: DiagnosisSchema.nullable(),
  summary: z.string().min(1).max(TEXT_LIMIT).nullable(),
  claims: z.array(ClaimCheckSchema).max(MAX_CLAIMS),
  missingEvidence: z.array(z.string().min(1).max(TEXT_LIMIT)).max(MAX_IDS),
  needsHumanReview: z.boolean(),
  releaseAuthorized: z.literal(false),
  gateDecision: z.null(),
});

export type CheckedDiagnosis = z.infer<typeof CheckedDiagnosisSchema>;
export type ClaimCheck = z.infer<typeof ClaimCheckSchema>;

export interface DiagnosisEvidenceIndex {
  citation(evidenceIds: readonly string[]): {
    status: 'UNVERIFIED' | 'RESOLVED' | 'UNKNOWN_IDS';
    found: readonly EvidenceRecord[];
    unknown: readonly string[];
  };
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function echoed(value: string): string | null {
  const redacted = redactText(value).replace(/\s+/g, ' ').trim();
  if (redacted.length === 0 || redacted.length > TEXT_LIMIT) {
    return null;
  }
  return redacted;
}

function blank(runId: string, parseStatus: 'UNPARSEABLE' | 'RUN_MISMATCH'): CheckedDiagnosis {
  return CheckedDiagnosisSchema.parse({
    runId,
    parseStatus,
    modelDiagnosis: null,
    checkedDiagnosis: null,
    summary: null,
    claims: [],
    missingEvidence: [],
    needsHumanReview: true,
    releaseAuthorized: false,
    gateDecision: null,
  });
}

function readCandidate(modelOutput: unknown): unknown {
  if (typeof modelOutput === 'string') {
    const trimmed = modelOutput.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_MODEL_CHARS || trimmed.startsWith('[UNTRUSTED_TEXT:')) {
      return null;
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  if (modelOutput === null || typeof modelOutput !== 'object' || Array.isArray(modelOutput)) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(modelOutput)) as unknown;
  } catch {
    return null;
  }
}

function closedObject(candidate: unknown): Record<string, unknown> | null {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }
  if (!hasExactKeys(candidate, DIAGNOSIS_KEYS)) {
    return null;
  }
  const claims: unknown = Reflect.get(candidate, 'claims');
  if (!Array.isArray(claims)) {
    return null;
  }
  for (const claim of claims) {
    if (claim === null || typeof claim !== 'object' || Array.isArray(claim)) {
      return null;
    }
    if (!hasExactKeys(claim, CLAIM_KEYS)) {
      return null;
    }
  }
  return candidate as Record<string, unknown>;
}

type Fact = 'FOUND' | 'ABSENT';

const INSTRUCTION_TEXT = /\b(?:ALLOW|BLOCK|HOLD)\b|ignore previous instructions/i;

function factOf(kind: string): Fact | 'UNKNOWN_FACT' | 'NON_FACT' {
  if (kind === 'order-lookup-found') {
    return 'FOUND';
  }
  if (kind === 'order-lookup-absent') {
    return 'ABSENT';
  }
  if (
    kind === 'order-lookup-unavailable' ||
    kind === 'order-lookup-inconsistent' ||
    kind === 'order-lookup-run-mismatch'
  ) {
    return 'UNKNOWN_FACT';
  }
  return 'NON_FACT';
}

function readCitation(
  evidence: DiagnosisEvidenceIndex,
  evidenceIds: readonly string[],
): z.infer<typeof CitationSchema> {
  let raw: ReturnType<DiagnosisEvidenceIndex['citation']>;
  try {
    raw = evidence.citation(evidenceIds);
  } catch {
    throw new DiagnosisConfigError();
  }
  const parsed = CitationSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DiagnosisConfigError();
  }
  const citation = parsed.data;
  if (evidenceIds.length === 0) {
    if (citation.status !== 'UNVERIFIED' || citation.found.length > 0 || citation.unknown.length > 0) {
      throw new DiagnosisConfigError();
    }
    return citation;
  }
  if (citation.status === 'UNVERIFIED') {
    throw new DiagnosisConfigError();
  }
  if (citation.status === 'UNKNOWN_IDS' && citation.unknown.length === 0) {
    throw new DiagnosisConfigError();
  }
  if (citation.status === 'RESOLVED' && citation.unknown.length > 0) {
    throw new DiagnosisConfigError();
  }
  return citation;
}

function citedOrUnverified(text: string, support: 'CITED'): 'CITED' | 'UNVERIFIED' {
  return INSTRUCTION_TEXT.test(text) ? 'UNVERIFIED' : support;
}

function supportFor(
  citation: z.infer<typeof CitationSchema>,
  evidenceIds: readonly string[],
  runId: string,
  modelDiagnosis: Diagnosis,
  claimText: string,
  forceUnknown: boolean,
): Pick<ClaimCheck, 'citation' | 'support' | 'unknownEvidenceIds'> {
  const unknownEvidenceIds = citation.unknown.flatMap((id) => {
    const safe = echoed(id);
    return safe === null ? [] : [safe];
  });
  if (forceUnknown) {
    return {
      citation: evidenceIds.length === 0 ? 'UNVERIFIED' : citation.status,
      support: 'UNKNOWN',
      unknownEvidenceIds,
    };
  }
  if (evidenceIds.length === 0) {
    return { citation: 'UNVERIFIED', support: 'UNVERIFIED', unknownEvidenceIds: [] };
  }
  if (citation.status === 'UNKNOWN_IDS') {
    return { citation: 'UNKNOWN_IDS', support: 'UNKNOWN', unknownEvidenceIds };
  }
  let fact: Fact | null = null;
  for (const record of citation.found) {
    if (record.runId !== runId) {
      return { citation: 'RESOLVED', support: 'UNKNOWN', unknownEvidenceIds: [] };
    }
    const signal = factOf(record.kind);
    if (signal === 'UNKNOWN_FACT') {
      return { citation: 'RESOLVED', support: 'UNKNOWN', unknownEvidenceIds: [] };
    }
    if (signal === 'NON_FACT') {
      continue;
    }
    if (fact === null) {
      fact = signal;
      continue;
    }
    if (fact !== signal) {
      return { citation: 'RESOLVED', support: 'UNKNOWN', unknownEvidenceIds: [] };
    }
  }
  if (fact === 'FOUND' && modelDiagnosis === 'SUCCESS') {
    return { citation: 'RESOLVED', support: citedOrUnverified(claimText, 'CITED'), unknownEvidenceIds: [] };
  }
  if (fact === 'ABSENT' && modelDiagnosis === 'ORDER_NOT_PERSISTED') {
    return {
      citation: 'RESOLVED',
      support: citedOrUnverified(claimText, 'CITED'),
      unknownEvidenceIds: [],
    };
  }
  return { citation: 'RESOLVED', support: 'UNVERIFIED', unknownEvidenceIds: [] };
}

function assessClaims(
  evidence: DiagnosisEvidenceIndex,
  claims: { text: string; evidenceIds: string[] }[],
  runId: string,
  modelDiagnosis: Diagnosis,
  forceUnknown: boolean,
): ClaimCheck[] | null {
  const checks: ClaimCheck[] = [];
  for (const claim of claims) {
    const text = echoed(claim.text);
    if (text === null) {
      return null;
    }
    const evidenceIds: string[] = [];
    for (const evidenceId of claim.evidenceIds) {
      const safe = echoed(evidenceId);
      if (safe === null) {
        return null;
      }
      evidenceIds.push(safe);
    }
    const citation = readCitation(evidence, claim.evidenceIds);
    checks.push({
      text,
      evidenceIds,
      ...supportFor(citation, claim.evidenceIds, runId, modelDiagnosis, text, forceUnknown),
    });
  }
  return checks;
}

function echoedList(values: readonly string[]): string[] | null {
  const echoedValues: string[] = [];
  for (const value of values) {
    const safe = echoed(value);
    if (safe === null) {
      return null;
    }
    echoedValues.push(safe);
  }
  return echoedValues;
}

/**
 * Parse one model diagnosis and compare its claims with an evidence index.
 * A matching lookup kind can keep the model's label. It does not decide a gate.
 * Empty citations and UI-only citations stay UNVERIFIED. Unknown ids, a 503,
 * a timeout, or mixed lookup kinds stay UNKNOWN and the checked label abstains.
 */
export function checkModelDiagnosis(input: {
  runId: string;
  modelOutput: unknown;
  evidence: DiagnosisEvidenceIndex;
}): CheckedDiagnosis {
  if (input === null || typeof input !== 'object') {
    throw new DiagnosisConfigError();
  }
  const runId = z.uuid().safeParse(input.runId);
  if (!runId.success) {
    throw new DiagnosisConfigError();
  }
  if (typeof input.evidence?.citation !== 'function') {
    throw new DiagnosisConfigError();
  }

  const candidate = closedObject(readCandidate(input.modelOutput));
  if (candidate === null) {
    return blank(runId.data, 'UNPARSEABLE');
  }
  const parsed = AgentDiagnosisSchema.safeParse(candidate);
  if (!parsed.success) {
    return blank(runId.data, 'UNPARSEABLE');
  }
  if (
    parsed.data.claims.length > MAX_CLAIMS ||
    parsed.data.missingEvidence.length > MAX_IDS ||
    parsed.data.claims.some((claim) => claim.evidenceIds.length > MAX_IDS) ||
    echoed(parsed.data.summary) === null
  ) {
    return blank(runId.data, 'UNPARSEABLE');
  }

  const forceUnknown = parsed.data.runId !== runId.data;
  const claims = assessClaims(
    input.evidence,
    parsed.data.claims,
    runId.data,
    parsed.data.diagnosis,
    forceUnknown,
  );
  const summary = echoed(parsed.data.summary);
  const missingEvidence = echoedList(parsed.data.missingEvidence);
  if (claims === null || summary === null || missingEvidence === null) {
    return blank(runId.data, 'UNPARSEABLE');
  }

  const unknownIds = claims.flatMap((claim) => claim.unknownEvidenceIds);
  const combinedMissing = [...missingEvidence];
  for (const evidenceId of unknownIds) {
    if (!combinedMissing.includes(evidenceId) && combinedMissing.length < MAX_IDS) {
      combinedMissing.push(evidenceId);
    }
  }

  const allCited = claims.length > 0 && claims.every((claim) => claim.support === 'CITED');
  const checkedDiagnosis = forceUnknown ? null : allCited ? parsed.data.diagnosis : 'INCONCLUSIVE';
  const checked = CheckedDiagnosisSchema.safeParse({
    runId: runId.data,
    parseStatus: forceUnknown ? 'RUN_MISMATCH' : 'PARSED',
    modelDiagnosis: parsed.data.diagnosis,
    checkedDiagnosis,
    summary,
    claims,
    missingEvidence: combinedMissing,
    needsHumanReview: forceUnknown || parsed.data.needsHumanReview || !allCited,
    releaseAuthorized: false,
    gateDecision: null,
  });
  if (!checked.success) {
    return blank(runId.data, 'UNPARSEABLE');
  }
  return checked.data;
}
