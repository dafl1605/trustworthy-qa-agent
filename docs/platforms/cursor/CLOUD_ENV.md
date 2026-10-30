# Cursor Cloud environment — recommended startup requirements

- Runtime: current supported Node.js LTS; `corepack`/pnpm as selected by the repository; Chromium via Playwright's supported installer in the **cloud VM**.
- First inspect the generated root `package.json`/lockfile; only then run exact repository scripts.
- Illustrative validation commands **after QA-01 defines scripts**:
  - `node --version`
  - `pnpm --version`
  - `pnpm install --frozen-lockfile` (only if lockfile exists)
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm exec playwright install --with-deps chromium` (when Playwright is installed and cloud OS allows)
  - `pnpm test:e2e` (only when script exists)
- SQLite local ephemeral DB must be created from migrations/fixtures on every new environment. No reliance on cloud disk between sessions.
- Store model API keys in cloud platform Secrets; `.env.example` contains names and placeholders only. Never paste keys into prompts.
- Public repository requires synthetic data, no personal photo or actual third-party credentials in git.
- Use `feature/QA-XX-description` branches, never direct to `main`. Open PR and wait for review.
