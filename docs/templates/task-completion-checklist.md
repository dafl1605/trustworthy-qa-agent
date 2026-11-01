# Task completion checklist

Deliver this filled markdown after implementing a task. Keep the headings. Record only commands that ran and outcomes that were observed. Leave a box unchecked when that condition is not true.

## Task & scope
- Task ID: QA-
- Goal / intent:
- Acceptance IDs (docs/spec.md):
- Scope impact: [ ] None  [ ] User-approved change request attached

## Changes
- Files/components touched:
- Intentional `GHOST_SUCCESS` preserved? [ ] Yes [ ] N/A
- `VERIFICATION_UNAVAILABLE` remains UNKNOWN/HOLD? [ ] Yes [ ] N/A

## Verification evidence (actual, not planned)
| Command | Executed? | Outcome | Evidence link/path |
|---|---|---|---|
| `pnpm typecheck` | | | |
| `pnpm build` | | | |
| Targeted tests | | | |

## Review & merge
- [ ] Code and docs contain no secrets, real customer data, or private photos
- [ ] Claude independent review requested on this **exact PR SHA**
- [ ] Reviewer findings addressed or documented with rationale
- [ ] Human decides merge; no bot pushes directly to main
