const test = require('node:test');
const assert = require('node:assert/strict');

const { extractJiraKeys, matchIssueKeys } = require('../services/correlationService');

test('extractJiraKeys finds the issue key in branch and PR text', () => {
  const branch = 'feature/PROJ-123-login-fix';
  const prTitle = 'Fix login validation (PROJ-123)';
  const keys = extractJiraKeys([branch, prTitle]);

  assert.deepEqual(keys, ['PROJ-123']);
});

test('matchIssueKeys returns ambiguous when multiple valid keys are found', () => {
  const result = matchIssueKeys(['PROJ-123', 'PROJ-456']);

  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.keys, ['PROJ-123', 'PROJ-456']);
});

test('matchIssueKeys returns linked when exactly one valid key is found', () => {
  const result = matchIssueKeys(['PROJ-123']);

  assert.equal(result.status, 'linked');
  assert.deepEqual(result.keys, ['PROJ-123']);
});
