# Evaluation tests

QA-14 scores the twelve golden labels from `fixtures/golden-dataset/cases.json`. `runner.ts` compares one supplied observation per case. It reports raw counts for classification, evidence coverage, abstention, critical-defect detection, and gate consistency.

`scoreCheckedInStimuli` builds those observations from the scripted stimulus. That run is `scripted-fixture` or `none`. It is not a live model result, and `measuredFromModel` stays false. The gate on that run comes from `@tqa/quality-gate` policy `tqa-gate-1`. A wrong scripted diagnosis does not change `BLOCK` or `HOLD`.

The loader stays in `tests/contract/golden-dataset.ts`. This directory imports it. The runner does not open SQLite and does not call a model. Twelve cases do not generalize.
