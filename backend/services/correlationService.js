function extractJiraKeys(values = []) {
  const uniqueKeys = new Set();

  for (const value of values) {
    if (!value || typeof value !== 'string') continue;

    const matches = value.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) || [];
    matches.forEach((item) => uniqueKeys.add(item));
  }

  return Array.from(uniqueKeys);
}

function matchIssueKeys(keys = []) {
  const uniqueKeys = [...new Set((keys || []).filter(Boolean))];

  if (!uniqueKeys.length) {
    return {
      status: 'unmatched',
      keys: [],
      message: 'No Jira key was found in the GitHub record.',
    };
  }

  if (uniqueKeys.length === 1) {
    return {
      status: 'linked',
      keys: uniqueKeys,
      message: 'A single verified Jira issue key was detected.',
    };
  }

  return {
    status: 'ambiguous',
    keys: uniqueKeys,
    message: 'Multiple Jira issue keys were found; the relationship requires review.',
  };
}

module.exports = {
  extractJiraKeys,
  matchIssueKeys,
};
