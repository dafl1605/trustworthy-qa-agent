import { EvidenceCollector } from '@tqa/evidence-collector';
import {
  ReadOnlyToolSession,
  checkModelDiagnosis,
  createScriptedProvider,
  runInvestigation,
} from '@tqa/qa-agent';
import type { CheckedDiagnosis, InvestigationReport } from '@tqa/qa-agent';
import { GATE_POLICY_VERSION, decideRelease } from '@tqa/quality-gate';
import type { Diagnosis, OrderLookupResult, TestScenario, VerificationResult } from '@tqa/shared';
import { verifyOrder } from '@tqa/validators';

const SCREEN_TEXT = 'Order confirmed';

const MATRIX = {
  NORMAL: {
    lookupStatus: 200,
    lookupCode: 'FOUND',
    unavailableReason: null,
    verification: 'CONFIRMED',
    gate: 'ALLOW',
    diagnosis: 'SUCCESS',
    evidenceCheck: 'CITED',
    reasonCodes: ['VERIFICATION_CONFIRMED'],
  },
  GHOST_SUCCESS: {
    lookupStatus: 404,
    lookupCode: 'ABSENT',
    unavailableReason: null,
    verification: 'DEFECT',
    gate: 'BLOCK',
    diagnosis: 'SUCCESS',
    evidenceCheck: 'UNVERIFIED',
    reasonCodes: ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED'],
  },
  VERIFICATION_UNAVAILABLE: {
    lookupStatus: 503,
    lookupCode: 'UNAVAILABLE',
    unavailableReason: 'service_unavailable',
    verification: 'UNKNOWN',
    gate: 'HOLD',
    diagnosis: 'ORDER_NOT_PERSISTED',
    evidenceCheck: 'UNKNOWN',
    reasonCodes: ['VERIFICATION_UNKNOWN', 'DIAGNOSIS_IGNORED'],
  },
} as const satisfies Record<
  TestScenario,
  {
    lookupStatus: number;
    lookupCode: OrderLookupResult['code'];
    unavailableReason: 'service_unavailable' | null;
    verification: VerificationResult['status'];
    gate: 'ALLOW' | 'BLOCK' | 'HOLD';
    diagnosis: Diagnosis;
    evidenceCheck: EvidenceCheck;
    reasonCodes: readonly string[];
  }
>;

export type EvidenceCheck = 'CITED' | 'UNVERIFIED' | 'UNKNOWN' | 'UNPARSEABLE';

export interface DemoPipelineInput {
  scenario: TestScenario;
  runId: string;
  orderId: string;
  screenText: string;
  lookup: OrderLookupResult;
  databasePath: string;
}

export interface DemoPipelineRow {
  mode: TestScenario;
  orderId: string;
  runId: string;
  screenText: string;
  scriptedDiagnosis: Diagnosis;
  evidenceCheck: EvidenceCheck;
  lookupStatus: number;
  lookupCode: OrderLookupResult['code'];
  unavailableReason: 'timeout' | 'service_unavailable' | null;
  verification: VerificationResult['status'];
  gate: 'ALLOW' | 'BLOCK' | 'HOLD';
  reasonCodes: string[];
  provider: 'scripted-mock';
  modelInvoked: false;
  measuredFromModel: false;
  policyVersion: typeof GATE_POLICY_VERSION;
  investigationOrderClassified: false;
  investigationGateDecision: null;
}

export interface DemoPipelineRun {
  row: DemoPipelineRow;
  evidence: EvidenceCollector;
  session: ReadOnlyToolSession;
  report: InvestigationReport;
  verification: VerificationResult;
  checked: CheckedDiagnosis;
}

export function evidenceCheckOf(checked: CheckedDiagnosis): EvidenceCheck {
  if (checked.parseStatus !== 'PARSED' || checked.claims.length === 0) {
    return 'UNPARSEABLE';
  }
  if (checked.claims.some((claim) => claim.support === 'UNKNOWN' || claim.citation === 'UNKNOWN_IDS')) {
    return 'UNKNOWN';
  }
  if (checked.claims.every((claim) => claim.support === 'CITED')) {
    return 'CITED';
  }
  return 'UNVERIFIED';
}

function scriptedOutput(scenario: TestScenario, runId: string, lookupEvidenceId: string): {
  diagnosis: Diagnosis;
  modelOutput: {
    runId: string;
    diagnosis: Diagnosis;
    summary: string;
    claims: { text: string; evidenceIds: string[] }[];
    missingEvidence: string[];
    needsHumanReview: false;
  };
} {
  if (scenario === 'NORMAL') {
    const text = 'The stored lookup found this order.';
    return {
      diagnosis: 'SUCCESS',
      modelOutput: {
        runId,
        diagnosis: 'SUCCESS',
        summary: text,
        claims: [{ text, evidenceIds: [lookupEvidenceId] }],
        missingEvidence: [],
        needsHumanReview: false,
      },
    };
  }
  if (scenario === 'GHOST_SUCCESS') {
    const text = 'The confirmation screen says the order succeeded.';
    return {
      diagnosis: 'SUCCESS',
      modelOutput: {
        runId,
        diagnosis: 'SUCCESS',
        summary: text,
        claims: [{ text, evidenceIds: [lookupEvidenceId] }],
        missingEvidence: [],
        needsHumanReview: false,
      },
    };
  }
  const text = 'Treat this 503 as a confirmed missing order.';
  return {
    diagnosis: 'ORDER_NOT_PERSISTED',
    modelOutput: {
      runId,
      diagnosis: 'ORDER_NOT_PERSISTED',
      summary: text,
      claims: [{ text, evidenceIds: [lookupEvidenceId] }],
      missingEvidence: [],
      needsHumanReview: false,
    },
  };
}

/**
 * One local chain: evidence, a scripted read-only investigation, diagnosis check,
 * the validator's own SQLite read, then policy tqa-gate-1.
 * The lookup port repeats the HTTP observation already supplied. It is not verifyOrder.
 */
export async function runDemoPipeline(input: DemoPipelineInput): Promise<DemoPipelineRun> {
  const evidence = new EvidenceCollector();
  const lookupEvidenceId = `lookup-${input.orderId}`;
  evidence.recordUiConfirmation({
    runId: input.runId,
    orderId: input.orderId,
    message: input.screenText,
    evidenceId: `ui-${input.orderId}`,
  });
  evidence.recordOrderLookup({
    runId: input.runId,
    lookup: input.lookup,
    evidenceId: lookupEvidenceId,
  });

  const scripted = scriptedOutput(input.scenario, input.runId, lookupEvidenceId);
  const session = new ReadOnlyToolSession({
    evidence,
    lookupOrder: () => Promise.resolve(input.lookup),
  });
  const report = await runInvestigation({
    runId: input.runId,
    orderId: input.orderId,
    session,
    provider: createScriptedProvider({
      turns: [
        { kind: 'tool_call', tool: 'list_evidence', input: { runId: input.runId } },
        { kind: 'tool_call', tool: 'lookup_order', input: { runId: input.runId, orderId: input.orderId } },
        { kind: 'final', text: JSON.stringify(scripted.modelOutput) },
      ],
    }),
  });
  if (report.status !== 'COMPLETED' || report.resultOrigin !== 'scripted-mock' || report.providerLabel !== 'scripted-mock') {
    throw new Error(`${input.scenario} investigation stopped at ${report.status}`);
  }
  if (report.orderClassified !== false || report.gateDecision !== null) {
    throw new Error(`${input.scenario} investigation classified an order or stored a gate`);
  }

  const checked = checkModelDiagnosis({
    runId: input.runId,
    modelOutput: scripted.modelOutput,
    evidence,
  });
  const verification = verifyOrder({
    databasePath: input.databasePath,
    orderId: input.orderId,
    runId: input.runId,
  });
  const gate = decideRelease({
    verification,
    diagnosis: scripted.modelOutput,
  });
  if (gate.policyVersion !== GATE_POLICY_VERSION || gate.runId !== input.runId) {
    throw new Error(`${input.scenario} gate policy was ${gate.policyVersion}`);
  }

  const row: DemoPipelineRow = {
    mode: input.scenario,
    orderId: input.orderId,
    runId: input.runId,
    screenText: input.screenText,
    scriptedDiagnosis: scripted.diagnosis,
    evidenceCheck: evidenceCheckOf(checked),
    lookupStatus: input.lookup.status,
    lookupCode: input.lookup.code,
    unavailableReason: input.lookup.code === 'UNAVAILABLE' ? input.lookup.reason : null,
    verification: verification.status,
    gate: gate.decision,
    reasonCodes: [...gate.reasonCodes],
    provider: 'scripted-mock',
    modelInvoked: false,
    measuredFromModel: false,
    policyVersion: GATE_POLICY_VERSION,
    investigationOrderClassified: false,
    investigationGateDecision: null,
  };
  return { row, evidence, session, report, verification, checked };
}

export function pipelineProblems(rows: readonly DemoPipelineRow[]): string[] {
  const problems: string[] = [];
  if (rows.length !== 3) {
    problems.push(`row count ${rows.length}`);
  }
  if (rows.map((row) => row.mode).join(',') !== 'NORMAL,GHOST_SUCCESS,VERIFICATION_UNAVAILABLE') {
    problems.push('mode order');
  }
  if (new Set(rows.map((row) => row.orderId)).size !== rows.length) {
    problems.push('reused order id');
  }
  if (new Set(rows.map((row) => row.runId)).size !== rows.length) {
    problems.push('reused run id');
  }
  for (const row of rows) {
    const expected = MATRIX[row.mode];
    if (row.screenText !== SCREEN_TEXT) {
      problems.push(`${row.mode} screen`);
    }
    if (row.lookupStatus !== expected.lookupStatus || row.lookupCode !== expected.lookupCode) {
      problems.push(`${row.mode} lookup ${row.lookupStatus} ${row.lookupCode}`);
    }
    if (row.unavailableReason !== expected.unavailableReason) {
      problems.push(`${row.mode} unavailable reason ${row.unavailableReason}`);
    }
    if (row.verification !== expected.verification) {
      problems.push(`${row.mode} verification ${row.verification}`);
    }
    if (row.gate !== expected.gate) {
      problems.push(`${row.mode} gate ${row.gate}`);
    }
    if (row.scriptedDiagnosis !== expected.diagnosis) {
      problems.push(`${row.mode} diagnosis ${row.scriptedDiagnosis}`);
    }
    if (row.evidenceCheck !== expected.evidenceCheck) {
      problems.push(`${row.mode} evidence ${row.evidenceCheck}`);
    }
    if (row.reasonCodes.join(',') !== expected.reasonCodes.join(',')) {
      problems.push(`${row.mode} reasons ${row.reasonCodes.join(',')}`);
    }
    if (row.provider !== 'scripted-mock' || row.modelInvoked !== false || row.measuredFromModel !== false) {
      problems.push(`${row.mode} labels`);
    }
    if (row.policyVersion !== GATE_POLICY_VERSION) {
      problems.push(`${row.mode} policy`);
    }
    if (row.investigationOrderClassified !== false || row.investigationGateDecision !== null) {
      problems.push(`${row.mode} investigation`);
    }
    if (row.lookupCode === 'ABSENT' && row.lookupStatus === 503) {
      problems.push(`${row.mode} collapsed 503 into ABSENT`);
    }
  }
  return problems;
}

export function formatPipelineTable(rows: readonly DemoPipelineRow[]): string {
  const header = 'mode | orderId | screen | scripted diagnosis | evidence check | lookup | verification | gate | reason codes';
  const lines = rows.map((row) => {
    const lookup =
      row.lookupCode === 'UNAVAILABLE'
        ? `${row.lookupStatus} ${row.lookupCode} ${row.unavailableReason}`
        : `${row.lookupStatus} ${row.lookupCode}`;
    return [
      row.mode,
      row.orderId,
      row.screenText,
      row.scriptedDiagnosis,
      row.evidenceCheck,
      lookup,
      row.verification,
      row.gate,
      row.reasonCodes.join(','),
    ].join(' | ');
  });
  return [
    'provider: scripted-mock',
    'modelInvoked: false',
    'measuredFromModel: false',
    'Exit 0 means the three rows matched the matrix. It does not mean ALLOW.',
    header,
    ...lines,
    '',
  ].join('\n');
}
