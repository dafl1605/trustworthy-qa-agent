import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { MEASURED_BASELINE_PATH, loadMeasuredBaseline } from '../e2e/regression-baseline.ts';
import { scoreCheckedInStimuli } from '../evals/runner.ts';

const repoRoot = resolve(import.meta.dirname, '../..');
const slidesPath = resolve(repoRoot, 'docs/speaker/slides.md');
const observationsPath = resolve(repoRoot, 'docs/speaker/captures/observations.json');
const captureScriptPath = resolve(repoRoot, 'tests/e2e/speaker-captures.ts');

interface CaptureScenario {
  scenario: string;
  screenshot: string;
  orderId: string;
  runId: string;
  shownTotalCents: number;
  lookupStatus: number;
  lookupCode: string;
  unavailableReason: string | null;
  verificationStatus: string;
  gateWithoutDiagnosis: string;
  gateWithScriptedSuccess: string;
  gateWithScriptedMissingOrder: string | null;
  reasonCodesWithScriptedSuccess: string[];
  reasonCodesWithScriptedMissingOrder: string[] | null;
}

interface Observations {
  captureVersion: string;
  capturedAt: string;
  modelInvoked: boolean;
  diagnosisSource: string;
  policyVersion: string;
  uiMessage: string;
  screenNote: string;
  scenarios: CaptureScenario[];
  files: Record<string, string>;
}

function readObservations(): Observations {
  const parsed: unknown = JSON.parse(readFileSync(observationsPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('observations.json is not an object');
  }
  return parsed as Observations;
}

function matrixLine(row: CaptureScenario): string {
  const reason = row.unavailableReason === null ? '' : ` ${row.unavailableReason}`;
  return `${row.scenario}: lookup ${row.lookupStatus} ${row.lookupCode}${reason}, verification ${row.verificationStatus}, gate ${row.gateWithoutDiagnosis}.`;
}

function deckProblems(markdown: string, observations: Observations): string[] {
  const problems: string[] = [];
  const headings = [...markdown.matchAll(/^## Slide (\d+)\. /gm)].map((match) => Number(match[1]));
  if (headings.length < 12 || headings.length > 14) {
    problems.push(`slide count ${headings.length}`);
  }
  const expectedHeadings = Array.from({ length: headings.length }, (_, index) => index + 1);
  if (headings.join(',') !== expectedHeadings.join(',')) {
    problems.push('slide numbers are not contiguous from 1');
  }
  if (!markdown.includes('DRAFT') || !markdown.includes('Not sent')) {
    problems.push('draft status');
  }
  if (
    markdown.includes('This deck does not identify a backup recording.') ||
    !markdown.includes('docs/speaker/rehearsal/backup-recording.webm')
  ) {
    problems.push('recording claim');
  }
  if (markdown.includes('S-008 is now complete') || markdown.includes('spoken delivery was measured')) {
    problems.push('overclaim');
  }
  if (!markdown.includes('O-001 through O-007 remain UNVERIFIED')) {
    problems.push('probe status');
  }
  if (/\d+(?:\.\d+)?\s*%/.test(markdown)) {
    problems.push('percent figure');
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(markdown)) {
    problems.push('email address');
  }
  if (markdown.includes('has been sent') || markdown.includes('probes passed')) {
    problems.push('overclaim');
  }
  const freeze = loadMeasuredBaseline(MEASURED_BASELINE_PATH);
  const report = scoreCheckedInStimuli();
  const required = [
    observations.capturedAt,
    observations.uiMessage,
    observations.screenNote,
    observations.policyVersion,
    freeze.baselineVersion,
    freeze.limitation,
    freeze.regression.command,
    freeze.expectedNegative.command,
    `Regression exit codes ${freeze.regression.exitCodes.join(', ')}.`,
    `Ghost-oracle exit codes ${freeze.expectedNegative.exitCodes.join(', ')}.`,
    `Ghost-oracle lookup statuses ${freeze.expectedNegative.observedLookupStatuses.join(', ')}.`,
    'The ghost-oracle assertion still expects HTTP 200.',
    report.limitation,
    'measuredFromModel` is false',
    'modelInvoked` is false',
    `classification match ${report.counts.classification.match}, mismatch ${report.counts.classification.mismatch}, abstained ${report.counts.classification.abstained}.`,
    `evidence coverage covered ${report.counts.evidenceCoverage.covered}, uncovered ${report.counts.evidenceCoverage.uncovered}, not applicable ${report.counts.evidenceCoverage.not_applicable}.`,
    `abstention appropriate ${report.counts.abstention.appropriate}, inappropriate ${report.counts.abstention.inappropriate}.`,
    `critical defects detected ${report.counts.criticalDefect.detected}, missed ${report.counts.criticalDefect.missed}.`,
    `gate match ${report.counts.gate.match}, consistent ${report.counts.gateConsistency.consistent}.`,
    ...observations.scenarios.map((row) => row.orderId),
    ...observations.scenarios.map((row) => matrixLine(row)),
    'GHOST_SUCCESS with scripted SUCCESS stayed BLOCK (VERIFICATION_DEFECT, DIAGNOSIS_IGNORED).',
    'VERIFICATION_UNAVAILABLE with a scripted missing-order claim stayed HOLD (VERIFICATION_UNKNOWN, DIAGNOSIS_IGNORED).',
  ];
  for (const sentence of required) {
    if (!markdown.includes(sentence)) {
      problems.push(`missing: ${sentence}`);
    }
  }
  for (const duration of [...freeze.regression.durationMs, ...freeze.expectedNegative.durationMs]) {
    if (markdown.includes(String(duration))) {
      problems.push(`duration copied: ${duration}`);
    }
  }
  return problems;
}

describe('speaker slides', () => {
  const observations = readObservations();
  const slides = readFileSync(slidesPath, 'utf8');

  it('keeps the capture on the decision matrix and the measured files', () => {
    assert.equal(observations.captureVersion, 'tqa-speaker-captures-1');
    assert.equal(observations.modelInvoked, false);
    assert.equal(observations.diagnosisSource, 'scripted-for-slide');
    assert.equal(observations.policyVersion, 'tqa-gate-1');
    assert.equal(observations.uiMessage, 'Order confirmed');
    assert.equal(observations.screenNote, 'This message is not proof that an order was saved.');
    assert.equal(observations.scenarios.length, 3);
    assert.deepEqual(
      observations.scenarios.map((row) => row.scenario),
      ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'],
    );
    assert.deepEqual(
      observations.scenarios.map((row) => [row.lookupStatus, row.lookupCode, row.verificationStatus, row.gateWithoutDiagnosis]),
      [
        [200, 'FOUND', 'CONFIRMED', 'ALLOW'],
        [404, 'ABSENT', 'DEFECT', 'BLOCK'],
        [503, 'UNAVAILABLE', 'UNKNOWN', 'HOLD'],
      ],
    );
    const ghost = observations.scenarios[1];
    const unavailable = observations.scenarios[2];
    assert.ok(ghost);
    assert.ok(unavailable);
    assert.equal(ghost.gateWithScriptedSuccess, 'BLOCK');
    assert.deepEqual(ghost.reasonCodesWithScriptedSuccess, ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED']);
    assert.equal(unavailable.unavailableReason, 'service_unavailable');
    assert.equal(unavailable.gateWithScriptedSuccess, 'HOLD');
    assert.equal(unavailable.gateWithScriptedMissingOrder, 'HOLD');
    assert.deepEqual(unavailable.reasonCodesWithScriptedMissingOrder, ['VERIFICATION_UNKNOWN', 'DIAGNOSIS_IGNORED']);
    assert.equal(new Set(observations.scenarios.map((row) => row.orderId)).size, 3);
    assert.equal(new Set(observations.scenarios.map((row) => row.runId)).size, 3);
    for (const row of observations.scenarios) {
      assert.equal(row.shownTotalCents, 1299);
      assert.equal(row.lookupCode === 'ABSENT' && row.lookupStatus === 503, false);
    }
    assert.deepEqual(deckProblems(slides, observations), []);
  });

  it('rejects a deck that turns the ghost read into a pass or adds a percent', () => {
    const ghostLine = matrixLine(observations.scenarios[1] as CaptureScenario);
    const passed = slides.replace(ghostLine, 'GHOST_SUCCESS: lookup 200 FOUND, verification CONFIRMED, gate ALLOW.');
    assert.ok(deckProblems(passed, observations).some((problem) => problem.startsWith('missing:')));
    const rated = `${slides}\nThe model accuracy was 92%.\n`;
    assert.ok(deckProblems(rated, observations).includes('percent figure'));
    const recorded = slides.replaceAll(
      'docs/speaker/rehearsal/backup-recording.webm',
      'This deck does not identify a backup recording.',
    );
    assert.ok(deckProblems(recorded, observations).includes('recording claim'));
    const complete = slides.replace('S-008 is not complete.', 'S-008 is now complete.');
    assert.ok(deckProblems(complete, observations).includes('overclaim'));
  });

  it('binds each cited screenshot to the hash from the capture', () => {
    const hashes = new Set<string>();
    for (const [name, hash] of Object.entries(observations.files)) {
      const path = resolve(repoRoot, 'docs/speaker/captures', name);
      const bytes = readFileSync(path);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
      assert.equal(slides.includes(`captures/${name}`), true);
      hashes.add(hash);
    }
    assert.equal(hashes.size, Object.keys(observations.files).length);
    const config = readFileSync(resolve(repoRoot, 'tests/e2e/playwright.config.ts'), 'utf8');
    assert.match(config, /testMatch: \/\.\*\\\.spec\\\.ts\//);
    assert.equal(captureScriptPath.endsWith('.spec.ts'), false);
    assert.equal(readFileSync(captureScriptPath, 'utf8').includes('@expected-negative'), false);
  });
});
