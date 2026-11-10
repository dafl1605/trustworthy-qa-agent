import {
  AgentDiagnosisSchema,
  GateDecisionSchema,
  VerificationResultSchema,
  type AgentDiagnosis,
  type GateDecision,
  type VerificationResult,
} from '@tqa/shared';
import { GateInputError } from './errors.js';
import { GATE_POLICY_VERSION, REASON } from './policy.js';

const VERIFICATION_KEYS = ['verificationId', 'runId', 'status', 'checkedAt', 'details'] as const;
const DIAGNOSIS_KEYS = ['runId', 'diagnosis', 'summary', 'claims', 'missingEvidence', 'needsHumanReview'] as const;
const CLAIM_KEYS = ['text', 'evidenceIds'] as const;
const INPUT_KEYS = ['verification', 'diagnosis'] as const;

/**
 * Asserts the order was not stored. Matched only for a CONFIRMED verification.
 * Instruction phrases such as ALLOW or "ignore previous instructions" are not facts.
 */
const ABSENCE_CLAIM =
  /\b(?:order not persisted|order was not persisted|order was not saved|confirmed missing order|no stored order)\b/i;

export interface DecideReleaseInput {
  verification: unknown;
  /**
   * Optional model diagnosis. It cannot authorize ALLOW.
   * It cannot turn DEFECT into ALLOW or UNKNOWN into BLOCK.
   */
  diagnosis?: unknown;
}

function reject(message: string): never {
  throw new GateInputError(message);
}

function exactObject(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    reject(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record);
  const sameLength = actual.length === keys.length;
  const sameKeys = keys.every((key) => Object.hasOwn(record, key));
  if (!sameLength || !sameKeys) {
    reject(`${label} has unexpected fields`);
  }
  return record;
}

function isUuid(value: string): boolean {
  return VerificationResultSchema.safeParse({
    verificationId: 'id-probe',
    runId: value,
    status: 'UNKNOWN',
    checkedAt: '2026-11-10T00:00:00.000Z',
    details: 'probe',
  }).success;
}

function readVerification(value: unknown): VerificationResult {
  exactObject(value, VERIFICATION_KEYS, 'verification');
  const parsed = VerificationResultSchema.safeParse(value);
  if (!parsed.success) {
    reject('verification does not match VerificationResult');
  }
  if (!isUuid(parsed.data.verificationId)) {
    reject('verificationId must be a UUID');
  }
  return parsed.data;
}

function readDiagnosis(value: unknown): AgentDiagnosis {
  const record = exactObject(value, DIAGNOSIS_KEYS, 'diagnosis');
  const claims: unknown = record['claims'];
  if (!Array.isArray(claims)) {
    reject('diagnosis claims must be an array');
  }
  for (const claim of claims) {
    exactObject(claim, CLAIM_KEYS, 'diagnosis claim');
  }
  const parsed = AgentDiagnosisSchema.safeParse(value);
  if (!parsed.success) {
    reject('diagnosis does not match AgentDiagnosis');
  }
  return parsed.data;
}

function assertsAbsence(diagnosis: AgentDiagnosis): boolean {
  if (diagnosis.diagnosis === 'ORDER_NOT_PERSISTED') {
    return true;
  }
  if (ABSENCE_CLAIM.test(diagnosis.summary)) {
    return true;
  }
  return diagnosis.claims.some((claim) => ABSENCE_CLAIM.test(claim.text));
}

function decision(
  verification: VerificationResult,
  reasonCodes: string[],
  gate: GateDecision['decision'],
): GateDecision {
  return GateDecisionSchema.parse({
    runId: verification.runId,
    decision: gate,
    reasonCodes,
    verificationId: verification.verificationId,
    policyVersion: GATE_POLICY_VERSION,
  });
}

/**
 * Deterministic release decision for one verification.
 * The function does not open SQLite, does not call a model, and does not
 * copy diagnosis text into the decision.
 */
export function decideRelease(input: DecideReleaseInput): GateDecision {
  exactObject(input, Object.hasOwn(input, 'diagnosis') ? INPUT_KEYS : ['verification'], 'input');
  const verification = readVerification(input.verification);
  const diagnosis = input.diagnosis === undefined ? null : readDiagnosis(input.diagnosis);
  if (diagnosis !== null && diagnosis.runId !== verification.runId) {
    reject('diagnosis runId must match verification runId');
  }

  if (verification.status === 'UNKNOWN') {
    const reasonCodes: string[] = [REASON.unknown];
    if (diagnosis !== null) {
      reasonCodes.push(REASON.diagnosisIgnored);
    }
    return decision(verification, reasonCodes, 'HOLD');
  }

  if (verification.status === 'DEFECT') {
    const reasonCodes: string[] = [REASON.defect];
    if (diagnosis !== null) {
      reasonCodes.push(REASON.diagnosisIgnored);
    }
    return decision(verification, reasonCodes, 'BLOCK');
  }

  if (diagnosis !== null && assertsAbsence(diagnosis)) {
    return decision(
      verification,
      [REASON.confirmed, REASON.contradiction],
      'HOLD',
    );
  }

  return decision(verification, [REASON.confirmed], 'ALLOW');
}
