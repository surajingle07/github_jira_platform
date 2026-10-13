const githubService = require('./githubService');
const jiraService = require('./jiraService');
const { extractJiraKeys, matchIssueKeys } = require('./correlationService');
const Repository = require('../models/Repository');
const JiraIssue = require('../models/JiraIssue');
const PullRequest = require('../models/PullRequest');
const Commit = require('../models/Commit');
const SyncLog = require('../models/SyncLog');
const IssueLink = require('../models/IssueLink');

async function persistRepositoryData(repositories = []) {
  if (!global.isMongoConnected) return [];

  const saved = [];
  for (const repo of repositories) {
    const payload = {
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || repo.owner || 'unknown',
      defaultBranch: repo.default_branch || 'main',
      private: Boolean(repo.private),
      url: repo.html_url,
      visibility: repo.private ? 'private' : 'public',
      lastSyncedAt: new Date(),
    };

    const savedRepo = await Repository.findOneAndUpdate(
      { githubId: repo.id },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    saved.push(savedRepo);
  }

  return saved;
}

async function persistIssueData(issues = []) {
  if (!global.isMongoConnected) return [];

  const saved = [];
  for (const issue of issues) {
    const payload = {
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      issueType: issue.issueType,
      priority: issue.priority,
      assignee: issue.assignee,
      sprint: issue.sprint || '',
      projectId: issue.projectKey,
      url: issue.url || '',
    };

    const savedIssue = await JiraIssue.findOneAndUpdate(
      { key: issue.key },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    saved.push(savedIssue);
  }

  return saved;
}

async function persistPullRequestData(pullRequests = []) {
  if (!global.isMongoConnected) return [];

  const saved = [];
  for (const pr of pullRequests) {
    const issueKeys = extractJiraKeys([pr.title, pr.head?.ref, pr.base?.ref]);
    const payload = {
      githubId: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
      author: pr.user?.login || 'unknown',
      sourceBranch: pr.head?.ref || 'unknown',
      targetBranch: pr.base?.ref || 'main',
      createdAt: pr.created_at ? new Date(pr.created_at) : new Date(),
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      reviewers: (pr.requested_reviewers || []).map((reviewer) => reviewer.login || reviewer),
      jiraIssueKey: issueKeys[0] || null,
    };

    const savedPr = await PullRequest.findOneAndUpdate(
      { githubId: pr.id },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (issueKeys.length) {
      await IssueLink.findOneAndUpdate(
        { githubRecordType: 'pull_request', githubRecordId: String(pr.id) },
        { $set: { jiraIssueKey: issueKeys[0], githubRecordName: pr.title, source: 'auto', correlationStatus: 'linked', evidence: issueKeys } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    saved.push(savedPr);
  }

  return saved;
}

async function persistCommitData(commits = []) {
  if (!global.isMongoConnected) return [];

  const saved = [];
  for (const commit of commits) {
    const issueKeys = extractJiraKeys([commit.message]);
    const payload = {
      sha: commit.sha,
      message: commit.message,
      author: commit.author?.login || 'unknown',
      url: commit.html_url,
      repoFullName: commit.repository || 'unknown',
      createdAt: commit.commit?.author?.date ? new Date(commit.commit.author.date) : new Date(),
      jiraIssueKey: issueKeys[0] || null,
      pullRequestNumber: commit.pullRequestNumber || null,
    };

    const savedCommit = await Commit.findOneAndUpdate(
      { sha: commit.sha },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (issueKeys.length) {
      await IssueLink.findOneAndUpdate(
        { githubRecordType: 'commit', githubRecordId: commit.sha },
        { $set: { jiraIssueKey: issueKeys[0], githubRecordName: commit.message, source: 'auto', correlationStatus: 'linked', evidence: issueKeys } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    saved.push(savedCommit);
  }

  return saved;
}

async function persistSyncLog(payload = {}) {
  if (!global.isMongoConnected) return null;

  return SyncLog.create({
    provider: payload.provider || 'combined',
    syncType: payload.syncType || 'manual',
    status: payload.status || 'success',
    startedAt: payload.startedAt || new Date(),
    completedAt: payload.completedAt || new Date(),
    recordsFetched: payload.recordsFetched || 0,
    recordsUpdated: payload.recordsUpdated || 0,
    message: payload.message || 'Sync completed.',
    error: payload.error || null,
  });
}

async function getDashboardData() {
  const [repositories, issues] = await Promise.all([
    githubService.getRepositories(),
    jiraService.searchIssues(),
  ]);

  const configuredRepository = process.env.GITHUB_REPOSITORY;
  const repository = configuredRepository
    ? { full_name: configuredRepository, owner: { login: configuredRepository.split('/')[0] }, name: configuredRepository.split('/')[1] }
    : repositories[0];
  const [owner, repositoryName] = repository?.full_name
    ? repository.full_name.split('/')
    : [repository?.owner?.login, repository?.name];
  const [pullRequests, commits] = owner && repositoryName
    ? await Promise.all([
      githubService.getPullRequests(owner, repositoryName),
      githubService.getCommits(owner, repositoryName),
    ])
    : [[], []];

  const repositoryPullRequests = pullRequests.map((record) => ({ ...record, repository }));
  const repositoryCommits = commits.map((record) => ({ ...record, repository }));

  const linkedRecords = [...repositoryPullRequests, ...repositoryCommits].map((record) => {
    const issueKeys = extractJiraKeys([
      record.title,
      record.message,
      record.head && record.head.ref,
      record.branch,
      record.ref,
    ]);

    return {
      ...record,
      issueKeys,
      correlation: matchIssueKeys(issueKeys),
    };
  });

  const summary = {
    totalRepositories: repositories.length,
    totalIssues: issues.length,
    openPullRequests: pullRequests.filter((pr) => pr.state === 'open').length,
    mergedPullRequests: pullRequests.filter((pr) => pr.state === 'merged' || (pr.state === 'closed' && pr.merged_at)).length,
    totalCommits: commits.length,
    linkedRecords: linkedRecords.filter((record) => record.correlation.status !== 'unmatched').length,
  };

  const activity = [
    ...repositoryPullRequests.map((pr) => ({
      type: 'pull_request',
      title: pr.title,
      time: pr.updated_at,
      status: pr.state,
    })),
    ...issues.map((issue) => ({
      type: 'jira_issue',
      title: `${issue.key}: ${issue.summary}`,
      time: issue.updated,
      status: issue.status,
    })),
    ...repositoryCommits.map((commit) => ({
      type: 'commit',
      title: commit.message,
      time: commit.commit?.author?.date,
      status: 'committed',
    })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  return {
    summary,
    repositories,
    pullRequests: linkedRecords.filter((record) => record.title),
    issues,
    commits: linkedRecords.filter((record) => record.message),
    activity: activity.slice(0, 8),
  };
}

async function runSync() {
  const startedAt = new Date();
  const dashboardData = await getDashboardData();

  const savedRepositories = await persistRepositoryData(dashboardData.repositories);
  const savedIssues = await persistIssueData(dashboardData.issues);
  const savedPullRequests = await persistPullRequestData(dashboardData.pullRequests || []);
  const savedCommits = await persistCommitData(dashboardData.commits || []);

  await persistSyncLog({
    provider: 'combined',
    syncType: 'manual',
    status: 'success',
    startedAt,
    completedAt: new Date(),
    recordsFetched: savedRepositories.length + savedIssues.length + savedPullRequests.length + savedCommits.length,
    recordsUpdated: savedRepositories.length + savedIssues.length + savedPullRequests.length + savedCommits.length,
    message: 'Dashboard sync completed successfully.',
  });

  return {
    status: 'success',
    syncedAt: new Date().toISOString(),
    summary: dashboardData.summary,
    repositories: dashboardData.repositories.length,
    issues: dashboardData.issues.length,
    pullRequests: dashboardData.pullRequests.length,
    persisted: {
      repositories: savedRepositories.length,
      issues: savedIssues.length,
      pullRequests: savedPullRequests.length,
      commits: savedCommits.length,
    },
  };
}

module.exports = {
  getDashboardData,
  runSync,
  persistRepositoryData,
  persistIssueData,
  persistPullRequestData,
  persistCommitData,
  persistSyncLog,
};
