import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, request as playwrightRequest, type Browser } from '@playwright/test';
import type { TestScenario } from '@tqa/shared';
import { lookupOrder, placeMugOrder } from './checkout-flow.ts';
import { formatPipelineTable, pipelineProblems, runDemoPipeline, type DemoPipelineRow } from './demo-pipeline-core.ts';
import { WEB_ORIGIN } from './endpoints.ts';
import globalSetup from './global-setup.ts';
import globalTeardown from './global-teardown.ts';
import { readRuntime } from './runtime.ts';

const SCENARIOS = ['NORMAL', 'GHOST_SUCCESS', 'VERIFICATION_UNAVAILABLE'] as const satisfies readonly TestScenario[];

async function main(): Promise<void> {
  await globalSetup();
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ baseURL: WEB_ORIGIN });
    const page = await context.newPage();
    const api = await playwrightRequest.newContext();
    await page.goto('/');
    await page.getByRole('heading', { name: 'Catalog' }).waitFor();
    const runtime = readRuntime();
    const rows: DemoPipelineRow[] = [];
    for (const scenario of SCENARIOS) {
      const placed = await placeMugOrder(page, api, scenario);
      const lookup = await lookupOrder(api, placed.orderId);
      const run = await runDemoPipeline({
        scenario,
        runId: placed.runId,
        orderId: placed.orderId,
        screenText: placed.confirmationMessage,
        lookup: lookup.body,
        databasePath: runtime.databasePath,
      });
      rows.push(run.row);
    }
    await api.dispose();
    await page.close();
    await context.close();
    process.stdout.write(`${formatPipelineTable(rows)}\n`);
    const problems = pipelineProblems(rows);
    if (problems.length > 0) {
      process.stderr.write(`demo-pipeline: matrix mismatch: ${problems.join('; ')}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write('demo-pipeline: three rows matched the matrix. Exit 0 is not ALLOW.\n');
  } finally {
    await browser?.close();
    globalTeardown();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await main();
}
