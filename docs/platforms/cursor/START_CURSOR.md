# Cursor Cloud — implementation owner

## Prepare cloud environment
1. In Cursor Cloud Agents, connect the **GitHub repository `trustworthy-qa-agent`** with the minimum necessary repository access.
2. Confirm the repository is public and `main` is protected by an **active** ruleset; do not weaken rules to get past setup.
3. Select Cloud, not a remote-control session that depends on a local laptop. Inspect the current repo state before creating work.
4. Check available Node.js, package manager and ability to install Chromium for Playwright in the remote environment. Don't claim checks were run until actually executed.
5. Use task branch `feature/QA-01-bootstrap` for the first implementation. Do not work directly on `main`.
6. Add LLM provider credentials ONLY to Cursor's secret/environment settings when needed for QA-09. Do not add them to repo.

## Prompt A — repository readiness (READ ONLY)
```text
You are preparing Cursor Cloud for Trustworthy QA Agent v1.0.
Inspect this repository without making any changes.
Read AGENTS.md, docs/intent.md, docs/spec.md, docs/architecture-contracts.md and docs/sprint-plan.md.
Check that the four SKILL.md files are present under .claude/skills/.
Report: branch, HEAD SHA, existing files, missing documents, Node/pnpm availability, and whether Playwright Chromium can be installed in the cloud environment.
Do not install dependencies yet unless explicitly authorized, and do not commit or open a PR.
Do not mark any sprint task DONE.
```

## Prompt B — first implementation QA-01 (after readiness)
```text
Act as Principal SDET and TypeScript Development Orchestrator.
Project: Trustworthy QA Agent v1.0.
Scope: 54 planned hours plus 9 hours contingency, with NO unapproved feature growth.
Read AGENTS.md, docs/intent.md, docs/spec.md, docs/architecture-contracts.md, docs/sprint-plan.md and .claude/skills/backend-typescript-engineering/SKILL.md.
Inspect the repo to avoid overwriting prior work. Create or switch to feature/QA-01-bootstrap; never push to main.
Prepare a brief implementation plan and acceptance criteria for QA-01.
Implement ONLY the minimal pnpm monorepo, strict TypeScript base configuration, shared Zod domain contracts, basic app/package directories, and reproducible scripts needed by QA-01.
Run actual typecheck/build or document precisely why they cannot yet run; do not fabricate tests.
Save real command results, changed files, implementation assumptions, observed time if measured, blockers, and the next task into docs/progress/<actual-date>.md.
Push the feature branch and open a PR. Do not merge, approve, or alter rulesets.
```

## During subsequent tasks
- New task branch per QA-XX; if multiple commits are needed for one task keep them in its PR.
- Choose only one primary skill per task, a second for cross-cutting verification.
- Ensure checkout/order behavior is genuine, not a mocked UI success masquerading as persistence.
- On every PR: include spec IDs, actual checks and evidence paths; request Claude independent review.
- After implementing the task, deliver the filled markdown in `docs/templates/task-completion-checklist.md`. Check a box only when that condition is true.

## Time management
- 3-hour/day budget is a planning constraint, not a mandatory background runtime or a statement of elapsed time.
- Reserve contingency for critical integration defects. Rebase dates based on actual progress.
