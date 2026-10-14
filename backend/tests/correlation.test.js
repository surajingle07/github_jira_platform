const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractJiraKeys,
  matchIssueKeys,
  normalizeStatusSemantics,
} = require('../services/correlationService');

test('extractJiraKeys finds uppercase and lowercase issue keys across branches, commits, and PRs', () => {
  const branch = 'feature/kan-123-login-fix';
  const prTitle = 'Fix login validation (PROJ-456)';
  const prBody = 'Addresses DEV-789 and closes kan-123';
  const commitMsg = '[PROJ-456] commit for login patch';

  const keys = extractJiraKeys([branch, prTitle, prBody, commitMsg]);

  assert.ok(keys.includes('KAN-123'), 'Expected KAN-123 normalized to uppercase');
  assert.ok(keys.includes('PROJ-456'), 'Expected PROJ-456 to be present');
  assert.ok(keys.includes('DEV-789'), 'Expected DEV-789 to be present');
  assert.equal(keys.length, 3, 'Expected 3 unique keys');
});

test('matchIssueKeys returns unmatched when no key is found', () => {
  const result = matchIssueKeys([]);
  assert.equal(result.status, 'unmatched');
  assert.equal(result.confidence, 0);
  assert.equal(result.requiresReview, false);
});

test('matchIssueKeys returns linked with high confidence for single valid key', () => {
  const result = matchIssueKeys(['KAN-1']);
  assert.equal(result.status, 'linked');
  assert.equal(result.confidence, 1.0);
  assert.equal(result.primaryKey, 'KAN-1');
  assert.equal(result.requiresReview, false);
});

test('matchIssueKeys returns ambiguous and flags for review when multiple keys exist', () => {
  const result = matchIssueKeys(['KAN-1', 'KAN-2']);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.confidence, 0.5);
  assert.equal(result.requiresReview, true);
  assert.deepEqual(result.keys, ['KAN-1', 'KAN-2']);
});

test('normalizeStatusSemantics maintains PR state, review status, check result, and Jira status separately', () => {
  const status = normalizeStatusSemantics({
    prState: 'merged',
    reviewStatus: 'APPROVED',
    checkResult: 'SUCCESS',
    jiraStatus: 'In Progress',
  });

  assert.equal(status.prState, 'merged');
  assert.equal(status.reviewStatus, 'APPROVED');
  assert.equal(status.checkResult, 'SUCCESS');
  assert.equal(status.jiraStatus, 'In Progress');
  assert.equal(status.isMerged, true);
  // Merged PR does NOT automatically mark Jira status as Done (FR-07 write-back policy)
  assert.equal(status.isJiraDone, false);
});
