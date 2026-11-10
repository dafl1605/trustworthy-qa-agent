# Golden dataset

QA-13 stores twelve human-authored labels in `cases.json`. The file is `tqa-golden-v1`.

Each case is one `EvalCase` plus the spec row it comes from, a rationale, and a short stimulus. The labels follow the decision matrix in `docs/architecture-contracts.md`:

| Scenario | Expected diagnosis | Expected verification | Expected gate | Count |
| --- | --- | --- | --- | --- |
| `NORMAL` | `SUCCESS` | `CONFIRMED` | `ALLOW` | 4 |
| `GHOST_SUCCESS` | `ORDER_NOT_PERSISTED` | `DEFECT` | `BLOCK` | 4 |
| `VERIFICATION_UNAVAILABLE` | `INCONCLUSIVE` | `UNKNOWN` | `HOLD` | 4 |

`labelProvenance.measuredFromModel` is `false`. These labels are not scores from a model run and they are not a release decision. A `scripted-fixture` candidate is a stand-in inside the case. `candidateSource: "none"` means the case supplies no diagnosis. Neither value is a live model result.

The stimuli keep a passing screen in every case. That screen is not the label. Ghost cases stay `BLOCK` when the scripted candidate says `SUCCESS`. Unavailable cases stay `HOLD` when a scripted candidate treats a 503 as a missing order. A timeout stays distinct from `ABSENT`.

This dataset does not include the QA-12 contradiction where a `CONFIRMED` order and an `ORDER_NOT_PERSISTED` diagnosis produce `HOLD`. That hold is gate policy. It is not an `EvalCase`.

QA-14 owns the runner, the counts from actual runs, and `tests/evals/`. This directory does not execute the gate and does not open SQLite.
