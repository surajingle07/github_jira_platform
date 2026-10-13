const axios = require('axios');
const { extractJiraKeys, matchIssueKeys } = require('./correlationService');

const mockUser = {
  login: 'demo-github-user',
  id: 1001,
  name: 'Demo GitHub User',
  type: 'User',
};

const mockRepositories = [
  {
    id: 1,
    name: 'customer-portal',
    full_name: 'demo-org/customer-portal',
    owner: { login: 'demo-org' },
    default_branch: 'main',
    private: false,
    html_url: 'https://github.com/demo-org/customer-portal',
  },
  {
    id: 2,
    name: 'mobile-app',
    full_name: 'demo-org/mobile-app',
    owner: { login: 'demo-org' },
    default_branch: 'develop',
    private: false,
    html_url: 'https://github.com/demo-org/mobile-app',
  },
];

const mockBranches = {
  'demo-org/customer-portal': [
    { name: 'main' },
    { name: 'feature/PROJ-123-login-fix' },
    { name: 'bugfix/PROJ-456-reset-flow' },
  ],
  'demo-org/mobile-app': [
    { name: 'develop' },
    { name: 'feature/PROJ-789-qa-fix' },
  ],
};

const mockPullRequests = [
  {
    id: 100,
    number: 42,
    title: 'Fix login validation (PROJ-123)',
    state: 'merged',
    created_at: '2026-10-11T10:00:00Z',
    updated_at: '2026-10-11T12:30:00Z',
    requested_reviewers: [{ login: 'alice' }],
    head: { ref: 'feature/PROJ-123-login-fix' },
    base: { ref: 'main' },
    user: { login: 'demo-github-user' },
    html_url: 'https://github.com/demo-org/customer-portal/pull/42',
  },
  {
    id: 101,
    number: 43,
    title: 'Improve password reset flow',
    state: 'open',
    created_at: '2026-10-12T08:00:00Z',
    updated_at: '2026-10-12T09:00:00Z',
    requested_reviewers: [{ login: 'bob' }],
    head: { ref: 'bugfix/PROJ-456-reset-flow' },
    base: { ref: 'main' },
    user: { login: 'demo-github-user' },
    html_url: 'https://github.com/demo-org/customer-portal/pull/43',
  },
];

const mockCommits = [
  {
    sha: 'abc111',
    message: 'PROJ-123 Fix login validation',
    author: { login: 'demo-github-user' },
    commit: { author: { date: '2026-10-11T09:15:00Z' } },
    html_url: 'https://github.com/demo-org/customer-portal/commit/abc111',
    files: ['src/auth/login.js'],
  },
  {
    sha: 'def222',
    message: 'PROJ-456 fix reset password flow',
    author: { login: 'demo-github-user' },
    commit: { author: { date: '2026-10-12T08:40:00Z' } },
    html_url: 'https://github.com/demo-org/customer-portal/commit/def222',
    files: ['src/auth/reset.js'],
  },
];

const mockChecks = [
  { name: 'build', status: 'completed', conclusion: 'success' },
  { name: 'unit-tests', status: 'completed', conclusion: 'failure' },
];

function createGitHubClient() {
  return axios.create({
    baseURL: 'https://api.github.com',
    timeout: 15000,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
}

async function getAuthenticatedUser() {
  if (!process.env.GITHUB_TOKEN) {
    return mockUser;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get('/user');
    return data;
  } catch (error) {
    return {
      ...mockUser,
      error: 'GitHub token is invalid or unavailable. Falling back to demo data.',
    };
  }
}

async function getRepositories() {
  if (!process.env.GITHUB_TOKEN) {
    return mockRepositories;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get('/user/repos?per_page=100');
    return data;
  } catch (error) {
    return mockRepositories;
  }
}

async function getBranches(owner, repo) {
  const repoKey = `${owner}/${repo}`;

  if (!process.env.GITHUB_TOKEN) {
    return mockBranches[repoKey] || [{ name: 'main' }];
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/branches`);
    return data;
  } catch (error) {
    return mockBranches[repoKey] || [{ name: 'main' }];
  }
}

async function getPullRequests(owner, repo) {
  if (!process.env.GITHUB_TOKEN) {
    return mockPullRequests;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`);
    return data;
  } catch (error) {
    return mockPullRequests;
  }
}

async function getPullRequestReviews(owner, repo, pullNumber) {
  if (!process.env.GITHUB_TOKEN) {
    return [
      { user: { login: 'alice' }, state: 'APPROVED' },
      { user: { login: 'bob' }, state: 'COMMENTED' },
    ];
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`);
    return data;
  } catch (error) {
    return [];
  }
}

async function getPullRequestFiles(owner, repo, pullNumber) {
  if (!process.env.GITHUB_TOKEN) {
    return ['src/auth/login.js', 'src/auth/reset.js'];
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
    return data.map((item) => item.filename);
  } catch (error) {
    return [];
  }
}

async function getCommits(owner, repo) {
  if (!process.env.GITHUB_TOKEN) {
    return mockCommits;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/commits?per_page=100`);
    return data;
  } catch (error) {
    return mockCommits;
  }
}

async function getCommitChecks(owner, repo, sha) {
  if (!process.env.GITHUB_TOKEN) {
    return mockChecks;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/commits/${sha}/check-runs`);
    return data.check_runs || [];
  } catch (error) {
    return mockChecks;
  }
}

async function getWorkflowRuns(owner, repo) {
  if (!process.env.GITHUB_TOKEN) {
    return [
      { id: 1, name: 'CI', conclusion: 'success', status: 'completed' },
      { id: 2, name: 'Deploy', conclusion: 'failure', status: 'completed' },
    ];
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/actions/runs`);
    return data.workflow_runs || [];
  } catch (error) {
    return [];
  }
}

function getLinkedGitHubRecords(records = []) {
  return records.map((record) => {
    const keys = extractJiraKeys([
      record.title,
      record.message,
      record.head && record.head.ref,
      record.branch,
      record.ref,
    ]);

    return {
      ...record,
      issueKeys: keys,
      correlation: matchIssueKeys(keys),
    };
  });
}

module.exports = {
  getAuthenticatedUser,
  getRepositories,
  getBranches,
  getPullRequests,
  getPullRequestReviews,
  getPullRequestFiles,
  getCommits,
  getCommitChecks,
  getWorkflowRuns,
  getLinkedGitHubRecords,
};
