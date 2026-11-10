import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvalCaseSchema, type Diagnosis, type EvalCase, type TestScenario } from '@tqa/shared';

const DATASET_ID = 'tqa-golden-v1';
const AUTHORED_ON = '2026-11-10';
const PROVENANCE_STATEMENT =
  'These labels are the approved scenario matrix. They are not scores from a model run and they are not a release decision.';

const REQUIRED_CASE_IDS = [
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

const SPEC_IDS = ['S-001', 'S-002', 'S-003', 'S-004'] as const;
const DIAGNOSES = ['SUCCESS', 'ORDER_NOT_PERSISTED', 'INCONCLUSIVE', 'OTHER'] as const;

const MATRIX = {
  NORMAL: {
    prefix: 'GD-NORMAL',
    diagnosis: 'SUCCESS',
    verification: 'CONFIRMED',
    gate: 'ALLOW',
    specId: 'S-001',
    lookups: ['FOUND'],
  },
  GHOST_SUCCESS: {
    prefix: 'GD-GHOST',
    diagnosis: 'ORDER_NOT_PERSISTED',
    verification: 'DEFECT',
    gate: 'BLOCK',
    specId: 'S-002',
    lookups: ['ABSENT'],
  },
  VERIFICATION_UNAVAILABLE: {
    prefix: 'GD-UNKNOWN',
    diagnosis: 'INCONCLUSIVE',
    verification: 'UNKNOWN',
    gate: 'HOLD',
    specId: 'S-003',
    lookups: ['UNAVAILABLE_503', 'UNAVAILABLE_TIMEOUT', 'TOOL_TIMEOUT'],
  },
} as const;

export const GOLDEN_DATASET_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/golden-dataset/cases.json',
);

export class GoldenDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoldenDatasetError';
  }
}

export type AuthoritativeLookup =
  | 'FOUND'
  | 'ABSENT'
  | 'UNAVAILABLE_503'
  | 'UNAVAILABLE_TIMEOUT'
  | 'TOOL_TIMEOUT';

export interface GoldenStimulus {
  summary: string;
  uiShowsConfirmation: true;
  superficialUiPass: true;
  authoritativeLookup: AuthoritativeLookup;
  scriptedCandidateDiagnosis: Diagnosis | null;
  candidateSource: 'scripted-fixture' | 'none';
  distractor: string | null;
}

export interface GoldenCase extends EvalCase {
  specIds: readonly (typeof SPEC_IDS)[number][];
  labelRationale: string;
  stimulus: GoldenStimulus;
}

export interface GoldenLabelProvenance {
  authoredBy: 'human';
  authoredOn: typeof AUTHORED_ON;
  method: 'decision-matrix';
  sources: readonly ['docs/architecture-contracts.md', 'docs/spec.md'];
  measuredFromModel: false;
  statement: typeof PROVENANCE_STATEMENT;
}

export interface GoldenDataset {
  datasetId: typeof DATASET_ID;
  labelProvenance: GoldenLabelProvenance;
  cases: GoldenCase[];
}

function fail(message: string): never {
  throw new GoldenDatasetError(message);
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

function isScenario(value: unknown): value is TestScenario {
  return value === 'NORMAL' || value === 'GHOST_SUCCESS' || value === 'VERIFICATION_UNAVAILABLE';
}

function isDiagnosis(value: unknown): value is Diagnosis {
  return typeof value === 'string' && (DIAGNOSES as readonly string[]).includes(value);
}

function nonEmpty(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    fail(`${label} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

function readProvenance(value: unknown): GoldenLabelProvenance {
  if (!isRecord(value)) {
    fail('labelProvenance must be an object');
  }
  exactKeys(
    value,
    ['authoredBy', 'authoredOn', 'method', 'sources', 'measuredFromModel', 'statement'],
    'labelProvenance',
  );
  if (value.authoredBy !== 'human') {
    fail('labelProvenance.authoredBy must be human');
  }
  if (value.authoredOn !== AUTHORED_ON) {
    fail(`labelProvenance.authoredOn must be ${AUTHORED_ON}`);
  }
  if (value.method !== 'decision-matrix') {
    fail('labelProvenance.method must be decision-matrix');
  }
  if (value.measuredFromModel !== false) {
    fail('labelProvenance.measuredFromModel must be false');
  }
  if (value.statement !== PROVENANCE_STATEMENT) {
    fail('labelProvenance.statement must say the labels are not model scores');
  }
  if (
    !Array.isArray(value.sources) ||
    value.sources.length !== 2 ||
    value.sources[0] !== 'docs/architecture-contracts.md' ||
    value.sources[1] !== 'docs/spec.md'
  ) {
    fail('labelProvenance.sources must name the decision matrix and the spec');
  }
  return {
    authoredBy: 'human',
    authoredOn: AUTHORED_ON,
    method: 'decision-matrix',
    sources: ['docs/architecture-contracts.md', 'docs/spec.md'],
    measuredFromModel: false,
    statement: PROVENANCE_STATEMENT,
  };
}

function readStimulus(value: unknown, caseId: string, scenario: TestScenario): GoldenStimulus {
  if (!isRecord(value)) {
    fail(`${caseId} stimulus must be an object`);
  }
  exactKeys(
    value,
    [
      'summary',
      'uiShowsConfirmation',
      'superficialUiPass',
      'authoritativeLookup',
      'scriptedCandidateDiagnosis',
      'candidateSource',
      'distractor',
    ],
    `${caseId} stimulus`,
  );
  if (value.uiShowsConfirmation !== true || value.superficialUiPass !== true) {
    fail(`${caseId} keeps a passing screen and does not use that screen as the label`);
  }
  const lookups: readonly string[] = MATRIX[scenario].lookups;
  if (typeof value.authoritativeLookup !== 'string' || !lookups.includes(value.authoritativeLookup)) {
    fail(`${caseId} authoritativeLookup does not match ${scenario}`);
  }
  const candidate = value.scriptedCandidateDiagnosis;
  if (candidate !== null && !isDiagnosis(candidate)) {
    fail(`${caseId} scriptedCandidateDiagnosis must be a diagnosis or null`);
  }
  if (candidate === null && value.candidateSource !== 'none') {
    fail(`${caseId} abstention uses candidateSource none`);
  }
  if (candidate !== null && value.candidateSource !== 'scripted-fixture') {
    fail(`${caseId} scripted candidate must use candidateSource scripted-fixture`);
  }
  const distractor = value.distractor;
  if (distractor !== null && (typeof distractor !== 'string' || distractor.trim() === '' || distractor.length > 300)) {
    fail(`${caseId} distractor must be null or a short string`);
  }
  return {
    summary: nonEmpty(value.summary, `${caseId} summary`, 300),
    uiShowsConfirmation: true,
    superficialUiPass: true,
    authoritativeLookup: value.authoritativeLookup as AuthoritativeLookup,
    scriptedCandidateDiagnosis: candidate,
    candidateSource: candidate === null ? 'none' : 'scripted-fixture',
    distractor,
  };
}

function readCase(value: unknown): GoldenCase {
  if (!isRecord(value)) {
    fail('each case must be an object');
  }
  exactKeys(
    value,
    [
      'caseId',
      'scenario',
      'expectedDiagnosis',
      'expectedVerification',
      'expectedGate',
      'specIds',
      'labelRationale',
      'stimulus',
    ],
    'case',
  );
  if (typeof value.caseId !== 'string' || !/^GD-(NORMAL|GHOST|UNKNOWN)-0[1-4]$/.test(value.caseId)) {
    fail('caseId must be one of the twelve GD identifiers');
  }
  const caseId = value.caseId;
  if (!isScenario(value.scenario)) {
    fail(`${caseId} scenario is not a known fault mode`);
  }
  const row = MATRIX[value.scenario];
  if (!caseId.startsWith(row.prefix)) {
    fail(`${caseId} does not belong to ${value.scenario}`);
  }
  const parsed = EvalCaseSchema.safeParse({
    caseId,
    scenario: value.scenario,
    expectedDiagnosis: value.expectedDiagnosis,
    expectedVerification: value.expectedVerification,
    expectedGate: value.expectedGate,
  });
  if (!parsed.success) {
    fail(`${caseId}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
  }
  if (
    parsed.data.expectedDiagnosis !== row.diagnosis ||
    parsed.data.expectedVerification !== row.verification ||
    parsed.data.expectedGate !== row.gate
  ) {
    fail(`${caseId} contradicts the ${value.scenario} row of the decision matrix`);
  }
  if (!Array.isArray(value.specIds) || value.specIds.length < 1 || value.specIds.length > 3) {
    fail(`${caseId} specIds must name one to three spec rows`);
  }
  const specIds: (typeof SPEC_IDS)[number][] = [];
  for (const specId of value.specIds) {
    if (typeof specId !== 'string' || !(SPEC_IDS as readonly string[]).includes(specId)) {
      fail(`${caseId} specIds only include S-001 through S-004`);
    }
    const typed = specId as (typeof SPEC_IDS)[number];
    if (specIds.includes(typed)) {
      fail(`${caseId} specIds must be unique`);
    }
    specIds.push(typed);
  }
  if (!specIds.includes(row.specId)) {
    fail(`${caseId} specIds must include ${row.specId}`);
  }
  const labelRationale = nonEmpty(value.labelRationale, `${caseId} labelRationale`, 400);
  if (labelRationale.length < 40 || !labelRationale.includes('decision matrix')) {
    fail(`${caseId} labelRationale must cite the decision matrix`);
  }
  if (/measured accuracy|live model result|scored by a model/i.test(labelRationale)) {
    fail(`${caseId} labelRationale must not present the label as a model score`);
  }
  return {
    ...parsed.data,
    specIds,
    labelRationale,
    stimulus: readStimulus(value.stimulus, caseId, value.scenario),
  };
}

export function parseGoldenDataset(raw: unknown): GoldenDataset {
  if (!isRecord(raw)) {
    fail('golden dataset must be an object');
  }
  exactKeys(raw, ['datasetId', 'labelProvenance', 'cases'], 'golden dataset');
  if (raw.datasetId !== DATASET_ID) {
    fail(`datasetId must be ${DATASET_ID}`);
  }
  if (!Array.isArray(raw.cases)) {
    fail('cases must be an array');
  }
  const cases = raw.cases.map((entry) => readCase(entry));
  if (cases.length !== REQUIRED_CASE_IDS.length) {
    fail(`golden dataset must contain ${REQUIRED_CASE_IDS.length} cases`);
  }
  const seen = new Set(cases.map((entry) => entry.caseId));
  if (seen.size !== cases.length) {
    fail('caseId values must be unique');
  }
  for (const caseId of REQUIRED_CASE_IDS) {
    if (!seen.has(caseId)) {
      fail(`golden dataset is missing ${caseId}`);
    }
  }
  return {
    datasetId: DATASET_ID,
    labelProvenance: readProvenance(raw.labelProvenance),
    cases,
  };
}

export function loadGoldenDataset(path = GOLDEN_DATASET_PATH): GoldenDataset {
  const text = readFileSync(path, 'utf8');
  return parseGoldenDataset(JSON.parse(text) as unknown);
}
