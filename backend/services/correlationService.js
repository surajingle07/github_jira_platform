/**
 * Cross-Platform Correlation Engine (FR-07)
 * Implements explicit, explainable matching rules between GitHub and Jira.
 */

function extractJiraKeys(values = []) {
  const uniqueKeys = new Set();

  for (const value of values) {
    if (!value || typeof value !== 'string') continue;

    // Matches standard Jira issue keys, case-insensitive, e.g. PROJ-123, kan-42
    const matches = value.match(/\b([A-Za-z][A-Za-z0-9]+)-(\d+)\b/g) || [];
    for (const match of matches) {
      // Normalize to uppercase according to Jira standard
      uniqueKeys.add(match.toUpperCase());
    }
  }

  return Array.from(uniqueKeys);
}

function matchIssueKeys(keys = []) {
  const uniqueKeys = [...new Set((keys || []).map((k) => (k ? String(k).toUpperCase() : '')).filter(Boolean))];

  if (!uniqueKeys.length) {
    return {
      status: 'unmatched',
      confidence: 0,
      keys: [],
      message: 'No Jira issue key detected in branch, commit, PR title, or description.',
      requiresReview: false,
    };
  }

  if (uniqueKeys.length === 1) {
    return {
      status: 'linked',
      confidence: 1.0,
      primaryKey: uniqueKeys[0],
      keys: uniqueKeys,
      message: `Direct correlation verified with Jira issue ${uniqueKeys[0]}.`,
      requiresReview: false,
    };
  }

  return {
    status: 'ambiguous',
    confidence: 0.5,
    primaryKey: uniqueKeys[0],
    keys: uniqueKeys,
    message: `Multiple Jira keys detected (${uniqueKeys.join(', ')}). Manual review required.`,
    requiresReview: true,
  };
}

/**
 * Normalizes multi-platform status semantics (FR-07).
 * Ensures PR state, review state, CI check state, and Jira workflow state
 * remain distinct and are never conflated.
 */
function normalizeStatusSemantics({ prState, reviewStatus, checkResult, jiraStatus }) {
  return {
    prState: prState ? String(prState).toLowerCase() : 'unknown',
    reviewStatus: reviewStatus || 'PENDING',
    checkResult: checkResult ? String(checkResult).toUpperCase() : 'NONE',
    jiraStatus: jiraStatus || 'Unknown',
    isMerged: ['merged', 'closed'].includes(String(prState || '').toLowerCase()),
    isJiraDone: ['done', 'resolved', 'closed'].includes(String(jiraStatus || '').toLowerCase()),
  };
}

module.exports = {
  extractJiraKeys,
  matchIssueKeys,
  normalizeStatusSemantics,
};
