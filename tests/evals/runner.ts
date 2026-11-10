import { decideRelease, GATE_POLICY_VERSION } from '@tqa/quality-gate';
import type { Diagnosis, Gate, TestScenario, VerificationStatus } from '@tqa/shared';
import {
  loadGoldenDataset,
  type AuthoritativeLookup,
  type GoldenDataset,
} from '../contract/golden-dataset.ts';

const REPORT_VERSION = 'tqa-eval-report-1';
const DATASET_ID = 'tqa-golden-v1';
const EVAL_RUN_ID = '11111111-1111-4111-8111-111111111111';
const EVAL_VERIFICATION_ID = '22222222-2222-4222-8222-222222222222';
const EVAL_CHECKED_AT = '2026-11-10T00:00:00.000Z';
const NEUTRAL_SUMMARY = 'Candidate label supplied for comparison.';
const LIMITATION =
  'n=12. These counts are not a reliability rate and do not generalize. The runner did not call a model and did not open SQLite. measuredFromModel records only the caller-supplied source. Scripted stimuli do not include collected evidence ids, so an empty citation is uncovered rather than a measured linkage rate.';

const CASE_IDS = [
  'GD-NORMAL-01',
  'GD-NORMAL-02',
  'GD-NORMAL-03',
  'GD-NORMAL-04',
  'GD-GHOST-01',
  'GD-GHOST-02',
  'GD-GHOST-03',
  'GD-GHOST-04',
  'GD-UNKNOWN-01',
  'GD-UNKNOWN-02',
  'GD-UNKNOWN-03',
  'GD-UNKNOWN-04',
] as const;

const OBSERVATION_KEYS = [
  'caseId',
  'diagnosis',
  'claimsAbsence',
  'citedEvidenceIds',
  'resolvedEvidenceIds',
  'verificationStatus',
  'gate',
  'candidateSource',
] as const;

const SOURCES = ['scripted-fixture', 'none', 'checked-diagnosis', 'live-model'] as const;
const DIAGNOSES = ['SUCCESS', 'ORDER_NOT_PERSISTED', 'INCONCLUSIVE', 'OTHER'] as const;
const VERIFICATIONS = ['CONFIRMED', 'DEFECT', 'UNKNOWN'] as const;
const GATES = ['ALLOW', 'BLOCK', 'HOLD'] as const;

const ABSENCE_CLAIM_TEXT = 'order was not persisted';
const FABRICATED_EVIDENCE_ID = 'ev-fabricated';
const MAX_IDS = 20;
const MAX_ID_LENGTH = 200;

export class EvalInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvalInputError';
  }
}

export type CandidateSource = (typeof SOURCES)[number];
export type DiagnosisOutcome = 'match' | 'mismatch' | 'abstained';
export type MatchOutcome = 'match' | 'mismatch';
export type EvidenceCoverage = 'covered' | 'uncovered' | 'not_applicable';
export type AbstentionOutcome = 'not_abstained' | 'appropriate' | 'inappropriate';
export type CriticalDefectOutcome = 'not_applicable' | 'detected' | 'missed';

export interface EvalObservation {
  caseId: string;
  diagnosis: Diagnosis | null;
  claimsAbsence: boolean;
  citedEvidenceIds: string[];
  resolvedEvidenceIds: string[];
  verificationStatus: VerificationStatus;
  gate: Gate;
  candidateSource: CandidateSource;
}

export interface EvalCaseOutcome {
  caseId: string;
  scenario: TestScenario;
  candidateSource: CandidateSource;
  diagnosisOutcome: DiagnosisOutcome;
  expectedDiagnosis: Diagnosis;
  observedDiagnosis: Diagnosis | null;
  verificationOutcome: MatchOutcome;
  expectedVerification: VerificationStatus;
  observedVerification: VerificationStatus;
  gateOutcome: MatchOutcome;
  expectedGate: Gate;
  observedGate: Gate;
  gateConsistentWithPolicy: boolean;
  evidenceCoverage: EvidenceCoverage;
  abstention: AbstentionOutcome;
  criticalDefect: CriticalDefectOutcome;
}

export interface EvalCounts {
  cases: number;
  byScenario: Record<TestScenario, number>;
  classification: Record<DiagnosisOutcome, number>;
  evidenceCoverage: Record<EvidenceCoverage, number>;
  abstention: Record<AbstentionOutcome, number>;
  criticalDefect: Record<CriticalDefectOutcome, number>;
  verification: Record<MatchOutcome, number>;
  gate: Record<MatchOutcome, number>;
  gateConsistency: { consistent: number; inconsistent: number };
}

export interface EvalReport {
  reportVersion: typeof REPORT_VERSION;
  datasetId: typeof DATASET_ID;
  policyVersion: typeof GATE_POLICY_VERSION;
  measuredFromModel: boolean;
  modelInvoked: false;
  authorityExecuted: false;
  generalizes: false;
  candidateSources: CandidateSource[];
  limitation: typeof LIMITATION;
  counts: EvalCounts;
  cases: EvalCaseOutcome[];
}

function fail(message: string): never {
  throw new EvalInputError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(record);
  for (const key of actual) {
    if (!keys.includes(key)) {
      fail(`${label} has unexpected field ${key}`);
    }
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) {
      fail(`${label} is missing ${key}`);
    }
  }
}

function isDiagnosis(value: unknown): value is Diagnosis {
  return typeof value === 'string' && (DIAGNOSES as readonly string[]).includes(value);
}

function isVerification(value: unknown): value is VerificationStatus {
  return typeof value === 'string' && (VERIFICATIONS as readonly string[]).includes(value);
}

function isGate(value: unknown): value is Gate {
  return typeof value === 'string' && (GATES as readonly string[]).includes(value);
}

function isSource(value: unknown): value is CandidateSource {
  return typeof value === 'string' && (SOURCES as readonly string[]).includes(value);
}

function readIds(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
  if (value.length > MAX_IDS) {
    fail(`${label} has too many ids`);
  }
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id !== 'string' || id.trim() === '' || id.length > MAX_ID_LENGTH) {
      fail(`${label} must contain short non-empty strings`);
    }
    if (ids.includes(id)) {
      fail(`${label} ids must be unique`);
    }
    ids.push(id);
  }
  return ids;
}

function readObservation(value: unknown): EvalObservation {
  if (!isRecord(value)) {
    fail('each observation must be an object');
  }
  exactKeys(value, OBSERVATION_KEYS, 'observation');
  if (typeof value.caseId !== 'string' || !(CASE_IDS as readonly string[]).includes(value.caseId)) {
    fail('observation caseId must be one of the twelve golden ids');
  }
  if (value.diagnosis !== null && !isDiagnosis(value.diagnosis)) {
    fail(`${value.caseId} diagnosis must be a diagnosis or null`);
  }
  if (!isVerification(value.verificationStatus)) {
    fail(`${value.caseId} verificationStatus is not a verification status`);
  }
  if (!isGate(value.gate)) {
    fail(`${value.caseId} gate is not a gate`);
  }
  if (!isSource(value.candidateSource)) {
    fail(`${value.caseId} candidateSource is not a known source`);
  }
  if (value.diagnosis === null && value.candidateSource !== 'none') {
    fail(`${value.caseId} abstention uses candidateSource none`);
  }
  if (value.diagnosis !== null && value.candidateSource === 'none') {
    fail(`${value.caseId} candidateSource none is only valid when the diagnosis is null`);
  }
  if (typeof value.claimsAbsence !== 'boolean') {
    fail(`${value.caseId} claimsAbsence must be a boolean`);
  }
  if (value.claimsAbsence && value.diagnosis === null) {
    fail(`${value.caseId} abstention cannot claim that the order is absent`);
  }
  const citedEvidenceIds = readIds(value.citedEvidenceIds, `${value.caseId} citedEvidenceIds`);
  const resolvedEvidenceIds = readIds(value.resolvedEvidenceIds, `${value.caseId} resolvedEvidenceIds`);
  for (const id of resolvedEvidenceIds) {
    if (!citedEvidenceIds.includes(id)) {
      fail(`${value.caseId} resolvedEvidenceIds must be a subset of citedEvidenceIds`);
    }
  }
  return {
    caseId: value.caseId,
    diagnosis: value.diagnosis,
    claimsAbsence: value.claimsAbsence,
    citedEvidenceIds,
    resolvedEvidenceIds,
    verificationStatus: value.verificationStatus,
    gate: value.gate,
    candidateSource: value.candidateSource,
  };
}

/**
 * Maps the golden stimulus lookup to a verification status.
 * A timeout and a 503 stay UNKNOWN. They are not ABSENT and not DEFECT.
 */
export function verificationStatusForLookup(lookup: AuthoritativeLookup): VerificationStatus {
  switch (lookup) {
    case 'FOUND':
      return 'CONFIRMED';
    case 'ABSENT':
      return 'DEFECT';
    case 'UNAVAILABLE_503':
    case 'UNAVAILABLE_TIMEOUT':
    case 'TOOL_TIMEOUT':
      return 'UNKNOWN';
    default: {
      const unexpected: never = lookup;
      return fail(`unexpected lookup ${String(unexpected)}`);
    }
  }
}

/**
 * Policy decision for a supplied status and an optional label.
 * The summary is fixed and does not copy stimulus text.
 * ORDER_NOT_PERSISTED trips the contradiction hold inside decideRelease.
 * claimsAbsence sends that same fixed phrase as a claim. Caller text is not copied.
 */
export function policyDecision(
  status: VerificationStatus,
  diagnosis: Diagnosis | null,
  claimsAbsence = false,
): Gate {
  const verification = {
    verificationId: EVAL_VERIFICATION_ID,
    runId: EVAL_RUN_ID,
    status,
    checkedAt: EVAL_CHECKED_AT,
    details: 'Supplied status for eval comparison.',
  };
  const decision =
    diagnosis === null
      ? decideRelease({ verification })
      : decideRelease({
          verification,
          diagnosis: {
            runId: EVAL_RUN_ID,
            diagnosis,
            summary: NEUTRAL_SUMMARY,
            claims: claimsAbsence ? [{ text: ABSENCE_CLAIM_TEXT, evidenceIds: [] }] : [],
            missingEvidence: [],
            needsHumanReview: true,
          },
        });
  return decision.decision;
}

function evidenceCoverage(observation: EvalObservation): EvidenceCoverage {
  if (observation.diagnosis === null) {
    return 'not_applicable';
  }
  if (observation.citedEvidenceIds.length === 0) {
    return 'uncovered';
  }
  const everyCitedIdResolved = observation.citedEvidenceIds.every((id) =>
    observation.resolvedEvidenceIds.includes(id),
  );
  return everyCitedIdResolved ? 'covered' : 'uncovered';
}

function abstention(scenario: TestScenario, diagnosis: Diagnosis | null): AbstentionOutcome {
  if (diagnosis !== null) {
    return 'not_abstained';
  }
  return scenario === 'VERIFICATION_UNAVAILABLE' ? 'appropriate' : 'inappropriate';
}

function criticalDefect(scenario: TestScenario, diagnosis: Diagnosis | null): CriticalDefectOutcome {
  if (scenario !== 'GHOST_SUCCESS') {
    return 'not_applicable';
  }
  return diagnosis === 'ORDER_NOT_PERSISTED' ? 'detected' : 'missed';
}

function diagnosisOutcome(expected: Diagnosis, observed: Diagnosis | null): DiagnosisOutcome {
  if (observed === null) {
    return 'abstained';
  }
  return observed === expected ? 'match' : 'mismatch';
}

function casesById(dataset: GoldenDataset): Map<string, GoldenDataset['cases'][number]> {
  if (dataset.datasetId !== DATASET_ID) {
    fail(`datasetId must be ${DATASET_ID}`);
  }
  if (dataset.cases.length !== CASE_IDS.length) {
    fail(`golden dataset must contain ${CASE_IDS.length} cases`);
  }
  const byId = new Map<string, GoldenDataset['cases'][number]>();
  for (const entry of dataset.cases) {
    if (byId.has(entry.caseId)) {
      fail(`duplicate dataset case ${entry.caseId}`);
    }
    byId.set(entry.caseId, entry);
  }
  for (const caseId of CASE_IDS) {
    if (!byId.has(caseId)) {
      fail(`golden dataset is missing ${caseId}`);
    }
  }
  return byId;
}

function emptyCounts(): EvalCounts {
  return {
    cases: 0,
    byScenario: { NORMAL: 0, GHOST_SUCCESS: 0, VERIFICATION_UNAVAILABLE: 0 },
    classification: { match: 0, mismatch: 0, abstained: 0 },
    evidenceCoverage: { covered: 0, uncovered: 0, not_applicable: 0 },
    abstention: { appropriate: 0, inappropriate: 0, not_abstained: 0 },
    criticalDefect: { detected: 0, missed: 0, not_applicable: 0 },
    verification: { match: 0, mismatch: 0 },
    gate: { match: 0, mismatch: 0 },
    gateConsistency: { consistent: 0, inconsistent: 0 },
  };
}

/**
 * Compares supplied observations with the golden labels.
 * The passing screen is not an input. Distractor text is not copied.
 * This function does not call a model and does not open SQLite.
 */
export function scoreEval(dataset: GoldenDataset, observations: readonly unknown[]): EvalReport {
  const byId = casesById(dataset);
  if (!Array.isArray(observations)) {
    fail('observations must be an array');
  }
  const parsed = observations.map((entry) => readObservation(entry));
  const seen = new Set<string>();
  for (const observation of parsed) {
    if (seen.has(observation.caseId)) {
      fail(`duplicate observation ${observation.caseId}`);
    }
    seen.add(observation.caseId);
  }
  for (const caseId of CASE_IDS) {
    if (!seen.has(caseId)) {
      fail(`observation is missing ${caseId}`);
    }
  }

  const counts = emptyCounts();
  const cases: EvalCaseOutcome[] = [];
  for (const caseId of CASE_IDS) {
    const golden = byId.get(caseId);
    const observation = parsed.find((entry) => entry.caseId === caseId);
    if (golden === undefined || observation === undefined) {
      fail(`observation is missing ${caseId}`);
    }
    const observedDiagnosis = observation.diagnosis;
    const diagnosisResult = diagnosisOutcome(golden.expectedDiagnosis, observedDiagnosis);
    const verificationOutcome: MatchOutcome =
      observation.verificationStatus === golden.expectedVerification ? 'match' : 'mismatch';
    const gateOutcome: MatchOutcome = observation.gate === golden.expectedGate ? 'match' : 'mismatch';
    const gateConsistentWithPolicy =
      policyDecision(observation.verificationStatus, observedDiagnosis, observation.claimsAbsence) ===
      observation.gate;
    const coverage = evidenceCoverage(observation);
    const abstentionResult = abstention(golden.scenario, observedDiagnosis);
    const defect = criticalDefect(golden.scenario, observedDiagnosis);
    counts.byScenario[golden.scenario] += 1;
    counts.classification[diagnosisResult] += 1;
    counts.evidenceCoverage[coverage] += 1;
    counts.abstention[abstentionResult] += 1;
    counts.criticalDefect[defect] += 1;
    counts.verification[verificationOutcome] += 1;
    counts.gate[gateOutcome] += 1;
    if (gateConsistentWithPolicy) {
      counts.gateConsistency.consistent += 1;
    } else {
      counts.gateConsistency.inconsistent += 1;
    }
    cases.push({
      caseId,
      scenario: golden.scenario,
      candidateSource: observation.candidateSource,
      diagnosisOutcome: diagnosisResult,
      expectedDiagnosis: golden.expectedDiagnosis,
      observedDiagnosis,
      verificationOutcome,
      expectedVerification: golden.expectedVerification,
      observedVerification: observation.verificationStatus,
      gateOutcome,
      expectedGate: golden.expectedGate,
      observedGate: observation.gate,
      gateConsistentWithPolicy,
      evidenceCoverage: coverage,
      abstention: abstentionResult,
      criticalDefect: defect,
    });
  }
  counts.cases = cases.length;
  if (counts.cases !== CASE_IDS.length) {
    fail(`report must contain ${CASE_IDS.length} cases`);
  }

  const candidateSources = SOURCES.filter((source) =>
    parsed.some((entry) => entry.candidateSource === source),
  );
  const onlySource = candidateSources.length === 1 ? candidateSources[0] : undefined;
  const measuredFromModel = onlySource === 'live-model';

  return {
    reportVersion: REPORT_VERSION,
    datasetId: DATASET_ID,
    policyVersion: GATE_POLICY_VERSION,
    measuredFromModel,
    modelInvoked: false,
    authorityExecuted: false,
    generalizes: false,
    candidateSources,
    limitation: LIMITATION,
    counts,
    cases,
  };
}

/**
 * One observation per golden stimulus.
 * GD-GHOST-03 is the only stimulus that names an evidence id, and that id is not resolved.
 * Other stimuli name none, so their citations stay empty.
 */
export function scriptedObservations(dataset: GoldenDataset): EvalObservation[] {
  const byId = casesById(dataset);
  return CASE_IDS.map((caseId) => {
    const golden = byId.get(caseId);
    if (golden === undefined) {
      fail(`golden dataset is missing ${caseId}`);
    }
    const diagnosis = golden.stimulus.scriptedCandidateDiagnosis;
    const verificationStatus = verificationStatusForLookup(golden.stimulus.authoritativeLookup);
    const citedEvidenceIds = caseId === 'GD-GHOST-03' ? [FABRICATED_EVIDENCE_ID] : [];
    const claimsAbsence = diagnosis === 'ORDER_NOT_PERSISTED';
    return {
      caseId,
      diagnosis,
      claimsAbsence,
      citedEvidenceIds,
      resolvedEvidenceIds: [],
      verificationStatus,
      gate: policyDecision(verificationStatus, diagnosis, claimsAbsence),
      candidateSource: diagnosis === null ? 'none' : 'scripted-fixture',
    };
  });
}

export function scoreScriptedStimuli(dataset: GoldenDataset): EvalReport {
  return scoreEval(dataset, scriptedObservations(dataset));
}

export function scoreCheckedInStimuli(): EvalReport {
  return scoreScriptedStimuli(loadGoldenDataset());
}

export function evalReportJson(report: EvalReport): string {
  return JSON.stringify(report, null, 2);
}
