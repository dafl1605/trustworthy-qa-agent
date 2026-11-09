import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TestScenario } from '@tqa/shared';

export type UiObservation = 'PASS' | 'FAIL';
export type OracleAssertion = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_CONSULTED';
export type LookupCode = 'FOUND' | 'ABSENT' | 'UNAVAILABLE';
export type FactStatus = 'CONFIRMED' | 'DEFECT' | 'UNKNOWN' | 'NOT_CONSULTED';

export interface CheckoutEvidence {
  evidenceId: string;
  runId: string;
  orderId: string;
  scenario: TestScenario;
  observedAt: string;
  coverage: 'limited-ui' | 'independent-oracle' | 'repeatability';
  summary: string;
  ui: {
    result: UiObservation;
    message: string;
  };
  oracle: {
    consulted: boolean;
    httpStatus: number | null;
    code: LookupCode | null;
    verificationStatus: FactStatus;
    assertion: OracleAssertion;
    totalCents: number | null;
  };
}

export function evidenceDirectory(): string {
  return resolve(import.meta.dirname, '../../test-results/evidence');
}

export function writeEvidence(evidence: CheckoutEvidence): string {
  const directory = evidenceDirectory();
  mkdirSync(directory, { recursive: true });
  const filePath = resolve(directory, `${evidence.evidenceId}.json`);
  writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
  return filePath;
}

export function evidenceIdFor(runId: string, coverage: CheckoutEvidence['coverage']): string {
  return `${coverage}:${runId}`;
}
