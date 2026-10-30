# GitHub: public repository with protected main

## First security check
Before publicizing: check entire commit history for tokens, API keys, real user info and private assets. Secrets in Git history remain visible even if later deleted; rotate exposed tokens and rewrite history as appropriate.

## Ruleset for main
Settings -> Rules -> Rulesets -> New branch ruleset.
- Ruleset `Protect Main Branch`, status **Active**.
- Target `main` (default branch).
- **Require a pull request before merging**: ON.
- Required approvals: 0 for one-maintainer repo; Claude advisory review does not count as a GitHub approval.
- **Require conversation resolution before merging**: ON.
- **Block force pushes**: ON.
- **Restrict deletions**: ON.
- Bypass list: empty wherever configurable.
- Do NOT enable Restrict updates without understanding merge impact.
- Keep auto-merge OFF; prefer squash merging.

## Bootstrap when main is already protected
**Do not try to upload these files directly to main.** On GitHub.com upload the unzipped repo-root content to a **new branch** such as `feature/bootstrap-context`, then open a PR into `main`. If the upload UI doesn't preserve hidden directories/paths, create the branch and files via GitHub web editor or use Cursor Cloud to create them on the feature branch.

## Permissions
Cursor and Claude integrations need only the repository scope required for their tasks. Cursor may push feature branches and create PRs. Claude should behave read-only for review; platform app authorization may be broader, so enforce this in your own workflow and check connected app permissions. Merge is a human action.

## Quick acceptance test
1. Attempt to publish change directly to main in a safe test branch/with permission validation; it should be blocked by policy (do not risk force-pushing).
2. Open a PR from feature branch; checks/review work normally.
3. Confirm normal squash merge is permitted after discussions resolve.
