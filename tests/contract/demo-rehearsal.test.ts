import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../..');
const scriptPath = resolve(repoRoot, 'docs/speaker/demo-script.md');
const rehearsalPath = resolve(repoRoot, 'docs/speaker/rehearsal/rehearsal.json');
const rehearsalScriptPath = resolve(repoRoot, 'tests/e2e/demo-rehearsal.ts');
const slidesPath = resolve(repoRoot, 'docs/speaker/slides.md');

interface SpeechSegment {
  id: string;
  startSeconds: number;
  durationSeconds: number;
  label: string;
}

interface RehearsalScenario {
  scenario: string;
  orderId: string;
  runId: string;
  durationMs: number;
  shownTotalCents: number;
  confirmationMessage: string;
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

interface Rehearsal {
  rehearsalVersion: string;
  modelInvoked: boolean;
  diagnosisSource: string;
  spokenDeliveryMeasured: boolean;
  rehearsalKind: string;
  twelveMinuteBudgetMs: number;
  visibleHoldMs: number;
  elapsedMs: number;
  automationFitsBudget: boolean;
  policyVersion: string;
  uiMessage: string;
  screenNote: string;
  backupRecording: {
    path: string;
    mediaType: string;
    sha256: string;
    bytes: number;
    role: string;
  };
  plannedSpeechSegments: SpeechSegment[];
  scenarios: RehearsalScenario[];
}

function readRehearsal(): Rehearsal {
  const parsed: unknown = JSON.parse(readFileSync(rehearsalPath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('rehearsal.json is not an object');
  }
  return parsed as Rehearsal;
}

function segmentLine(segment: SpeechSegment): string {
  return `Plan ${segment.id}: ${segment.durationSeconds} seconds, from ${segment.startSeconds}. ${segment.label}`;
}

function scriptProblems(markdown: string, rehearsal: Rehearsal): string[] {
  const problems: string[] = [];
  const required = [
    'A person has not timed this script aloud. S-008 is not complete.',
    'The 35-minute outline is `docs/speaker/talk-notes.md`. A person has not timed that outline aloud.',
    'This file is the backup recording: `docs/speaker/rehearsal/backup-recording.webm`.',
    'The video is not the order lookup and it is not a release decision.',
    'Each confirmation is held on screen. The hold is not a spoken pause.',
    'Exit 0 means the three paths matched the matrix below. It does not mean `ALLOW`.',
    'A scripted SUCCESS diagnosis left GHOST_SUCCESS at BLOCK.',
    'A scripted SUCCESS diagnosis left VERIFICATION_UNAVAILABLE at HOLD.',
    'A 503 is not a 404.',
    rehearsal.uiMessage,
    rehearsal.screenNote,
    '`modelInvoked` is false',
    '`spokenDeliveryMeasured` is false',
    'O-001 through O-007 remain UNVERIFIED',
    'Do not say S-008 is complete.',
    ...rehearsal.plannedSpeechSegments.map((segment) => segmentLine(segment)),
  ];
  for (const sentence of required) {
    if (!markdown.includes(sentence)) {
      problems.push(`missing: ${sentence}`);
    }
  }
  if (/\d+(?:\.\d+)?\s*%/.test(markdown)) {
    problems.push('percent figure');
  }
  if (markdown.includes('S-008 is now complete') || markdown.includes('spoken delivery was measured')) {
    problems.push('overclaim');
  }
  if (!markdown.includes('NORMAL') || !markdown.includes('GHOST_SUCCESS') || !markdown.includes('VERIFICATION_UNAVAILABLE')) {
    problems.push('missing scenario');
  }
  return problems;
}

describe('demo rehearsal', () => {
  const rehearsal = readRehearsal();
  const script = readFileSync(scriptPath, 'utf8');

  it('keeps the measured paths on the decision matrix and identifies the backup', () => {
    assert.equal(rehearsal.rehearsalVersion, 'tqa-demo-rehearsal-1');
    assert.equal(rehearsal.modelInvoked, false);
    assert.equal(rehearsal.diagnosisSource, 'scripted-for-rehearsal');
    assert.equal(rehearsal.spokenDeliveryMeasured, false);
    assert.equal(rehearsal.rehearsalKind, 'automated-checkout-paths');
    assert.equal(rehearsal.twelveMinuteBudgetMs, 720_000);
    assert.equal(rehearsal.visibleHoldMs, 3_000);
    assert.equal(Number.isInteger(rehearsal.elapsedMs), true);
    assert.ok(rehearsal.elapsedMs > 0);
    assert.equal(rehearsal.automationFitsBudget, rehearsal.elapsedMs <= rehearsal.twelveMinuteBudgetMs);
    assert.equal(rehearsal.policyVersion, 'tqa-gate-1');
    assert.equal(rehearsal.uiMessage, 'Order confirmed');
    assert.equal(rehearsal.screenNote, 'This message is not proof that an order was saved.');
    assert.equal(rehearsal.backupRecording.path, 'docs/speaker/rehearsal/backup-recording.webm');
    assert.equal(rehearsal.backupRecording.mediaType, 'video/webm');
    assert.equal(rehearsal.backupRecording.role, 'backup-if-live-demo-cannot-run');
    assert.equal(rehearsal.scenarios.length, 3);
    assert.deepEqual(
      rehearsal.scenarios.map((row) => row.scenario),
      ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'],
    );
    assert.deepEqual(
      rehearsal.scenarios.map((row) => [row.lookupStatus, row.lookupCode, row.verificationStatus, row.gateWithoutDiagnosis]),
      [
        [200, 'FOUND', 'CONFIRMED', 'ALLOW'],
        [404, 'ABSENT', 'DEFECT', 'BLOCK'],
        [503, 'UNAVAILABLE', 'UNKNOWN', 'HOLD'],
      ],
    );
    const ghost = rehearsal.scenarios[1];
    const unavailable = rehearsal.scenarios[2];
    assert.ok(ghost);
    assert.ok(unavailable);
    assert.equal(ghost.gateWithScriptedSuccess, 'BLOCK');
    assert.deepEqual(ghost.reasonCodesWithScriptedSuccess, ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED']);
    assert.equal(unavailable.unavailableReason, 'service_unavailable');
    assert.equal(unavailable.gateWithScriptedSuccess, 'HOLD');
    assert.equal(unavailable.gateWithScriptedMissingOrder, 'HOLD');
    assert.deepEqual(unavailable.reasonCodesWithScriptedMissingOrder, ['VERIFICATION_UNKNOWN', 'DIAGNOSIS_IGNORED']);
    assert.equal(new Set(rehearsal.scenarios.map((row) => row.orderId)).size, 3);
    assert.equal(new Set(rehearsal.scenarios.map((row) => row.runId)).size, 3);
    let scenarioMs = 0;
    for (const row of rehearsal.scenarios) {
      assert.equal(row.confirmationMessage, 'Order confirmed');
      assert.equal(row.shownTotalCents, 1299);
      assert.ok(row.durationMs >= rehearsal.visibleHoldMs);
      scenarioMs += row.durationMs;
      assert.equal(row.lookupCode === 'ABSENT' && row.lookupStatus === 503, false);
    }
    assert.ok(scenarioMs <= rehearsal.elapsedMs);
    const segments = rehearsal.plannedSpeechSegments;
    assert.deepEqual(
      segments.map((segment) => segment.id),
      ['open', 'normal', 'ghost', 'unavailable', 'close'],
    );
    let cursor = 0;
    let planned = 0;
    for (const segment of segments) {
      assert.equal(segment.startSeconds, cursor);
      assert.ok(segment.durationSeconds > 0);
      cursor += segment.durationSeconds;
      planned += segment.durationSeconds;
    }
    assert.equal(planned, 720);
    assert.equal(cursor, 720);
    const videoPath = resolve(repoRoot, rehearsal.backupRecording.path);
    const bytes = readFileSync(videoPath);
    assert.ok(bytes.length > 1000);
    assert.equal(bytes.length, rehearsal.backupRecording.bytes);
    assert.equal(bytes.subarray(0, 4).toString('hex'), '1a45dfa3');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), rehearsal.backupRecording.sha256);
    assert.deepEqual(scriptProblems(script, rehearsal), []);
    const slides = readFileSync(slidesPath, 'utf8');
    assert.equal(slides.includes('docs/speaker/rehearsal/backup-recording.webm'), true);
    assert.equal(slides.includes('This deck does not identify a backup recording.'), false);
  });

  it('rejects a script that hides the ghost defect or claims a spoken timing', () => {
    const hidden = script.replace(
      'A scripted SUCCESS diagnosis left GHOST_SUCCESS at BLOCK.',
      'A scripted SUCCESS diagnosis left GHOST_SUCCESS at ALLOW.',
    );
    assert.ok(scriptProblems(hidden, rehearsal).some((problem) => problem.startsWith('missing:')));
    const rated = `${script}\nThe demo reliability was 99%.\n`;
    assert.ok(scriptProblems(rated, rehearsal).includes('percent figure'));
    const spoken = script.replace(
      'A person has not timed this script aloud. S-008 is not complete.',
      'A person has timed this script aloud. S-008 is now complete.',
    );
    const spokenProblems = scriptProblems(spoken, rehearsal);
    assert.ok(spokenProblems.some((problem) => problem.startsWith('missing:')));
    assert.ok(spokenProblems.includes('overclaim'));
  });

  it('keeps the rehearsal command outside the regression project', () => {
    const config = readFileSync(resolve(repoRoot, 'tests/e2e/playwright.config.ts'), 'utf8');
    assert.match(config, /testMatch: \/\.\*\\\.spec\\\.ts\//);
    assert.equal(rehearsalScriptPath.endsWith('.spec.ts'), false);
    const source = readFileSync(rehearsalScriptPath, 'utf8');
    assert.equal(source.includes('@expected-negative'), false);
    const packageJson = readFileSync(resolve(repoRoot, 'package.json'), 'utf8');
    assert.match(packageJson, /"demo:rehearsal":/);
  });
});
