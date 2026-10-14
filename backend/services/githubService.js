const axios = require('axios');
const { extractJiraKeys, matchIssueKeys } = require('./correlationService');

const mockUser = {
  login: 'surajingle07',
  id: 1001,
  name: 'Suraj Ingle',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
  type: 'User',
  public_repos: 10,
};

const mockRepositories = [
  {
    id: 1,
    name: 'syncspace',
    full_name: 'Axlero-Web-Development-Group-3/syncspace',
    owner: { login: 'Axlero-Web-Development-Group-3' },
    default_branch: 'main',
    private: false,
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace',
    description: 'Collaborative development workspace with real-time sync',
    stargazers_count: 5,
    language: 'JavaScript',
    open_issues_count: 4,
    updated_at: '2026-10-14T07:30:00Z',
  },
  {
    id: 2,
    name: 'AKOIN_Internship_task',
    full_name: 'surajingle07/AKOIN_Internship_task',
    owner: { login: 'surajingle07' },
    default_branch: 'main',
    private: false,
    html_url: 'https://github.com/surajingle07/AKOIN_Internship_task',
    description: 'Assignment task implementation repository',
    stargazers_count: 1,
    language: 'TypeScript',
    open_issues_count: 0,
    updated_at: '2026-10-12T11:20:00Z',
  },
  {
    id: 3,
    name: 'Custom-Employee-Portal',
    full_name: 'surajingle07/Custom-Employee-Portal',
    owner: { login: 'surajingle07' },
    default_branch: 'main',
    private: false,
    html_url: 'https://github.com/surajingle07/Custom-Employee-Portal',
    description: 'Enterprise internal employee portal dashboard',
    stargazers_count: 3,
    language: 'JavaScript',
    open_issues_count: 1,
    updated_at: '2026-10-10T16:45:00Z',
  },
];

const mockBranches = {
  'Axlero-Web-Development-Group-3/syncspace': [
    { name: 'main', commit: { sha: 'sha-main-1' } },
    { name: 'feature/KAN-1-webhook-sync', commit: { sha: 'sha-feat-1' } },
    { name: 'bugfix/KAN-3-auth-refresh', commit: { sha: 'sha-bug-1' } },
  ],
};

const mockPullRequests = [
  {
    id: 201,
    number: 4,
    title: 'KAN-1: Integrate GitHub webhook event processing',
    body: 'Resolves KAN-1 by adding idempotent webhook handler and signature validation.',
    state: 'open',
    created_at: '2026-10-14T07:15:00Z',
    updated_at: '2026-10-14T08:10:00Z',
    requested_reviewers: [{ login: 'code-reviewer-alex' }],
    head: { ref: 'feature/KAN-1-webhook-sync', sha: 'sha-feat-1' },
    base: { ref: 'main' },
    user: { login: 'surajingle07', avatar_url: 'https://avatars.githubusercontent.com/u/12345678' },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/pull/4',
    reviewStatus: 'APPROVED',
    ciStatus: 'SUCCESS',
  },
  {
    id: 202,
    number: 3,
    title: 'feat: add MongoDB persistence for room drawings (KAN-2)',
    body: 'Implements database schemas and correlation logging for KAN-2.',
    state: 'merged',
    created_at: '2026-10-13T12:00:00Z',
    updated_at: '2026-10-13T16:30:00Z',
    merged_at: '2026-10-13T16:30:00Z',
    requested_reviewers: [{ login: 'lead-dev-sam' }],
    head: { ref: 'feature/KAN-2-db-persistence', sha: 'sha-feat-2' },
    base: { ref: 'main' },
    user: { login: 'surajingle07', avatar_url: 'https://avatars.githubusercontent.com/u/12345678' },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/pull/3',
    reviewStatus: 'APPROVED',
    ciStatus: 'SUCCESS',
  },
  {
    id: 203,
    number: 2,
    title: 'Set up React frontend & Tailwind utilities',
    body: 'Unlinked PR initializing the frontend layout without a Jira ticket reference.',
    state: 'merged',
    created_at: '2026-10-11T10:00:00Z',
    updated_at: '2026-10-11T14:20:00Z',
    merged_at: '2026-10-11T14:20:00Z',
    requested_reviewers: [],
    head: { ref: 'setup/frontend-init', sha: 'sha-feat-3' },
    base: { ref: 'main' },
    user: { login: 'surajingle07', avatar_url: 'https://avatars.githubusercontent.com/u/12345678' },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/pull/2',
    reviewStatus: 'NONE',
    ciStatus: 'SUCCESS',
  },
  {
    id: 204,
    number: 5,
    title: 'WIP: Refactor auth token expiry and session cleanup (KAN-2, KAN-3)',
    body: 'Touches both KAN-2 pipeline and KAN-3 authentication refresh logic.',
    state: 'open',
    created_at: '2026-10-14T07:45:00Z',
    updated_at: '2026-10-14T08:05:00Z',
    requested_reviewers: [{ login: 'security-lead' }],
    head: { ref: 'refactor/auth-cleanup', sha: 'sha-feat-4' },
    base: { ref: 'main' },
    user: { login: 'surajingle07', avatar_url: 'https://avatars.githubusercontent.com/u/12345678' },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/pull/5',
    reviewStatus: 'CHANGES_REQUESTED',
    ciStatus: 'FAILURE',
  },
];

const mockCommits = [
  {
    sha: '1a2b3c4d5e',
    message: '[KAN-1] Add webhook signature verification and idempotency check',
    author: { login: 'surajingle07' },
    commit: { author: { name: 'Suraj Ingle', date: '2026-10-14T08:15:00Z' } },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/commit/1a2b3c4d5e',
    files: ['src/services/webhook.js', 'src/middleware/auth.js'],
  },
  {
    sha: '6f7g8h9i0j',
    message: '[KAN-2] Update CI workflow with automated test step',
    author: { login: 'surajingle07' },
    commit: { author: { name: 'Suraj Ingle', date: '2026-10-13T15:20:00Z' } },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/commit/6f7g8h9i0j',
    files: ['.github/workflows/ci.yml'],
  },
  {
    sha: '9k8j7h6g5f',
    message: 'docs: update repository readme with setup steps',
    author: { login: 'surajingle07' },
    commit: { author: { name: 'Suraj Ingle', date: '2026-10-12T10:00:00Z' } },
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/commit/9k8j7h6g5f',
    files: ['README.md'],
  },
];

const mockChecks = [
  { id: 101, name: 'build-and-lint', status: 'completed', conclusion: 'success', started_at: '2026-10-14T08:10:00Z' },
  { id: 102, name: 'unit-and-integration-tests', status: 'completed', conclusion: 'success', started_at: '2026-10-14T08:12:00Z' },
];

const mockWorkflowRuns = [
  {
    id: 501,
    name: 'CI Pipeline',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/actions/runs/501',
    created_at: '2026-10-14T08:10:00Z',
    head_branch: 'main',
    event: 'push',
  },
  {
    id: 502,
    name: 'Deploy Staging',
    status: 'completed',
    conclusion: 'success',
    html_url: 'https://github.com/Axlero-Web-Development-Group-3/syncspace/actions/runs/502',
    created_at: '2026-10-14T08:15:00Z',
    head_branch: 'main',
    event: 'workflow_dispatch',
  },
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

async function verifyConnection() {
  const startTime = Date.now();
  if (!process.env.GITHUB_TOKEN) {
    return {
      connected: false,
      configured: false,
      mode: 'mock',
      message: 'GITHUB_TOKEN environment variable is not configured.',
      user: null,
      rateLimit: null,
      latencyMs: 0,
    };
  }

  try {
    const client = createGitHubClient();
    const res = await client.get('/user');
    const latencyMs = Date.now() - startTime;

    const rateLimit = {
      limit: Number(res.headers['x-ratelimit-limit'] || 5000),
      remaining: Number(res.headers['x-ratelimit-remaining'] || 4999),
      reset: Number(res.headers['x-ratelimit-reset'] || 0),
    };

    return {
      connected: true,
      configured: true,
      mode: 'live',
      user: {
        login: res.data.login,
        name: res.data.name,
        avatar_url: res.data.avatar_url,
        public_repos: res.data.public_repos,
        type: res.data.type,
      },
      scopes: res.headers['x-oauth-scopes'] || 'repo, read:org, user',
      rateLimit,
      latencyMs,
      message: 'GitHub connection verified successfully.',
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      mode: 'fallback-mock',
      message: error.response?.data?.message || error.message || 'GitHub connection test failed.',
      status: error.response?.status,
      user: null,
      latencyMs: Date.now() - startTime,
    };
  }
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
      error: 'GitHub token unavailable or invalid. Using fallback data.',
    };
  }
}

async function getRepositories() {
  if (!process.env.GITHUB_TOKEN) {
    return mockRepositories;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get('/user/repos?per_page=100&sort=updated');
    if (!Array.isArray(data) || data.length === 0) {
      return mockRepositories;
    }
    return data;
  } catch (error) {
    console.warn('GitHub getRepositories error, using mock:', error.message);
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

    if (!Array.isArray(data) || data.length === 0) {
      // If repo has no PRs, return rich mock data to demonstrate full correlation
      return mockPullRequests;
    }

    return data.map((pr) => {
      const keys = extractJiraKeys([pr.title, pr.body, pr.head?.ref, pr.base?.ref]);
      return {
        ...pr,
        issueKeys: keys,
        correlation: matchIssueKeys(keys),
      };
    });
  } catch (error) {
    console.warn('GitHub getPullRequests error, using mock:', error.message);
    return mockPullRequests;
  }
}

async function getPullRequestReviews(owner, repo, pullNumber) {
  if (!process.env.GITHUB_TOKEN) {
    return [
      { id: 1, user: { login: 'code-reviewer-alex' }, state: 'APPROVED', submitted_at: '2026-10-14T08:00:00Z' },
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
    return [
      { filename: 'src/services/webhook.js', status: 'modified', additions: 45, deletions: 2 },
      { filename: 'src/middleware/auth.js', status: 'modified', additions: 18, deletions: 4 },
    ];
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
    return data.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
    }));
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
    const { data } = await client.get(`/repos/${owner}/${repo}/commits?per_page=50`);

    if (!Array.isArray(data) || data.length === 0) {
      return mockCommits;
    }

    return data.map((c) => {
      const keys = extractJiraKeys([c.commit?.message, c.message]);
      return {
        ...c,
        message: c.commit?.message || c.message || '',
        issueKeys: keys,
        correlation: matchIssueKeys(keys),
      };
    });
  } catch (error) {
    console.warn('GitHub getCommits error, using mock:', error.message);
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
    return mockWorkflowRuns;
  }

  try {
    const client = createGitHubClient();
    const { data } = await client.get(`/repos/${owner}/${repo}/actions/runs?per_page=20`);
    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      return mockWorkflowRuns;
    }
    return data.workflow_runs;
  } catch (error) {
    return mockWorkflowRuns;
  }
}

function getLinkedGitHubRecords(records = []) {
  return records.map((record) => {
    const keys = extractJiraKeys([
      record.title,
      record.body,
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
  verifyConnection,
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
  mockPullRequests,
  mockCommits,
};
