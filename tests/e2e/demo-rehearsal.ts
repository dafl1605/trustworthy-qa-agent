import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, request as playwrightRequest, type Browser, type Page } from '@playwright/test';
import { decideRelease, GATE_POLICY_VERSION } from '@tqa/quality-gate';
import type { TestScenario } from '@tqa/shared';
import { verifyOrder } from '@tqa/validators';
import { placeMugOrder, lookupOrder } from './checkout-flow.ts';
import { WEB_ORIGIN } from './endpoints.ts';
import globalSetup from './global-setup.ts';
import globalTeardown from './global-teardown.ts';
import { readRuntime } from './runtime.ts';

const VIEWPORT = { width: 1280, height: 800 } as const;
const SCREEN_NOTE = 'This message is not proof that an order was saved.';
const UI_MESSAGE = 'Order confirmed';
const SUCCESS_SUMMARY = 'The confirmation screen says the order succeeded.';
const MISSING_SUMMARY = 'Treat this 503 as a confirmed missing order.';
const TWELVE_MINUTE_BUDGET_MS = 720_000;
const VISIBLE_HOLD_MS = 3_000;
const BACKUP_RECORDING = 'docs/speaker/rehearsal/backup-recording.webm';

const SCENARIOS = ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'] as const satisfies readonly TestScenario[];

export const PLANNED_SPEECH_SEGMENTS = [
  { id: 'open', startSeconds: 0, durationSeconds: 60, label: 'Open: a passing screen is not the order' },
  { id: 'normal', startSeconds: 60, durationSeconds: 180, label: 'NORMAL: the screen and the stored row agree' },
  { id: 'ghost', startSeconds: 240, durationSeconds: 240, label: 'GHOST_SUCCESS: the screen passes and the row is absent' },
  {
    id: 'unavailable',
    startSeconds: 480,
    durationSeconds: 180,
    label: 'VERIFICATION_UNAVAILABLE: a 503 is not a 404',
  },
  {
    id: 'close',
    startSeconds: 660,
    durationSeconds: 60,
    label: 'Close: the backup recording is the screen, not the oracle',
  },
] as const;

const EXPECTED = {
  NORMAL: {
    lookupStatus: 200,
    lookupCode: 'FOUND',
    verificationStatus: 'CONFIRMED',
    gate: 'ALLOW',
    gateWithScriptedSuccess: 'ALLOW',
    successReasonCodes: ['VERIFICATION_CONFIRMED'],
  },
  GHOST_SUCCESS: {
    lookupStatus: 404,
    lookupCode: 'ABSENT',
    verificationStatus: 'DEFECT',
    gate: 'BLOCK',
    gateWithScriptedSuccess: 'BLOCK',
    successReasonCodes: ['VERIFICATION_DEFECT', 'DIAGNOSIS_IGNORED'],
  },
  VERIFICATION_UNAVAILABLE: {
    lookupStatus: 503,
    lookupCode: 'UNAVAILABLE',
    verificationStatus: 'UNKNOWN',
    gate: 'HOLD',
    gateWithScriptedSuccess: 'HOLD',
    successReasonCodes: ['VERIFICATION_UNKNOWN', 'DIAGNOSIS_IGNORED'],
  },
} as const;

interface RehearsalScenario {
  scenario: TestScenario;
  orderId: string;
  runId: string;
  durationMs: number;
  shownTotalCents: number;
  confirmationMessage: string;
  lookupStatus: number;
  lookupCode: 'FOUND' | 'ABSENT' | 'UNAVAILABLE';
  unavailableReason: 'timeout' | 'service_unavailable' | null;
  verificationStatus: 'CONFIRMED' | 'DEFECT' | 'UNKNOWN';
  gateWithoutDiagnosis: 'ALLOW' | 'BLOCK' | 'HOLD';
  gateWithScriptedSuccess: 'ALLOW' | 'BLOCK' | 'HOLD';
  gateWithScriptedMissingOrder: 'HOLD' | null;
  reasonCodesWithoutDiagnosis: string[];
  reasonCodesWithScriptedSuccess: string[];
  reasonCodesWithScriptedMissingOrder: string[] | null;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function scriptedDiagnosis(runId: string, summary: string) {
  return {
    runId,
    diagnosis: 'SUCCESS' as const,
    summary,
    claims: [{ text: summary, evidenceIds: [] as string[] }],
    missingEvidence: [] as string[],
    needsHumanReview: false,
  };
}

async function shownCents(page: Page): Promise<number> {
  const region = page.getByRole('region', { name: 'Confirmation' });
  const text = await region.innerText();
  const match = text.match(/\((\d+) cents\)/);
  if (match?.[1] === undefined) {
    throw new Error('Confirmation did not show an integer cent total');
  }
  return Number(match[1]);
}

async function main(): Promise<void> {
  const startedAt = new Date();
  const startedMs = Date.now();
  const repoRoot = resolve(import.meta.dirname, '../..');
  const publishDir = resolve(repoRoot, 'docs/speaker/rehearsal');
  const scratchDir = resolve(repoRoot, 'test-results/demo-rehearsal');
  mkdirSync(scratchDir, { recursive: true });
  await globalSetup();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({
      baseURL: WEB_ORIGIN,
      viewport: { ...VIEWPORT },
      recordVideo: { dir: scratchDir, size: { ...VIEWPORT } },
    });
    const page = await context.newPage();
    const video = page.video();
    if (video === null) {
      throw new Error('The backup recording was not opened');
    }
    const api = await playwrightRequest.newContext();
    await page.goto('/');
    await page.getByRole('heading', { name: 'Catalog' }).waitFor();
    const catalogNote = await page.locator('main').innerText();
    if (!catalogNote.includes('A message on this page is not proof that an order was saved.')) {
      throw new Error('Catalog page is missing the persistence note');
    }
    // The backup video has to show the catalog. This hold is not an assertion wait.
    await page.waitForTimeout(VISIBLE_HOLD_MS);

    const runtime = readRuntime();
    const scenarios: RehearsalScenario[] = [];
    for (const scenario of SCENARIOS) {
      const scenarioStarted = Date.now();
      const placed = await placeMugOrder(page, api, scenario);
      if (placed.confirmationMessage !== UI_MESSAGE) {
        throw new Error(`${scenario} confirmation was ${placed.confirmationMessage}`);
      }
      await page.getByText(SCREEN_NOTE, { exact: true }).waitFor();
      const lookup = await lookupOrder(api, placed.orderId);
      const verification = verifyOrder({
        databasePath: runtime.databasePath,
        orderId: placed.orderId,
        runId: placed.runId,
      });
      const plain = decideRelease({ verification });
      const withSuccess = decideRelease({
        verification,
        diagnosis: scriptedDiagnosis(placed.runId, SUCCESS_SUMMARY),
      });
      const expected = EXPECTED[scenario];
      if (lookup.status !== expected.lookupStatus || lookup.body.code !== expected.lookupCode) {
        throw new Error(`${scenario} lookup was ${lookup.status} ${lookup.body.code}`);
      }
      if (verification.status !== expected.verificationStatus) {
        throw new Error(`${scenario} verification was ${verification.status}`);
      }
      if (plain.decision !== expected.gate || plain.policyVersion !== GATE_POLICY_VERSION) {
        throw new Error(`${scenario} gate was ${plain.decision}`);
      }
      if (
        withSuccess.decision !== expected.gateWithScriptedSuccess ||
        withSuccess.reasonCodes.join(',') !== expected.successReasonCodes.join(',')
      ) {
        throw new Error(`${scenario} scripted success gate was ${withSuccess.decision}`);
      }
      let gateWithScriptedMissingOrder: 'HOLD' | null = null;
      let reasonCodesWithScriptedMissingOrder: string[] | null = null;
      if (scenario === 'VERIFICATION_UNAVAILABLE') {
        const withMissing = decideRelease({
          verification,
          diagnosis: scriptedDiagnosis(placed.runId, MISSING_SUMMARY),
        });
        if (withMissing.decision !== 'HOLD' || withMissing.reasonCodes.join(',') !== 'VERIFICATION_UNKNOWN,DIAGNOSIS_IGNORED') {
          throw new Error(`Unavailable missing-order diagnosis became ${withMissing.decision}`);
        }
        gateWithScriptedMissingOrder = 'HOLD';
        reasonCodesWithScriptedMissingOrder = [...withMissing.reasonCodes];
      }
      if (scenario === 'VERIFICATION_UNAVAILABLE' && lookup.body.code === 'UNAVAILABLE' && lookup.body.reason !== 'service_unavailable') {
        throw new Error(`Unavailable reason was ${lookup.body.reason}`);
      }
      // The backup video has to show this confirmation. This hold is not an assertion wait.
      await page.waitForTimeout(VISIBLE_HOLD_MS);
      scenarios.push({
        scenario,
        orderId: placed.orderId,
        runId: placed.runId,
        durationMs: Date.now() - scenarioStarted,
        shownTotalCents: await shownCents(page),
        confirmationMessage: placed.confirmationMessage,
        lookupStatus: lookup.status,
        lookupCode: lookup.body.code,
        unavailableReason: lookup.body.code === 'UNAVAILABLE' ? lookup.body.reason : null,
        verificationStatus: verification.status,
        gateWithoutDiagnosis: plain.decision,
        gateWithScriptedSuccess: withSuccess.decision,
        gateWithScriptedMissingOrder,
        reasonCodesWithoutDiagnosis: [...plain.reasonCodes],
        reasonCodesWithScriptedSuccess: [...withSuccess.reasonCodes],
        reasonCodesWithScriptedMissingOrder,
      });
    }
    await api.dispose();
    await page.close();
    await context.close();
    const recordedPath = await video.path();
    const elapsedMs = Date.now() - startedMs;
    const distinctOrders = new Set(scenarios.map((item) => item.orderId));
    const distinctRuns = new Set(scenarios.map((item) => item.runId));
    if (distinctOrders.size !== scenarios.length || distinctRuns.size !== scenarios.length) {
      throw new Error('Rehearsal reused an order id or a run id');
    }
    mkdirSync(publishDir, { recursive: true });
    const backupPath = resolve(repoRoot, BACKUP_RECORDING);
    copyFileSync(recordedPath, backupPath);
    const backupStat = statSync(backupPath);
    const rehearsal = {
      rehearsalVersion: 'tqa-demo-rehearsal-1',
      rehearsedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      modelInvoked: false,
      diagnosisSource: 'scripted-for-rehearsal',
      spokenDeliveryMeasured: false,
      rehearsalKind: 'automated-checkout-paths',
      twelveMinuteBudgetMs: TWELVE_MINUTE_BUDGET_MS,
      visibleHoldMs: VISIBLE_HOLD_MS,
      elapsedMs,
      automationFitsBudget: elapsedMs <= TWELVE_MINUTE_BUDGET_MS,
      policyVersion: GATE_POLICY_VERSION,
      uiMessage: UI_MESSAGE,
      screenNote: SCREEN_NOTE,
      limitation:
        'This file times the three automated checkout paths. Each confirmation is held on screen so the backup video can show it. That hold is not a spoken pause. A person has not timed the operator script aloud. The video shows the confirmation screen. It is not the order lookup and it is not a release decision.',
      backupRecording: {
        path: BACKUP_RECORDING,
        mediaType: 'video/webm',
        sha256: sha256(backupPath),
        bytes: backupStat.size,
        role: 'backup-if-live-demo-cannot-run',
      },
      plannedSpeechSegments: PLANNED_SPEECH_SEGMENTS.map((segment) => ({ ...segment })),
      scenarios,
    };
    writeFileSync(resolve(publishDir, 'rehearsal.json'), `${JSON.stringify(rehearsal, null, 2)}\n`);
    process.stdout.write(
      `demo-rehearsal: wrote 3 paths in ${elapsedMs} ms. Exit 0 means the matrix matched. It does not mean ALLOW.\n`,
    );
  } finally {
    await browser?.close();
    globalTeardown();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await main();
}
