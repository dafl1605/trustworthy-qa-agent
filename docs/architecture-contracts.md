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
  runId: string;
  diagnosis: Diagnosis;
  summary: string;
  claims: { text: string; evidenceIds: string[] }[];
  missingEvidence: string[];
  needsHumanReview: boolean;
}
interface GateDecision {
  runId: string;
  decision: Gate;
  reasonCodes: string[];
  verificationId: string;
  policyVersion: string;
}
```
Define full runtime validation schemas in code, not only TypeScript interfaces. Order total is computed in server-side integer cents; correlation IDs are required for every investigation.

## Decision matrix
| Authoritative state | LLM report | Validator | Gate |
|---|---|---|---|
| Stored and consistent | Correct / verified | CONFIRMED | ALLOW |
| Missing due to GHOST_SUCCESS | Correct or wrong | DEFECT | BLOCK |
| Query unavailable | Any | UNKNOWN | HOLD |

Do **not** mistake `UNKNOWN` for `DEFECT`. Agent accuracy is evaluated separately from gate correctness.
