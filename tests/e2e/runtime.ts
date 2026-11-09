import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface E2ERuntime {
  apiOrigin: string;
  webOrigin: string;
  harnessToken: string;
  databasePath: string;
  apiPid: number;
  webPid: number;
}

export function runtimePath(): string {
  return resolve(import.meta.dirname, '../../test-results/e2e-runtime.json');
}

export function readRuntime(): E2ERuntime {
  const raw: unknown = JSON.parse(readFileSync(runtimePath(), 'utf8'));
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('E2E runtime file is invalid');
  }
  const record = raw as Record<string, unknown>;
  if (
    typeof record.apiOrigin !== 'string' ||
    typeof record.webOrigin !== 'string' ||
    typeof record.harnessToken !== 'string' ||
    record.harnessToken.length === 0 ||
    typeof record.databasePath !== 'string' ||
    typeof record.apiPid !== 'number' ||
    typeof record.webPid !== 'number'
  ) {
    throw new Error('E2E runtime file is missing server coordinates');
  }
  return {
    apiOrigin: record.apiOrigin,
    webOrigin: record.webOrigin,
    harnessToken: record.harnessToken,
    databasePath: record.databasePath,
    apiPid: record.apiPid,
    webPid: record.webPid,
  };
}
