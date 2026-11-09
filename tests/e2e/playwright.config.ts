import { defineConfig } from '@playwright/test';
import { WEB_ORIGIN } from './endpoints.ts';

const demo = process.env.TQA_E2E_DEMO === '1';

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
  ],
  outputDir: 'test-results/output',
  use: {
    baseURL: WEB_ORIGIN,
    trace: demo ? 'on' : 'retain-on-failure',
    screenshot: demo ? 'on' : 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'regression',
      grepInvert: /@expected-negative/,
    },
    {
      name: 'expected-negative',
      grep: /@expected-negative/,
    },
  ],
});
