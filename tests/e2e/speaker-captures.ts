import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

const SCENARIOS = ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'] as const satisfies readonly TestScenario[];

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

interface CaptureScenario {
  scenario: TestScenario;
  screenshot: string;
  orderId: string;
  runId: string;
  shownTotalCents: number;
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

function fileName(scenario: TestScenario): string {
  if (scenario === 'NORMAL') {
    return 'confirmation-normal.png';
  }
  if (scenario === 'GHOST_SUCCESS') {
    return 'confirmation-ghost.png';
  }
  return 'confirmation-unavailable.png';
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
  const repoRoot = resolve(import.meta.dirname, '../..');
  const publishDir = resolve(repoRoot, 'docs/speaker/captures');
  const scratchDir = resolve(repoRoot, 'test-results/speaker-captures');
  mkdirSync(scratchDir, { recursive: true });
  await globalSetup();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: WEB_ORIGIN, viewport: { ...VIEWPORT } });
    const page = await context.newPage();
    const api = await playwrightRequest.newContext();
    await page.goto('/');
    await page.getByRole('heading', { name: 'Catalog' }).waitFor();
    await page.getByRole('heading', { name: 'Ceramic Mug' }).waitFor();
    const catalogPath = resolve(scratchDir, 'catalog.png');
    await page.screenshot({ path: catalogPath, fullPage: true });
    const catalogNote = await page.locator('main').innerText();
    if (!catalogNote.includes('A message on this page is not proof that an order was saved.')) {
      throw new Error('Catalog page is missing the persistence note');
    }

    const runtime = readRuntime();
    const scenarios: CaptureScenario[] = [];
    for (const scenario of SCENARIOS) {
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
      const screenshot = fileName(scenario);
      await page.screenshot({ path: resolve(scratchDir, screenshot), fullPage: true });
      scenarios.push({
        scenario,
        screenshot,
        orderId: placed.orderId,
        runId: placed.runId,
        shownTotalCents: await shownCents(page),
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
    await context.close();

    const observations = {
      captureVersion: 'tqa-speaker-captures-1',
      capturedAt: new Date().toISOString(),
      modelInvoked: false,
      diagnosisSource: 'scripted-for-slide',
      policyVersion: GATE_POLICY_VERSION,
      uiMessage: UI_MESSAGE,
      screenNote: SCREEN_NOTE,
      viewport: VIEWPORT,
      catalogScreenshot: 'catalog.png',
      catalogSha256: sha256(catalogPath),
      scenarios,
      files: {
        'catalog.png': sha256(catalogPath),
        'confirmation-normal.png': sha256(resolve(scratchDir, 'confirmation-normal.png')),
        'confirmation-ghost.png': sha256(resolve(scratchDir, 'confirmation-ghost.png')),
        'confirmation-unavailable.png': sha256(resolve(scratchDir, 'confirmation-unavailable.png')),
      },
    };
    const distinct = new Set(scenarios.map((item) => item.orderId));
    if (distinct.size !== scenarios.length) {
      throw new Error('Capture reused an order id');
    }
    mkdirSync(publishDir, { recursive: true });
    for (const name of Object.keys(observations.files)) {
      copyFileSync(resolve(scratchDir, name), resolve(publishDir, name));
    }
    writeFileSync(resolve(publishDir, 'observations.json'), `${JSON.stringify(observations, null, 2)}\n`);
    process.stdout.write(`speaker-captures: wrote ${scenarios.length} confirmations\n`);
  } finally {
    await browser?.close();
    globalTeardown();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await main();
}
