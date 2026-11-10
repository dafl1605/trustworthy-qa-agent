import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export class BaselineInputError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BaselineInputError';
    this.code = code;
  }
}

export const BASELINE_VERSION = 'tqa-regression-baseline-1';
export const REQUIRED_RUNS = 5;
export const BASELINE_LIMITATION =
  'Five measured regression runs and five measured expected-negative runs on this machine. This is not a release decision, not a model score, and not a flakiness rate for any other environment.';

export const MEASURED_BASELINE_PATH = fileURLToPath(
  new URL('../../fixtures/regression-baseline/baseline.json', import.meta.url),
);

const REGRESSION_COMMAND = 'pnpm test:e2e';
const NEGATIVE_COMMAND = 'pnpm test:e2e:ghost-oracle';

export const REGRESSION_CASES = [
  {
    role: 'limited-ui-normal',
    file: 'superficial-ui.spec.ts',
    title: 'limited UI coverage records confirmation only for NORMAL',
  },
  {
    role: 'limited-ui-ghost',
    file: 'superficial-ui.spec.ts',
    title: 'limited UI coverage records confirmation only for GHOST_SUCCESS',
  },
  {
    role: 'limited-ui-unavailable',
    file: 'superficial-ui.spec.ts',
    title: 'limited UI coverage records confirmation only for VERIFICATION_UNAVAILABLE',
  },
  {
    role: 'normal-oracle',
    file: 'oracle-normal.spec.ts',
    title: 'independent oracle confirms a NORMAL order and its server total',
  },
  {
    role: 'unavailable-oracle',
    file: 'oracle-unavailable.spec.ts',
    title: 'unavailable verification stays 503 UNKNOWN and is not a 404 defect',
  },
  {
    role: 'ghost-characterization',
    file: 'fault-ghost-characterization.spec.ts',
    title: 'control: injected GHOST_SUCCESS is still absent from the order read',
  },
  {
    role: 'repeatability',
    file: 'repeatability.spec.ts',
    title: 'five consecutive NORMAL checkouts use distinct ids and each order is stored',
  },
] as const;

export const EXPECTED_NEGATIVE_CASE = {
  role: 'ghost-oracle',
  file: 'oracle-ghost.spec.ts',
  title: 'independent oracle requires a persisted order @expected-negative',
} as const;

type RegressionRole = (typeof REGRESSION_CASES)[number]['role'];
type ResultStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
type PlaywrightStatus = 'expected' | 'unexpected' | 'flaky' | 'skipped';

export interface ObservedTest {
  file: string;
  title: string;
  projectName: 'regression' | 'expected-negative';
  status: PlaywrightStatus;
  expectedStatus: ResultStatus;
  observedStatus: ResultStatus;
}

export interface ObservedRun {
  command: typeof REGRESSION_COMMAND | typeof NEGATIVE_COMMAND;
  exitCode: number;
  startedAt: string;
  durationMs: number;
  tests: ObservedTest[];
}

export interface RegressionAnalysis {
  runCount: number;
  perTest: { title: string; observedStatuses: string[] }[];
  flakyTitles: string[];
  stableFailureTitles: string[];
}

export interface FunctionalFreeze {
  baselineVersion: typeof BASELINE_VERSION;
  source: 'supplied-observations';
  playwrightInvokedByModule: false;
  functionalFreeze: true;
  limitation: typeof BASELINE_LIMITATION;
  regression: {
    command: typeof REGRESSION_COMMAND;
    runs: typeof REQUIRED_RUNS;
    exitCodes: number[];
    startedAt: string[];
    durationMs: number[];
    tests: {
      file: string;
      title: string;
      role: RegressionRole;
      passedRuns: number;
      failedRuns: number;
    }[];
  };
  expectedNegative: {
    command: typeof NEGATIVE_COMMAND;
    runs: typeof REQUIRED_RUNS;
    exitCodes: number[];
    startedAt: string[];
    durationMs: number[];
    file: typeof EXPECTED_NEGATIVE_CASE.file;
    title: typeof EXPECTED_NEGATIVE_CASE.title;
    expectedStatus: 'passed';
    observedStatus: 'failed';
    playwrightStatus: 'unexpected';
    classification: 'EXPECTED_NEGATIVE_ABSENT_ORDER';
    passedRuns: number;
    failedRuns: number;
  };
  failureAnalysis: {
    regression: {
      runCount: number;
      flakyTitles: string[];
      stableFailureTitles: string[];
    };
    expectedNegative: {
      runCount: number;
      passedRuns: number;
      failedRuns: number;
      observedStatuses: ResultStatus[];
    };
  };
}

const RESULT_STATUSES = new Set<ResultStatus>(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);
const PLAYWRIGHT_STATUSES = new Set<PlaywrightStatus>(['expected', 'unexpected', 'flaky', 'skipped']);
const FAILURE_CODE: Record<RegressionRole, string> = {
  'limited-ui-normal': 'REGRESSION_FAILED',
  'limited-ui-ghost': 'GHOST_UI_FAILED',
  'limited-ui-unavailable': 'REGRESSION_FAILED',
  'normal-oracle': 'NORMAL_ORACLE_FAILED',
  'unavailable-oracle': 'UNAVAILABLE_NOT_GREEN',
  'ghost-characterization': 'GHOST_CHARACTERIZATION_FAILED',
  repeatability: 'REPEATABILITY_FAILED',
};

function fail(code: string, message: string): never {
  throw new BaselineInputError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function specFileName(file: unknown): string {
  if (typeof file !== 'string' || file.length === 0 || file.includes('\0')) {
    fail('REPORT_SHAPE', 'A spec did not name a file');
  }
  const name = file.split(/[/\\]/).at(-1);
  if (name === undefined || !name.endsWith('.spec.ts') || name.includes('..')) {
    fail('REPORT_SHAPE', 'A spec path did not name a spec file');
  }
  return name;
}

function resultStatus(value: unknown): ResultStatus {
  if (typeof value !== 'string' || !RESULT_STATUSES.has(value as ResultStatus)) {
    fail('REPORT_SHAPE', 'A test result status was not recognized');
  }
  return value as ResultStatus;
}

function playwrightStatus(value: unknown): PlaywrightStatus {
  if (typeof value !== 'string' || !PLAYWRIGHT_STATUSES.has(value as PlaywrightStatus)) {
    fail('REPORT_SHAPE', 'A test status was not recognized');
  }
  return value as PlaywrightStatus;
}

function collectSpecs(suite: unknown, into: Record<string, unknown>[]): void {
  if (!isRecord(suite)) {
    fail('REPORT_SHAPE', 'A suite was not an object');
  }
  if (suite.specs !== undefined) {
    if (!Array.isArray(suite.specs)) {
      fail('REPORT_SHAPE', 'Suite specs were not a list');
    }
    for (const spec of suite.specs) {
      if (!isRecord(spec)) {
        fail('REPORT_SHAPE', 'A spec was not an object');
      }
      into.push(spec);
    }
  }
  if (suite.suites !== undefined) {
    if (!Array.isArray(suite.suites)) {
      fail('REPORT_SHAPE', 'Nested suites were not a list');
    }
    for (const child of suite.suites) {
      collectSpecs(child, into);
    }
  }
}

function countStatus(tests: readonly ObservedTest[], status: PlaywrightStatus): number {
  return tests.filter((test) => test.status === status).length;
}

export function summarizePlaywrightReport(
  report: unknown,
  meta: { command: ObservedRun['command']; exitCode: number },
): ObservedRun {
  if (meta.command !== REGRESSION_COMMAND && meta.command !== NEGATIVE_COMMAND) {
    fail('COMMAND', 'The run command is not a known regression command');
  }
  if (!Number.isInteger(meta.exitCode)) {
    fail('EXIT_CODE', 'The process exit code was not an integer');
  }
  if (!isRecord(report) || !Array.isArray(report.suites) || !isRecord(report.stats)) {
    fail('REPORT_SHAPE', 'The report did not have suites and stats');
  }
  const startTime = report.stats.startTime;
  const duration = report.stats.duration;
  if (typeof startTime !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(startTime)) {
    fail('REPORT_SHAPE', 'The report start time was not a UTC timestamp');
  }
  if (Number.isNaN(Date.parse(startTime))) {
    fail('REPORT_SHAPE', 'The report start time was not a UTC timestamp');
  }
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
    fail('REPORT_SHAPE', 'The report duration was not a positive number');
  }
  const specs: Record<string, unknown>[] = [];
  for (const suite of report.suites) {
    collectSpecs(suite, specs);
  }
  const tests: ObservedTest[] = [];
  for (const spec of specs) {
    if (typeof spec.title !== 'string' || spec.title.length === 0 || !Array.isArray(spec.tests) || spec.tests.length !== 1) {
      fail('REPORT_SHAPE', 'A spec did not contain exactly one project result');
    }
    const test = spec.tests[0];
    if (!isRecord(test) || !Array.isArray(test.results) || test.results.length !== 1) {
      fail('REPORT_SHAPE', 'A spec did not contain exactly one attempt');
    }
    const attempt = test.results[0];
    if (!isRecord(attempt)) {
      fail('REPORT_SHAPE', 'A test attempt was not an object');
    }
    const projectName = test.projectName;
    if (projectName !== 'regression' && projectName !== 'expected-negative') {
      fail('MIXED_PROJECT', 'A test ran in an unknown project');
    }
    if (meta.command === REGRESSION_COMMAND && projectName !== 'regression') {
      fail('MIXED_PROJECT', 'A regression command included a test outside the regression project');
    }
    if (meta.command === NEGATIVE_COMMAND && projectName !== 'expected-negative') {
      fail('MIXED_PROJECT', 'The expected-negative command included another project');
    }
    tests.push({
      file: specFileName(spec.file),
      title: spec.title,
      projectName,
      status: playwrightStatus(test.status),
      expectedStatus: resultStatus(test.expectedStatus),
      observedStatus: resultStatus(attempt.status),
    });
  }
  const expected = report.stats.expected;
  const unexpected = report.stats.unexpected;
  const flaky = report.stats.flaky;
  const skipped = report.stats.skipped;
  if (
    expected !== countStatus(tests, 'expected') ||
    unexpected !== countStatus(tests, 'unexpected') ||
    flaky !== countStatus(tests, 'flaky') ||
    skipped !== countStatus(tests, 'skipped')
  ) {
    fail('REPORT_SHAPE', 'The report stats did not match the parsed tests');
  }
  return {
    command: meta.command,
    exitCode: meta.exitCode,
    startedAt: startTime,
    durationMs: duration,
    tests,
  };
}

export function analyzeRegressionRuns(runs: readonly ObservedRun[]): RegressionAnalysis {
  if (runs.length === 0) {
    fail('RUN_COUNT', 'Failure analysis needs at least one regression run');
  }
  const titles: string[] = [];
  for (const run of runs) {
    if (run.command !== REGRESSION_COMMAND) {
      fail('COMMAND', 'Failure analysis received a run that was not the regression command');
    }
    for (const test of run.tests) {
      if (!titles.includes(test.title)) {
        titles.push(test.title);
      }
    }
  }
  const perTest = titles.map((title) => {
    const observedStatuses = runs.map((run) => {
      const found = run.tests.find((test) => test.title === title);
      return found === undefined ? 'absent' : found.observedStatus;
    });
    return { title, observedStatuses };
  });
  const flakyTitles = perTest
    .filter((entry) => new Set(entry.observedStatuses).size > 1)
    .map((entry) => entry.title);
  const stableFailureTitles = perTest
    .filter((entry) => entry.observedStatuses.every((status) => status !== 'passed'))
    .map((entry) => entry.title);
  return { runCount: runs.length, perTest, flakyTitles, stableFailureTitles };
}

function assertDistinctStarts(runs: readonly ObservedRun[]): void {
  const seen = new Set<string>();
  for (const run of runs) {
    if (seen.has(run.startedAt)) {
      fail('DUPLICATE_START', 'Two runs share a start timestamp, so they cannot both count');
    }
    seen.add(run.startedAt);
  }
}

function regressionCase(title: string): (typeof REGRESSION_CASES)[number] | undefined {
  return REGRESSION_CASES.find((entry) => entry.title === title);
}

function assertRegressionRun(run: ObservedRun): void {
  if (run.command !== REGRESSION_COMMAND) {
    fail('COMMAND', 'A regression slot used a different command');
  }
  const seen = new Set<string>();
  for (const test of run.tests) {
    const expected = regressionCase(test.title);
    if (expected === undefined) {
      fail('UNCLASSIFIED_TEST', 'A regression run included a test outside the frozen inventory');
    }
    if (test.file !== expected.file || seen.has(test.title)) {
      fail('INVENTORY', 'A regression run did not contain the frozen test inventory');
    }
    seen.add(test.title);
    if (test.status === 'flaky') {
      fail('FLAKY', 'A regression test was flaky inside one run');
    }
  }
  for (const expected of REGRESSION_CASES) {
    if (!seen.has(expected.title)) {
      fail('INVENTORY', 'A regression run did not contain the frozen test inventory');
    }
  }
}

function assertNegativeRun(run: ObservedRun): void {
  if (run.command !== NEGATIVE_COMMAND) {
    fail('COMMAND', 'An expected-negative slot used a different command');
  }
  if (run.tests.length !== 1) {
    fail('INVENTORY', 'The expected-negative run did not contain only the ghost oracle');
  }
  const test = run.tests[0];
  if (test === undefined || test.title !== EXPECTED_NEGATIVE_CASE.title || test.file !== EXPECTED_NEGATIVE_CASE.file) {
    fail('INVENTORY', 'The expected-negative run did not contain only the ghost oracle');
  }
  if (test.expectedStatus === 'failed' && test.status === 'expected') {
    fail(
      'HIDDEN_EXPECTED_NEGATIVE',
      'The ghost oracle is marked as an expected failure. The persistence assertion has to stay red.',
    );
  }
  if (test.observedStatus === 'passed' || test.status === 'expected') {
    fail('GHOST_ORACLE_PASSED', 'The ghost persistence oracle passed. Freezing that result would hide the missing order.');
  }
  if (test.observedStatus !== 'failed' || test.status !== 'unexpected' || test.expectedStatus !== 'passed') {
    fail('EXPECTED_NEGATIVE_UNSTABLE', 'The ghost oracle did not fail as an unexpected persistence miss');
  }
  if (run.exitCode !== 1) {
    fail('INCONSISTENT_EXIT', 'The ghost oracle failed, and the process exit was not 1');
  }
}

export function freezeFunctionalBaseline(input: {
  regressionRuns: readonly ObservedRun[];
  expectedNegativeRuns: readonly ObservedRun[];
}): FunctionalFreeze {
  if (input.regressionRuns.length !== REQUIRED_RUNS || input.expectedNegativeRuns.length !== REQUIRED_RUNS) {
    fail('RUN_COUNT', 'A functional freeze needs five regression runs and five expected-negative runs');
  }
  assertDistinctStarts([...input.regressionRuns, ...input.expectedNegativeRuns]);
  for (const run of input.regressionRuns) {
    assertRegressionRun(run);
  }
  for (const run of input.expectedNegativeRuns) {
    assertNegativeRun(run);
  }
  const analysis = analyzeRegressionRuns(input.regressionRuns);
  if (analysis.flakyTitles.length > 0) {
    fail('FLAKY', 'A regression test did not have the same result in every run');
  }
  for (const run of input.regressionRuns) {
    for (const test of run.tests) {
      const expected = regressionCase(test.title);
      if (expected === undefined) {
        fail('UNCLASSIFIED_TEST', 'A regression run included a test outside the frozen inventory');
      }
      if (test.observedStatus !== 'passed' || test.status !== 'expected' || test.expectedStatus !== 'passed') {
        fail(FAILURE_CODE[expected.role], failureMessage(expected.role));
      }
    }
    if (run.exitCode !== 0) {
      fail('INCONSISTENT_EXIT', 'A regression run passed every test and exited non-zero');
    }
  }
  const negativeStatuses = input.expectedNegativeRuns.map((run) => {
    const test = run.tests[0];
    if (test === undefined) {
      fail('INVENTORY', 'The expected-negative run did not contain only the ghost oracle');
    }
    return test.observedStatus;
  });
  return {
    baselineVersion: BASELINE_VERSION,
    source: 'supplied-observations',
    playwrightInvokedByModule: false,
    functionalFreeze: true,
    limitation: BASELINE_LIMITATION,
    regression: {
      command: REGRESSION_COMMAND,
      runs: REQUIRED_RUNS,
      exitCodes: input.regressionRuns.map((run) => run.exitCode),
      startedAt: input.regressionRuns.map((run) => run.startedAt),
      durationMs: input.regressionRuns.map((run) => run.durationMs),
      tests: REGRESSION_CASES.map((expected) => ({
        file: expected.file,
        title: expected.title,
        role: expected.role,
        passedRuns: REQUIRED_RUNS,
        failedRuns: 0,
      })),
    },
    expectedNegative: {
      command: NEGATIVE_COMMAND,
      runs: REQUIRED_RUNS,
      exitCodes: input.expectedNegativeRuns.map((run) => run.exitCode),
      startedAt: input.expectedNegativeRuns.map((run) => run.startedAt),
      durationMs: input.expectedNegativeRuns.map((run) => run.durationMs),
      file: EXPECTED_NEGATIVE_CASE.file,
      title: EXPECTED_NEGATIVE_CASE.title,
      expectedStatus: 'passed',
      observedStatus: 'failed',
      playwrightStatus: 'unexpected',
      classification: 'EXPECTED_NEGATIVE_ABSENT_ORDER',
      passedRuns: 0,
      failedRuns: REQUIRED_RUNS,
    },
    failureAnalysis: {
      regression: {
        runCount: REQUIRED_RUNS,
        flakyTitles: [],
        stableFailureTitles: [],
      },
      expectedNegative: {
        runCount: REQUIRED_RUNS,
        passedRuns: 0,
        failedRuns: REQUIRED_RUNS,
        observedStatuses: negativeStatuses,
      },
    },
  };
}

function failureMessage(role: RegressionRole): string {
  if (role === 'limited-ui-ghost') {
    return 'The limited GHOST_SUCCESS UI check did not pass. That superficial confirmation stays in the freeze.';
  }
  if (role === 'unavailable-oracle') {
    return 'The 503 UNKNOWN oracle did not pass. A failed read is not a confirmed missing order.';
  }
  if (role === 'ghost-characterization') {
    return 'The injected GHOST_SUCCESS absence control did not pass.';
  }
  if (role === 'normal-oracle') {
    return 'The NORMAL persistence oracle did not pass.';
  }
  if (role === 'repeatability') {
    return 'The five isolated NORMAL checkouts did not pass.';
  }
  return 'A frozen regression test did not pass in every run.';
}

export function baselineJson(freeze: FunctionalFreeze): string {
  return `${JSON.stringify(freeze, null, 2)}\n`;
}

function isStringArray(value: unknown, length: number): value is string[] {
  return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === 'string');
}

function isNumberArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((entry) => typeof entry === 'number');
}

export function loadMeasuredBaseline(path: string): FunctionalFreeze {
  const raw = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !isRecord(parsed.regression) || !isRecord(parsed.expectedNegative)) {
    fail('BASELINE_SHAPE', 'The baseline file was not a freeze object');
  }
  const regression = parsed.regression;
  const negative = parsed.expectedNegative;
  const regressionStartedAt = regression.startedAt;
  const regressionDurationMs = regression.durationMs;
  const regressionExitCodes = regression.exitCodes;
  const negativeStartedAt = negative.startedAt;
  const negativeDurationMs = negative.durationMs;
  const negativeExitCodes = negative.exitCodes;
  if (
    !isStringArray(regressionStartedAt, REQUIRED_RUNS) ||
    !isNumberArray(regressionDurationMs, REQUIRED_RUNS) ||
    !isNumberArray(regressionExitCodes, REQUIRED_RUNS) ||
    !isStringArray(negativeStartedAt, REQUIRED_RUNS) ||
    !isNumberArray(negativeDurationMs, REQUIRED_RUNS) ||
    !isNumberArray(negativeExitCodes, REQUIRED_RUNS) ||
    !Array.isArray(regression.tests)
  ) {
    fail('BASELINE_SHAPE', 'The baseline file was missing the measured run list');
  }
  const regressionRuns: ObservedRun[] = regressionStartedAt.map((startedAt, index) => {
    const durationMs = regressionDurationMs[index];
    const exitCode = regressionExitCodes[index];
    if (durationMs === undefined || exitCode === undefined) {
      fail('BASELINE_SHAPE', 'The baseline file was missing the measured run list');
    }
    return {
      command: REGRESSION_COMMAND,
      exitCode,
      startedAt,
      durationMs,
      tests: REGRESSION_CASES.map((expected) => ({
        file: expected.file,
        title: expected.title,
        projectName: 'regression' as const,
        status: 'expected' as const,
        expectedStatus: 'passed' as const,
        observedStatus: 'passed' as const,
      })),
    };
  });
  const expectedNegativeRuns: ObservedRun[] = negativeStartedAt.map((startedAt, index) => {
    const durationMs = negativeDurationMs[index];
    const exitCode = negativeExitCodes[index];
    if (durationMs === undefined || exitCode === undefined) {
      fail('BASELINE_SHAPE', 'The baseline file was missing the measured run list');
    }
    return {
      command: NEGATIVE_COMMAND,
      exitCode,
      startedAt,
      durationMs,
      tests: [
        {
          file: EXPECTED_NEGATIVE_CASE.file,
          title: EXPECTED_NEGATIVE_CASE.title,
          projectName: 'expected-negative',
          status: 'unexpected',
          expectedStatus: 'passed',
          observedStatus: 'failed',
        },
      ],
    };
  });
  const freeze = freezeFunctionalBaseline({ regressionRuns, expectedNegativeRuns });
  if (baselineJson(freeze) !== raw) {
    fail('BASELINE_SHAPE', 'The baseline file is not the canonical freeze of its measured runs');
  }
  return freeze;
}

function readFlag(argv: readonly string[], index: number): string {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    fail('REPORT_SHAPE', 'A command flag was missing its value');
  }
  return value;
}

function writeMeasuredBaseline(argv: readonly string[]): void {
  let out = '';
  const regression: { path: string; exitCode: number }[] = [];
  const expectedNegative: { path: string; exitCode: number }[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--out') {
      out = readFlag(argv, index + 1);
      index += 1;
      continue;
    }
    if (flag === '--regression' || flag === '--expected-negative') {
      const path = readFlag(argv, index + 1);
      const exitText = readFlag(argv, index + 2);
      if (!/^-?\d+$/.test(exitText)) {
        fail('EXIT_CODE', 'The process exit code was not an integer');
      }
      const entry = { path, exitCode: Number(exitText) };
      if (flag === '--regression') {
        regression.push(entry);
      } else {
        expectedNegative.push(entry);
      }
      index += 2;
      continue;
    }
    fail('COMMAND', 'The baseline writer received an unknown flag');
  }
  if (!out.endsWith('fixtures/regression-baseline/baseline.json')) {
    fail('COMMAND', 'The baseline writer only writes fixtures/regression-baseline/baseline.json');
  }
  const regressionRuns = regression.map((entry) =>
    summarizePlaywrightReport(JSON.parse(readFileSync(entry.path, 'utf8')) as unknown, {
      command: REGRESSION_COMMAND,
      exitCode: entry.exitCode,
    }),
  );
  const expectedNegativeRuns = expectedNegative.map((entry) =>
    summarizePlaywrightReport(JSON.parse(readFileSync(entry.path, 'utf8')) as unknown, {
      command: NEGATIVE_COMMAND,
      exitCode: entry.exitCode,
    }),
  );
  const destination = resolve(out);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, baselineJson(freezeFunctionalBaseline({ regressionRuns, expectedNegativeRuns })));
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  try {
    writeMeasuredBaseline(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'baseline writer failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
