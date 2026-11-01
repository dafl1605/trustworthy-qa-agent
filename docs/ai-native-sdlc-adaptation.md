# AI-Native SDLC adoption for Trustworthy QA Agent — Decision Record

## Reference
Anthropic, *The AI-native SDLC playbook*, 2026-08-21: https://claude.com/resources/articles/the-ai-native-sdlc-playbook
Related lessons: https://academy.claude.com/courses/ai-native-sdlc-playbook

## Adopt immediately (within the existing QA-01 & sprint capacity)
1. Repo-traceable `intent.md -> spec.md -> task plan`; one authoritative source of truth, not duplicated giant prompts.
2. Scoped skills and short global AGENTS.md rules; load only relevant skill; test skill routing.
3. Feedback loops: actual test/build/visual checks with outputs, and separate review of acceptance vs approved spec.
4. Run runtime evals when prompts/model/tools change (locally as part of QA-14/QA-15, no new cloud CI commitment).
5. Small, explicit developer-agent probes for failure modes and policy drift.

## Defer (not needed for the BrowserStack MVP)
- Production deployment hooks and managed policy enforcement.
- Full agent-driven CI/CD pipelines and PR review service.
- Production monitoring and incident->intent automation.
- Runtime multi-agent architecture. Optional development helpers are not part of runtime deliverable.

## Accuracy improvement hypothesis (not a guarantee)
Reusing exact acceptance criteria, feedback and independent review may reduce implementation mistakes and unsupported claims. Do NOT claim a percentage improvement or hours saved until measurements are collected from runs.

## Budget
Do not change approved 54 planned + 9 contingency hours. Integrate intent/spec/plan into QA-01 architecture work and add checks within already-planned QA-06 and QA-13..15. If measured overhead threatens scope, prefer critical behavior checks over optional process automation. The per-probe session is listed in `docs/orchestrator-eval-probes.md`. O-001 through O-007 are verified during QA-15 implementation, after QA-05, QA-06, QA-07, QA-11, QA-12, and QA-14 are already in the tree. QA-03 does not run them. They stay UNVERIFIED until that clean session records a score.
