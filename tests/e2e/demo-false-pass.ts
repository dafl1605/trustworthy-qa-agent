import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evidenceDirectory, type CheckoutEvidence } from './evidence.ts';

const repoRoot = resolve(import.meta.dirname, '../..');
const repeat = 5;

function runPlaywright(args: string[]): { status: number; output: string } {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'tests/e2e/playwright.config.ts', ...args], {
    cwd: repoRoot,
    env: { ...process.env, TQA_E2E_DEMO: '1' },
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  return { status: result.status ?? 1, output };
}

function readGhostEvidence(): CheckoutEvidence[] {
  const files = readdirSync(evidenceDirectory()).filter((name) => name.startsWith('independent-oracle:'));
  const records: CheckoutEvidence[] = [];
  for (const name of files) {
    const parsed: unknown = JSON.parse(readFileSync(resolve(evidenceDirectory(), name), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }
    const record = parsed as CheckoutEvidence;
    if (record.scenario === 'GHOST_SUCCESS' && record.coverage === 'independent-oracle') {
      records.push(record);
    }
  }
  return records;
}

rmSync(evidenceDirectory(), { recursive: true, force: true });
mkdirSync(evidenceDirectory(), { recursive: true });

const ui = runPlaywright([
  '--project=regression',
  'superficial-ui.spec.ts',
  '-g',
  'GHOST_SUCCESS',
]);
const oracle = runPlaywright([
  '--project=expected-negative',
  `--repeat-each=${repeat}`,
]);
const ghosts = readGhostEvidence();
const oracleFailedAsExpected = ghosts.filter(
  (record) =>
    record.ui.result === 'PASS' &&
    record.oracle.consulted &&
    record.oracle.httpStatus === 404 &&
    record.oracle.code === 'ABSENT' &&
    record.oracle.verificationStatus === 'DEFECT' &&
    record.oracle.assertion === 'FAIL',
);
const summary = {
  observedAt: new Date().toISOString(),
  limitedUiExitCode: ui.status,
  oraclePlaywrightExitCode: oracle.status,
  ghostEvidenceCount: ghosts.length,
  expectedNegativeCount: oracleFailedAsExpected.length,
  runs: oracleFailedAsExpected.map((record) => ({
    evidenceId: record.evidenceId,
    runId: record.runId,
    orderId: record.orderId,
    ui: record.ui.result,
    httpStatus: record.oracle.httpStatus,
    code: record.oracle.code,
    verificationStatus: record.oracle.verificationStatus,
    oracleAssertion: record.oracle.assertion,
  })),
};
const summaryPath = resolve(repoRoot, 'test-results/false-pass-summary.json');
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`false-pass summary: ${summaryPath}\n`);

const demonstrated =
  ui.status === 0 &&
  oracle.status !== 0 &&
  oracleFailedAsExpected.length === repeat;
if (!demonstrated) {
  process.stderr.write(
    'False-pass demonstration did not match the expected negative result. The oracle must fail with 404 ABSENT while the limited UI passes.\n',
  );
  process.exit(1);
}
process.stdout.write(
  `EXPECTED NEGATIVE: limited UI exited 0 and the persistence oracle exited ${oracle.status} on ${repeat} isolated GHOST_SUCCESS checkouts. Each lookup was 404 ABSENT. This command exiting 0 means the defect was reproduced, not that persistence passed.\n`,
);
