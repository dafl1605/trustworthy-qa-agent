'use strict';

/** TQA free deterministic risk router. Runs from trusted `main`, never a PR checkout. */
const path = require('node:path');

const SENSITIVE_PATHS = [
  /^\.github\/(workflows\/|scripts\/|dependabot\.ya?ml$)/i,
  /^(AGENTS|CLAUDE)\.md$/i,
  /^docs\/(architecture-contracts|spec|intent|sprint-plan)\.md$/i,
  /^\.claude\/(skills\/trustworthy-ai-engineering|settings)/i,
  /^packages\/shared\//i,
  /^apps\/api\/src\/(db|security|auth|agent|validator|quality[-_]?gate|fault|verification)\b/i,
  /(^|\/)(agents?|validators?|quality[-_]?gates?|harness|fault[-_]?injection|evals?|permissions?|security)(\/|\.|-|_)/i,
  /^tests\/(security|evaluation|e2e\/fault|contract\/quality[-_]?gate)/i,
];

function normalizedPaths(files) {
  if (!Array.isArray(files)) throw new TypeError('files must be an array');
  return files.map(f => typeof f === 'string' ? f : f?.filename).filter(Boolean)
    .map(filename => String(filename).replaceAll('\\', '/'));
}

function classifyFiles(files, { maxFiles = 25, maxLines = 500 } = {}) {
  const paths = normalizedPaths(files);
  const reasons = [];
  const sensitivePaths = paths.filter(filename => SENSITIVE_PATHS.some(pattern => pattern.test(filename)));
  if (sensitivePaths.length) reasons.push(`Protected paths: ${sensitivePaths.join(', ')}`);
  if (paths.length > maxFiles) reasons.push(`Large change: ${paths.length} files > ${maxFiles}`);
  const lines = files.reduce((n, f) => n + (typeof f === 'string' ? 0 : (Number(f?.additions) || 0) + (Number(f?.deletions) || 0)), 0);
  if (lines > maxLines) reasons.push(`Large diff: ${lines} changed lines > ${maxLines}`);
  // This classification is intentionally conservative. "standard" does NOT mean bug-free.
  return { tier: reasons.length ? 'l2-review' : 'standard-review', reasons, sensitivePaths, files: paths.length, lines };
}

function makePlan({ files, conclusion, existingLabels = [], autoCloudFix = false }) {
  const risk = classifyFiles(files);
  const labels = new Set(existingLabels);
  const add = [];
  const remove = [];
  const planAdd = x => { if (!labels.has(x)) { labels.add(x); add.push(x); } };
  const planRemove = x => { if (labels.has(x)) { labels.delete(x); remove.push(x); } };

  if (risk.tier === 'l2-review') {
    planAdd('needs-claude-review');
  } else {
    planAdd('tqa-standard-review');
  }
  if (conclusion === 'success') {
    planRemove('tqa-ci-failed');
    planAdd('tqa-ci-passed');
  } else if (conclusion === 'failure') {
    planRemove('tqa-ci-passed');
    planAdd('tqa-ci-failed');
    // One bounded attempt per PR; never auto-remediate protected paths.
    if (autoCloudFix && risk.tier === 'standard-review' && !labels.has('tqa-cloud-attempted')) {
      planAdd('tqa-cloud-attempted');
      planAdd('cursor-fix-requested');
    }
  }
  return { ...risk, conclusion, add, remove };
}

async function resolvePullRequest({ github, context, core }) {
  const { owner, repo } = context.repo;
  // Handle pull_request_target events
  if (context.eventName === 'pull_request_target') {
    const number = context.payload.pull_request?.number;

    if (!Number.isInteger(number)) {
      throw new Error('Missing Pull Request number');
    }

    const { data: pr } = await github.rest.pulls.get({
      owner,
      repo,
      pull_number: number
    });

    return {
      pr,
      conclusion: 'unknown'
    };
  }
  // Handle workflow_dispatch events
  if (context.eventName === 'workflow_dispatch') {
    const str = String(context.payload.inputs?.pr_number || '');
    if (!/^[1-9][0-9]*$/.test(str)) throw new Error('Invalid PR number');
    const { data } = await github.rest.pulls.get({ owner, repo, pull_number: Number(str) });
    return { pr: data, conclusion: 'unknown' };
  }
  const run = context.payload.workflow_run;
  if (run?.event !== 'push' || run?.head_repository?.full_name !== `${owner}/${repo}` || !/^feature\/QA-[a-z0-9-]+$/i.test(run.head_branch || '')) {
    core.info('Skipped: outside approved feature branch/repository.');
    return null;
  }
  const { data: prs } = await github.rest.pulls.list({ owner, repo, state: 'open', head: `${owner}:${run.head_branch}`, per_page: 30 });
  if (!prs.length) {
    core.info('No open PR exists for this feature branch; waiting for a ready PR.');
    return null;
  }
  return { pr: prs[0], conclusion: run.conclusion === 'success' ? 'success' : 'failure' };
}

async function execute({ github, context, core, env }) {
  const resolved = await resolvePullRequest({ github, context, core });
  if (!resolved) return;
  const { pr, conclusion } = resolved;
  const { owner, repo } = context.repo;
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'main' || pr.head.repo.full_name !== `${owner}/${repo}` || !/^feature\/QA-[a-z0-9-]+$/i.test(pr.head.ref)) {
    core.info('Skipped: draft, closed, forked, wrong base, or unrelated branch.');
    return;
  }
  // Avoid stale run that finishes after newer commits. No misleading label on old CI.
  if (context.eventName === 'workflow_run' && pr.head.sha !== context.payload.workflow_run.head_sha) {
    core.info('Skipped: CI result belongs to an older commit.');
    return;
  }
  const files = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: pr.number, per_page: 100 });
  const existingLabels = (pr.labels || []).map(label => label.name);
  const plan = makePlan({ files, conclusion, existingLabels, autoCloudFix: env.TQA_AUTO_CLOUD_FIX === 'true' });
  core.info(JSON.stringify({ pr: pr.number, head: pr.head.sha, plan }, null, 2));
  if (env.TQA_ROUTER_DRY_RUN !== 'false') {
    core.info('DRY RUN: no labels changed.');
    return;
  }
  for (const name of plan.remove) {
    try { await github.rest.issues.removeLabel({ owner, repo, issue_number: pr.number, name }); }
    catch (error) { if (error.status !== 404) throw error; }
  }
  if (plan.add.length) {
    await github.rest.issues.addLabels({ owner, repo, issue_number: pr.number, labels: plan.add });
  }
}

module.exports = execute;
module.exports.classifyFiles = classifyFiles;
module.exports.makePlan = makePlan;
