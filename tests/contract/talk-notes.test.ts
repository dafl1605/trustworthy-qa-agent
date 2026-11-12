import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { loadMeasuredBaseline } from '../e2e/regression-baseline.ts';
import { scoreCheckedInStimuli } from '../evals/runner.ts';

const repoRoot = resolve(import.meta.dirname, '../..');
const notesPath = resolve(repoRoot, 'docs/speaker/talk-notes.md');
const outlinePath = resolve(repoRoot, 'docs/speaker/talk-rehearsal.json');
const deliverablesPath = resolve(repoRoot, 'docs/speaker/deliverables.md');
const readmePath = resolve(repoRoot, 'README.md');
const slidesPath = resolve(repoRoot, 'docs/speaker/slides.md');
const demoRehearsalPath = resolve(repoRoot, 'docs/speaker/rehearsal/rehearsal.json');

interface SpeechSegment {
  id: string;
  startSeconds: number;
  durationSeconds: number;
  label: string;
}

interface TalkOutline {
  rehearsalVersion: string;
  rehearsalKind: string;
  modelInvoked: boolean;
  spokenDeliveryMeasured: boolean;
  spokenElapsedSeconds: number | null;
  s008Complete: boolean;
  plannedContentSeconds: number;
  demoPlanSeconds: number;
  policyVersion: string;
  backupRecordingPath: string;
  deckIdentifiesBackupRecording: boolean;
  demoScriptPath: string;
  talkNotesPath: string;
  runbookPath: string;
  deliverablesPath: string;
  limitation: string;
  segments: SpeechSegment[];
}

function readOutline(): TalkOutline {
  const parsed: unknown = JSON.parse(readFileSync(outlinePath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('talk-rehearsal.json is not an object');
  }
  return parsed as TalkOutline;
}

function segmentLine(segment: SpeechSegment): string {
  return `Plan ${segment.id}: ${segment.durationSeconds} seconds, from ${segment.startSeconds}. ${segment.label}`;
}

function requiredSentences(outline: TalkOutline, includePlan: boolean): string[] {
  const freeze = loadMeasuredBaseline(resolve(repoRoot, 'fixtures/regression-baseline/baseline.json'));
  const report = scoreCheckedInStimuli();
  const shared = [
    'A person has not timed the talk aloud. S-008 is not complete.',
    '`spokenDeliveryMeasured` is false.',
    'The backup recording is `docs/speaker/rehearsal/backup-recording.webm`.',
    'A 503 is not a 404.',
    '`pnpm test:e2e` passing does not mean `ALLOW`.',
    '`pnpm test:e2e:ghost-oracle` is expected to fail the ghost case with 404 `ABSENT`.',
    'O-001 through O-007 remain UNVERIFIED',
    'Do not quote a percent.',
  ];
  if (!includePlan) {
    return [
      ...shared,
      '`NORMAL` checkout persists the order: lookup `200 FOUND`, verification `CONFIRMED`, gate `ALLOW`.',
      '`GHOST_SUCCESS` shows `Order confirmed` and persists no order: lookup `404 ABSENT`, verification `DEFECT`, gate `BLOCK`.',
      '`VERIFICATION_UNAVAILABLE` shows `Order confirmed` and the order read returns 503 `service_unavailable`: verification `UNKNOWN`, gate `HOLD`.',
      'The deck in `docs/speaker/slides.md` identifies `docs/speaker/rehearsal/backup-recording.webm`.',
    ];
  }
  return [
    ...shared,
    '`modelInvoked` is false',
    'The deck in `docs/speaker/slides.md` identifies `docs/speaker/rehearsal/backup-recording.webm`.',
    'This message is not proof that an order was saved.',
    '`HOLD` is not a softer `BLOCK`.',
    'A scripted SUCCESS diagnosis left GHOST_SUCCESS at BLOCK.',
    'A scripted SUCCESS diagnosis left VERIFICATION_UNAVAILABLE at HOLD.',
    'Do not say S-008 is complete.',
    freeze.limitation,
    report.limitation,
    'The 54-hour baseline and the 9-hour contingency are unchanged.',
    ...outline.segments.map((segment) => segmentLine(segment)),
  ];
}

function proseProblems(markdown: string, outline: TalkOutline, includePlan: boolean): string[] {
  const problems: string[] = [];
  const freeze = loadMeasuredBaseline(resolve(repoRoot, 'fixtures/regression-baseline/baseline.json'));
  for (const sentence of requiredSentences(outline, includePlan)) {
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
  if (markdown.includes('has been sent') || markdown.includes('probes passed')) {
    problems.push('overclaim');
  }
  if (!markdown.includes('NORMAL') || !markdown.includes('GHOST_SUCCESS') || !markdown.includes('VERIFICATION_UNAVAILABLE')) {
    problems.push('missing scenario');
  }
  const demoElapsed = JSON.parse(readFileSync(demoRehearsalPath, 'utf8')) as { elapsedMs?: unknown };
  if (typeof demoElapsed.elapsedMs === 'number' && markdown.includes(String(demoElapsed.elapsedMs))) {
    problems.push('automation duration copied');
  }
  for (const duration of [...freeze.regression.durationMs, ...freeze.expectedNegative.durationMs]) {
    if (markdown.includes(String(duration))) {
      problems.push(`duration copied: ${duration}`);
    }
  }
  return problems;
}

describe('talk outline', () => {
  const outline = readOutline();
  const notes = readFileSync(notesPath, 'utf8');
  const readme = readFileSync(readmePath, 'utf8');
  const deliverables = readFileSync(deliverablesPath, 'utf8');

  it('plans 2100 seconds and leaves the spoken timing unmeasured', () => {
    assert.equal(outline.rehearsalVersion, 'tqa-talk-outline-1');
    assert.equal(outline.rehearsalKind, 'planned-english-talk');
    assert.equal(outline.modelInvoked, false);
    assert.equal(outline.spokenDeliveryMeasured, false);
    assert.equal(outline.spokenElapsedSeconds, null);
    assert.equal(outline.s008Complete, false);
    assert.equal(outline.plannedContentSeconds, 2100);
    assert.equal(outline.demoPlanSeconds, 720);
    assert.equal(outline.policyVersion, 'tqa-gate-1');
    assert.equal(outline.backupRecordingPath, 'docs/speaker/rehearsal/backup-recording.webm');
    assert.equal(outline.deckIdentifiesBackupRecording, true);
    assert.equal(outline.demoScriptPath, 'docs/speaker/demo-script.md');
    assert.equal(outline.talkNotesPath, 'docs/speaker/talk-notes.md');
    assert.equal(outline.runbookPath, 'README.md');
    assert.equal(outline.deliverablesPath, 'docs/speaker/deliverables.md');
    assert.match(outline.limitation, /spokenElapsedSeconds is null/);
    assert.deepEqual(
      outline.segments.map((segment) => segment.id),
      ['open', 'screen', 'matrix', 'pipeline', 'demo', 'limits', 'close'],
    );
    const demo = outline.segments.find((segment) => segment.id === 'demo');
    assert.ok(demo);
    assert.equal(demo.durationSeconds, 720);
    let cursor = 0;
    let planned = 0;
    for (const segment of outline.segments) {
      assert.equal(segment.startSeconds, cursor);
      assert.ok(segment.durationSeconds > 0);
      cursor += segment.durationSeconds;
      planned += segment.durationSeconds;
    }
    assert.equal(planned, 2100);
    assert.equal(cursor, 2100);
    const slides = readFileSync(slidesPath, 'utf8');
    assert.equal(slides.includes('docs/speaker/rehearsal/backup-recording.webm'), true);
    assert.equal(slides.includes('This deck does not identify a backup recording.'), false);
    assert.deepEqual(proseProblems(notes, outline, true), []);
    assert.deepEqual(proseProblems(readme, outline, false), []);
    for (const path of [
      outline.backupRecordingPath,
      outline.demoScriptPath,
      outline.talkNotesPath,
      outline.runbookPath,
      outline.deliverablesPath,
      'docs/speaker/rehearsal/rehearsal.json',
      'docs/speaker/captures/observations.json',
      'fixtures/golden-dataset/cases.json',
      'fixtures/regression-baseline/baseline.json',
      'docs/speaker/slides.md',
      'docs/speaker/2026-11-25-browserstack-draft.md',
    ]) {
      assert.equal(deliverables.includes(path), true, path);
      assert.ok(readFileSync(resolve(repoRoot, path)).byteLength > 0, path);
    }
  });

  it('rejects a runbook that hides the ghost defect or claims a spoken timing', () => {
    const hidden = readme.replace(
      '`GHOST_SUCCESS` shows `Order confirmed` and persists no order: lookup `404 ABSENT`, verification `DEFECT`, gate `BLOCK`.',
      '`GHOST_SUCCESS` shows `Order confirmed` and persists no order: lookup `200 FOUND`, verification `CONFIRMED`, gate `ALLOW`.',
    );
    assert.ok(proseProblems(hidden, outline, false).some((problem) => problem.startsWith('missing:')));
    const rated = `${notes}\nThe talk reliability was 99%.\n`;
    assert.ok(proseProblems(rated, outline, true).includes('percent figure'));
    const spoken = notes.replace(
      'A person has not timed the talk aloud. S-008 is not complete.',
      'A person has timed the talk aloud. S-008 is now complete.',
    );
    const spokenProblems = proseProblems(spoken, outline, true);
    assert.ok(spokenProblems.some((problem) => problem.startsWith('missing:')));
    assert.ok(spokenProblems.includes('overclaim'));
  });
});
