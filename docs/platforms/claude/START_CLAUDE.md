# Claude Code Web — review-only setup

## Connect
1. Open `https://claude.ai/code`, use the Code experience and connect GitHub. Authorize only `trustworthy-qa-agent` when the GitHub app offers per-repository access.
2. Confirm you can select `trustworthy-qa-agent`. Select **the PR branch/head commit**, not `main`, before reviewing.
3. Use Plan mode/read-only intent for code review where available.
4. `CLAUDE.md` imports `AGENTS.md` and specifies reviewer-default mode. When needed, explicitly load the matching skill in `.claude/skills/`.

## Prompt A — repository readiness (READ ONLY)
```text
Inspect trustworthy-qa-agent without changing any files.
Read CLAUDE.md, AGENTS.md, docs/intent.md, docs/spec.md and docs/sprint-plan.md.
Verify that all four skills are present and the planned QA-01 task is unstarted unless evidence shows otherwise.
Report selected repository, branch, HEAD SHA, missing files and any contradictory requirements.
Do not commit, push, create PRs or merge.
```

## Prompt B — PR review (paste PR URL when available)
```text
Act as an independent Principal SDET, Staff Engineer and AI-Native SDLC reviewer.
Review this Pull Request: <PASTE_PR_URL>
Confirm the exact PR head SHA and base main SHA, then inspect the diff and dependencies. If the exact PR commit is not accessible, mark the review BLOCKED rather than reviewing main.
Read CLAUDE.md, AGENTS.md, docs/intent.md, docs/spec.md, docs/architecture-contracts.md and the task-matched skill.
Review architecture, contracts, TypeScript correctness, test isolation, security, scope and acceptance criteria.
Critical: preserve NORMAL/GHOST_SUCCESS/VERIFICATION_UNAVAILABLE semantics; missing orders differ from unavailable verification; the LLM never independently approves a release.
Run read-only checks only when supported, and report the actual outputs.
Return APPROVE, REQUEST_CHANGES or BLOCKED with severity, file:line findings, repro steps and missing evidence.
Do not edit source, commit, push, self-approve via GitHub or merge.
```
