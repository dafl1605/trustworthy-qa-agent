# START HERE — Trustworthy QA Agent (Cursor + Claude Code, 100% cloud)

**This ZIP is a starter package of policies, specifications, skills and prompts, NOT a compiled application.** No project tests have been run or features implemented by packaging these files.

## 0 — Confirm baseline
- Meetup: 25 Nov 2026.
- Product: single runtime AI Investigation Agent + independent deterministic validator + gate + Playwright + 12 eval cases.
- Stack: React/Vite + Node/TypeScript strict + SQLite + Playwright + Zod.
- Budget: 54 planned hours + 9 contingency.
- Excluded: Java, MCP, Jev, runtime multiagents, dashboard, advanced CI/CD.

## 1 — Upload to GitHub (SHARED)
1. Extract the ZIP on your device (no dev tool install needed). It contains files and directories intended for the repository ROOT.
2. In GitHub repository `trustworthy-qa-agent`, create `feature/bootstrap-context` from main.
3. Upload extracted content preserving folders and hidden folders (`.claude`, `.cursor`, `.github`) to **this branch**. GitHub doesn't unpack ZIP files automatically.
4. Open a PR targeting `main`; review and squash merge. If ruleset is already Active, do not push directly to main.
5. Check presence of `AGENTS.md`, `CLAUDE.md`, four `.claude/skills/*/SKILL.md`, `docs/*` and `.cursor/rules/tqa-repo.mdc`.
6. See `docs/SETUP_GITHUB_RULES.md` before publishing if public.

## 2 — Cursor Cloud (IMPLEMENT)
- Connect GitHub repo and start a cloud agent from `https://cursor.com/agents`.
- Read `docs/platforms/cursor/START_CURSOR.md` and copy Prompt A (readiness).
- When ready, use Prompt B for QA-01. Cursor makes a **feature branch + PR**, runs actual tests and reports results.
- Environment guidance: `docs/platforms/cursor/CLOUD_ENV.md`.

## 3 — Claude Code Web (REVIEW)
- Open `https://claude.ai/code` and connect the same repo.
- Read `docs/platforms/claude/START_CLAUDE.md` and run Prompt A (readiness) without edits.
- Once Cursor opens a PR, use Prompt B with **real PR URL** and verify exact head SHA.
- Claude returns an advisory review, not automated GitHub approval/merge.

## 4 — Iterate until accepted
Cursor implements -> PR -> Claude independent review -> Cursor fixes -> re-review -> human merges.
Do NOT direct-push to main. No unauthorized feature scope changes.

## Directory ownership
| File/directory | Who uses it? | Purpose |
|---|---|---|
| `AGENTS.md`, `docs/intent.md`, `docs/spec.md`, `docs/architecture-contracts.md` | BOTH | Permanent constraints and acceptance criteria |
| `.claude/skills/*` | BOTH | Four task-specific skills; explicitly load if auto-discovery fails |
| `.cursor/rules/tqa-repo.mdc` | CURSOR | Always-on project guardrails |
| `docs/platforms/cursor/*` | CURSOR | Cloud setup, implementation prompts, reviewer-fix prompt |
| `CLAUDE.md` | CLAUDE | Read AGENTS and default to review-only |
| `docs/platforms/claude/*` | CLAUDE | Review workflow and report template |
| `.github/pull_request_template.md`, `docs/SETUP_GITHUB_RULES.md` | GITHUB/BOTH | PR quality control and protected main |
| `docs/sprint-plan.md`, `docs/templates/*` | BOTH | Work schedule and evidence reports |

## First two checks
1. Both agents can read the exact repo and selected HEAD SHA.
2. Cursor can start QA-01 in an isolated feature branch and report real typecheck/build status; Claude can examine the PR without editing.

## Safety
Never upload API keys or personal headshot to a public coding repo. Do not infer actual task completion from historical dates in `docs/sprint-plan.md`; update a calendar only after inspecting progress.
