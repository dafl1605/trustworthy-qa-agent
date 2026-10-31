# Architecture and domain contracts — MVP v1

## Repo layout
- `apps/storefront`: React + Vite, catalog, cart, checkout, confirmation.
- `apps/api`: Node.js API, SQLite `orders` and `order_items`, local test harness.
- `packages/shared`: TypeScript types and Zod schemas.
- `packages/evidence-collector`: normalized, traceable evidence records.
- `packages/qa-agent`: single read-only LLM investigator and provider adapter.
- `packages/validators`: authoritative read-only checks.
- `packages/quality-gate`: policy-versioned ALLOW/BLOCK/HOLD.
- `tests/e2e`, `tests/evals`, `fixtures/golden-dataset`, `docs/progress`.

## Baseline HTTP API
- `GET /health` (health status)
- `GET /api/products` (3 fixture products)
- `POST /api/checkout` (`runId`, `items: [{sku,quantity}]`; returns generated `orderId` and UI confirmation)
- `GET /api/orders/:orderId` (200 found; 404 absent; 503 verification unavailable)
- Test harness must be private/local and resettable; not an unprotected public REST toggle.

## Minimum contracts
```ts
type TestScenario = 'NORMAL' | 'GHOST_SUCCESS' | 'VERIFICATION_UNAVAILABLE';
type Gate = 'ALLOW' | 'BLOCK' | 'HOLD';
type VerificationStatus = 'CONFIRMED' | 'DEFECT' | 'UNKNOWN';
type Diagnosis = 'SUCCESS' | 'ORDER_NOT_PERSISTED' | 'INCONCLUSIVE' | 'OTHER';
interface EvidenceRecord {
  evidenceId: string;
  runId: string;
  source: 'ui' | 'api' | 'db' | 'trace' | 'log';
  observedAt: string;
  kind: string;
  summary: string;
  artifactUri?: string;
}
interface AgentDiagnosis {
  runId: string; // UUID
  diagnosis: Diagnosis;
  summary: string;
  claims: { text: string; evidenceIds: string[] }[];
  missingEvidence: string[];
  needsHumanReview: boolean;
}
interface GateDecision {
  runId: string; // UUID
  decision: Gate;
  reasonCodes: string[];
  verificationId: string;
  policyVersion: string;
}
interface VerificationResult {
  verificationId: string;
  runId: string; // UUID
  status: VerificationStatus;
  checkedAt: string;
  details: string;
}
interface EvalCase {
  caseId: string;
  scenario: TestScenario;
  expectedDiagnosis: Diagnosis;
  expectedVerification: VerificationStatus;
  expectedGate: Gate;
}
```
Define full runtime validation schemas in code, not only TypeScript interfaces. Order total is computed in server-side integer cents; `runId` and `orderId` are UUIDs. Checkout and persisted line items are 1–3 unique SKUs, each SKU at most 64 characters, quantity 1–99.

`VerificationResult` and `EvalCase` are contract-only in QA-01. Validator behavior is QA-11/QA-12. Eval fixtures and the runner are QA-13/QA-14. Do not treat these schemas as a running validator or eval.

A claim with empty `evidenceIds` is UNVERIFIED. Claims that cite evidence still need those IDs to exist and to support the text. An LLM claim never independently authorizes `ALLOW`.

## Decision matrix
| Authoritative state | LLM report | Validator | Gate |
|---|---|---|---|
| Stored and consistent | Correct / verified | CONFIRMED | ALLOW |
| Missing due to GHOST_SUCCESS | Correct or wrong | DEFECT | BLOCK |
| Query unavailable | Any | UNKNOWN | HOLD |

Do **not** mistake `UNKNOWN` for `DEFECT`. Agent accuracy is evaluated separately from gate correctness. A passing test suite does not auto-approve a release or a quality-gate `ALLOW`.
