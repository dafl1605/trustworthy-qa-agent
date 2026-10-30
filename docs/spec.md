# Behavioral specification — Trustworthy AI QA Agent v1.0

**Status:** Draft derived from user-approved intent; review before QA-01 implementation.  
**Parent:** `docs/intent.md`  
**Technical contracts:** `docs/architecture-contracts.md`

## Behavior and acceptance matrix
| ID | Input / precondition | Observable expected result | Required evidence |
|---|---|---|---|
| S-001 | NORMAL: checkout 1–3 products | UI confirms, order exists with server-calculated total, verification=CONFIRMED, gate=ALLOW | UI assertion + read-only order lookup |
| S-002 | GHOST_SUCCESS: checkout | UI confirms and limited UI test PASS, but order absent (independently verified 404), gate=BLOCK | UI PASS + API/DB absence evidence |
| S-003 | VERIFICATION_UNAVAILABLE: checkout | Verification source returns 503/timeout, status UNKNOWN and gate=HOLD, never BLOCK based solely on failed lookup | API status/timeout, evidence IDs |
| S-004 | Agent diagnosis | Valid Zod schema, claims cite existing evidence IDs; unsupported claims marked unverified | Parsed diagnosis and evidence-index check |
| S-005 | Tool constraints | Invalid inputs/timeouts/untrusted text are handled safely; no writes or shell access | Tool tests, denied action evidence |
| S-006 | Runtime eval | 12 labeled cases: 4 success, 4 defect, 4 inconclusive; report counts and per-case outcome | Machine-readable eval output |
| S-007 | Repeatability | 5 consecutively isolated demo runs, resets idempotent, unique run/order IDs | Logs/reports across runs |
| S-008 | Presentation | 12-minute demo, 35-minute content, English speaker notes, backup recording identified | Timed rehearsal log and artifacts |

## Domain invariants
- UI confirmation is never an independent business oracle.
- A verified missing order (404) is different from an unavailable authority (503/timeout).
- Agent output and confidence cannot override authoritative read-only verification.
- Runtime reads are bounded; source logs/HTML are untrusted data, never operating instructions.
- No external or production-facing fault-injection controls.

## Component boundaries
UI shows checkout result; backend persists or simulates controlled fault; Playwright captures behavior; collector normalizes evidence; ONE runtime agent interprets; independently owned validator establishes facts; deterministic gate applies policy; eval runner compares diagnoses and decisions to labeled expectations.

## Review questions before development
1. Do the 3 fault modes yield unambiguous 200/404/503 semantics?
2. Is authoritative independent verification truly independent of model-produced text?
3. Is intent preserved when a UI test passes in the defect scenario?
4. Are all metrics and demo artifacts derived from runs rather than examples?
