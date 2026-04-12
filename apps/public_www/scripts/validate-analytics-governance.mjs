import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const PULL_REQUEST_EVENT_NAME = 'pull_request';
const ANALYTICS_CONTRACT_PATH = 'apps/public_www/src/lib/analytics-taxonomy.json';
const RUNBOOK_PATH = 'docs/architecture/analytics-ga4-gtm-runbook.md';
const CHANGELOG_PATH = 'docs/architecture/analytics-change-log.md';
const ANALYTICS_HELPER_PATH = 'apps/public_www/src/lib/analytics.ts';

function runGitCommand(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function parseNameStatusDiffOutput(rawOutput) {
  if (!rawOutput) {
    return [];
  }

  const entries = [];
  for (const line of rawOutput.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    const parts = line.split('\t');
    const status = parts[0] ?? '';
    const filePath = parts[parts.length - 1] ?? '';
    entries.push({ status, filePath });
  }
  return entries;
}

function isAnalyticsTrackerDiffPresent(baseSha, headSha) {
  const diffOutput = runGitCommand([
    'diff',
    '--unified=0',
    `${baseSha}..${headSha}`,
    '--',
    'apps/public_www/src',
  ]);

  return diffOutput
    .split('\n')
    .some((line) => (line.startsWith('+') || line.startsWith('-'))
      && !line.startsWith('+++')
      && !line.startsWith('---')
      && (line.includes('trackAnalyticsEvent(') || line.includes('trackPublicFormOutcome(')));
}

async function resolvePullRequestShas() {
  const eventPath = process.env.GITHUB_EVENT_PATH?.trim() ?? '';
  if (!eventPath) {
    return null;
  }

  const eventPayload = JSON.parse(await readFile(eventPath, 'utf8'));
  const baseSha = eventPayload?.pull_request?.base?.sha?.trim?.() ?? '';
  const headSha = eventPayload?.pull_request?.head?.sha?.trim?.() ?? '';
  if (!baseSha || !headSha) {
    return null;
  }

  return { baseSha, headSha };
}

function assertCommitAvailable(commitSha) {
  runGitCommand(['cat-file', '-e', `${commitSha}^{commit}`]);
}

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME?.trim() ?? '';
  if (eventName !== PULL_REQUEST_EVENT_NAME) {
    console.log(
      'Analytics governance validation skipped (requires pull_request context).',
    );
    return;
  }

  const shas = await resolvePullRequestShas();
  if (!shas) {
    console.log(
      'Analytics governance validation skipped (missing pull request SHAs).',
    );
    return;
  }

  const { baseSha, headSha } = shas;
  try {
    assertCommitAvailable(baseSha);
    assertCommitAvailable(headSha);
  } catch {
    console.log(
      'Analytics governance validation skipped (required commits are not available in local checkout).',
    );
    return;
  }

  const nameStatusOutput = runGitCommand([
    'diff',
    '--name-status',
    `${baseSha}..${headSha}`,
  ]);
  const changedEntries = parseNameStatusDiffOutput(nameStatusOutput);
  const changedFilePaths = new Set(changedEntries.map((entry) => entry.filePath));

  const analyticsTrackerDiffPresent = isAnalyticsTrackerDiffPresent(baseSha, headSha);
  const analyticsContractChanged = changedFilePaths.has(ANALYTICS_CONTRACT_PATH);
  const analyticsHelperChanged = changedFilePaths.has(ANALYTICS_HELPER_PATH);
  const analyticsImpactDetected =
    analyticsTrackerDiffPresent || analyticsContractChanged || analyticsHelperChanged;

  if (!analyticsImpactDetected) {
    console.log('Analytics governance validation passed (no analytics-impacting changes).');
    return;
  }

  const validationErrors = [];
  if (analyticsTrackerDiffPresent && !analyticsContractChanged) {
    validationErrors.push(
      `Analytics tracker call changes require updating ${ANALYTICS_CONTRACT_PATH}.`,
    );
  }

  if (!changedFilePaths.has(RUNBOOK_PATH)) {
    validationErrors.push(
      `Analytics-impacting changes require updating ${RUNBOOK_PATH}.`,
    );
  }

  if (!changedFilePaths.has(CHANGELOG_PATH)) {
    validationErrors.push(
      `Analytics-impacting changes require updating ${CHANGELOG_PATH}.`,
    );
  }

  if (validationErrors.length > 0) {
    console.error('Analytics governance validation failed.');
    for (const validationError of validationErrors) {
      console.error(`- ${validationError}`);
    }
    process.exit(1);
  }

  console.log('Analytics governance validation passed.');
}

main().catch((error) => {
  console.error('Analytics governance validation crashed.');
  console.error(error);
  process.exit(1);
});
