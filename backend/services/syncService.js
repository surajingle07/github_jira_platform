const githubService = require('./githubService');
const jiraService = require('./jiraService');
const { extractJiraKeys, matchIssueKeys, normalizeStatusSemantics } = require('./correlationService');
const Repository = require('../models/Repository');
const JiraIssue = require('../models/JiraIssue');
const PullRequest = require('../models/PullRequest');
const Commit = require('../models/Commit');
const SyncLog = require('../models/SyncLog');
const IssueLink = require('../models/IssueLink');
const ActionAuditLog = require('../models/ActionAuditLog');

async function persistRepositoryData(repositories = []) {
  if (!global.isMongoConnected) return [];

  const saved = [];
  for (const repo of repositories) {
    const payload = {
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name || `${repo.owner?.login || 'user'}/${repo.name}`,
      owner: repo.owner?.login || repo.owner || 'unknown',
      defaultBranch: repo.default_branch || 'main',
      private: Boolean(repo.private),
      url: repo.html_url || `https://github.com/${repo.full_name}`,
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
    const issueKeys = extractJiraKeys([pr.title, pr.body, pr.head?.ref, pr.base?.ref]);
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
      const match = matchIssueKeys(issueKeys);
      await IssueLink.findOneAndUpdate(
        { githubRecordType: 'pull_request', githubRecordId: String(pr.id) },
        {
          $set: {
            jiraIssueKey: issueKeys[0],
            githubRecordName: pr.title,
            source: 'auto',
            correlationStatus: match.status,
            evidence: issueKeys,
          },
        },
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
    const message = commit.commit?.message || commit.message || '';
    const issueKeys = extractJiraKeys([message]);
    const payload = {
      sha: commit.sha,
      message,
      author: commit.author?.login || commit.commit?.author?.name || 'unknown',
      url: commit.html_url || '',
      repoFullName: commit.repoFullName || commit.repository?.full_name || 'unknown',
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
      const match = matchIssueKeys(issueKeys);
      await IssueLink.findOneAndUpdate(
        { githubRecordType: 'commit', githubRecordId: commit.sha },
        {
          $set: {
            jiraIssueKey: issueKeys[0],
            githubRecordName: message,
            source: 'auto',
            correlationStatus: match.status,
            evidence: issueKeys,
          },
        },
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

async function getDashboardData(options = {}) {
  const [repositories, jiraProjects, jiraIssues] = await Promise.all([
    githubService.getRepositories(),
    jiraService.getProjects(),
    jiraService.searchIssues(),
  ]);

  // Pick selected repository from options, env, or first in list
  const selectedRepoFullName = options.repository || process.env.GITHUB_REPOSITORY;
  let activeRepo = repositories.find((r) => r.full_name === selectedRepoFullName) || repositories[0];

  if (!activeRepo && repositories.length) {
    activeRepo = repositories[0];
  }

  const [owner, repoName] = activeRepo?.full_name
    ? activeRepo.full_name.split('/')
    : [activeRepo?.owner?.login || 'Axlero-Web-Development-Group-3', activeRepo?.name || 'syncspace'];

  const [pullRequestsRaw, commitsRaw, workflowRuns] = await Promise.all([
    githubService.getPullRequests(owner, repoName),
    githubService.getCommits(owner, repoName),
    githubService.getWorkflowRuns(owner, repoName).catch(() => []),
  ]);

  // Enrich Pull Requests with correlation and status semantics
  const pullRequests = pullRequestsRaw.map((pr) => {
    const keys = extractJiraKeys([pr.title, pr.body, pr.head?.ref, pr.base?.ref]);
    const correlation = matchIssueKeys(keys);
    const relatedIssue = jiraIssues.find((i) => keys.includes(i.key));

    const statusSemantics = normalizeStatusSemantics({
      prState: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
      reviewStatus: pr.reviewStatus || (pr.requested_reviewers?.length ? 'PENDING' : 'APPROVED'),
      checkResult: pr.ciStatus || 'SUCCESS',
      jiraStatus: relatedIssue?.status,
    });

    return {
      ...pr,
      repository: { full_name: `${owner}/${repoName}`, name: repoName, owner },
      issueKeys: keys,
      correlation,
      statusSemantics,
      linkedIssue: relatedIssue || null,
    };
  });

  // Enrich Commits with correlation
  const commits = commitsRaw.map((commit) => {
    const message = commit.commit?.message || commit.message || '';
    const keys = extractJiraKeys([message]);
    const correlation = matchIssueKeys(keys);
    const relatedIssue = jiraIssues.find((i) => keys.includes(i.key));

    return {
      ...commit,
      message,
      repository: { full_name: `${owner}/${repoName}`, name: repoName, owner },
      issueKeys: keys,
      correlation,
      linkedIssue: relatedIssue || null,
    };
  });

  // Cross-Platform Correlated Items: group by Jira issue
  const correlatedJiraIssues = jiraIssues.map((issue) => {
    const linkedPRs = pullRequests.filter((pr) => pr.issueKeys.includes(issue.key));
    const linkedCommits = commits.filter((c) => c.issueKeys.includes(issue.key));

    const hasAmbiguity =
      linkedPRs.some((pr) => pr.correlation.status === 'ambiguous') ||
      linkedCommits.some((c) => c.correlation.status === 'ambiguous');

    const correlationStatus = (linkedPRs.length || linkedCommits.length)
      ? (hasAmbiguity ? 'ambiguous' : 'linked')
      : 'unlinked';

    return {
      ...issue,
      correlationStatus,
      linkedPullRequests: linkedPRs,
      linkedCommits,
      totalLinkedDevItems: linkedPRs.length + linkedCommits.length,
    };
  });

  const unlinkedPullRequests = pullRequests.filter((pr) => pr.correlation.status === 'unmatched');
  const unlinkedCommits = commits.filter((c) => c.correlation.status === 'unmatched');
  const ambiguousItems = [
    ...pullRequests.filter((pr) => pr.correlation.status === 'ambiguous'),
    ...commits.filter((c) => c.correlation.status === 'ambiguous'),
  ];

  const summary = {
    totalRepositories: repositories.length,
    totalProjects: jiraProjects.length,
    totalIssues: jiraIssues.length,
    openPullRequests: pullRequests.filter((pr) => pr.state === 'open').length,
    mergedPullRequests: pullRequests.filter((pr) => pr.state === 'merged' || (pr.state === 'closed' && pr.merged_at)).length,
    totalCommits: commits.length,
    linkedRecords: pullRequests.filter((p) => p.correlation.status === 'linked').length + commits.filter((c) => c.correlation.status === 'linked').length,
    ambiguousRecords: ambiguousItems.length,
    unlinkedRecords: unlinkedPullRequests.length + unlinkedCommits.length,
    ciRunsCount: workflowRuns.length,
  };

  // Build unified chronological activity timeline (FR-09)
  const activity = [
    ...pullRequests.map((pr) => ({
      id: `pr-${pr.id || pr.number}`,
      type: 'pull_request',
      event: pr.merged_at ? 'PR merged' : pr.state === 'open' ? 'PR opened' : 'PR closed',
      title: pr.title,
      author: pr.user?.login || 'developer',
      avatar: pr.user?.avatar_url,
      time: pr.merged_at || pr.updated_at || pr.created_at,
      status: pr.state,
      issueKeys: pr.issueKeys,
      url: pr.html_url,
    })),
    ...jiraIssues.map((issue) => ({
      id: `jira-${issue.id || issue.key}`,
      type: 'jira_issue',
      event: `Status: ${issue.status}`,
      title: `${issue.key}: ${issue.summary}`,
      author: issue.assignee || 'Unassigned',
      avatar: issue.assigneeAvatar,
      time: issue.updated,
      status: issue.status,
      issueKeys: [issue.key],
      url: issue.url,
    })),
    ...commits.map((commit, idx) => ({
      id: `commit-${commit.sha || idx}`,
      type: 'commit',
      event: 'Commit pushed',
      title: commit.message,
      author: commit.author?.login || commit.commit?.author?.name || 'developer',
      time: commit.commit?.author?.date || commit.createdAt,
      status: 'committed',
      issueKeys: commit.issueKeys,
      url: commit.html_url,
    })),
    ...workflowRuns.map((run) => ({
      id: `ci-${run.id}`,
      type: 'ci_run',
      event: `Workflow ${run.conclusion || run.status}`,
      title: `${run.name || 'CI Pipeline'} (#${run.id})`,
      author: run.head_branch || 'main',
      time: run.created_at || new Date().toISOString(),
      status: run.conclusion || run.status,
      issueKeys: [],
      url: run.html_url,
    })),
  ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  return {
    summary,
    activeRepository: activeRepo,
    repositories,
    jiraProjects,
    issues: jiraIssues,
    correlatedIssues: correlatedJiraIssues,
    pullRequests,
    commits,
    workflowRuns,
    ambiguousItems,
    unlinkedPullRequests,
    unlinkedCommits,
    activity: activity.slice(0, 20),
  };
}

async function runSync(options = {}) {
  const startedAt = new Date();
  const dashboardData = await getDashboardData(options);

  const savedRepositories = await persistRepositoryData(dashboardData.repositories);
  const savedIssues = await persistIssueData(dashboardData.issues);
  const savedPullRequests = await persistPullRequestData(dashboardData.pullRequests || []);
  const savedCommits = await persistCommitData(dashboardData.commits || []);

  const totalRecords =
    savedRepositories.length +
    savedIssues.length +
    savedPullRequests.length +
    savedCommits.length;

  const syncLog = await persistSyncLog({
    provider: options.provider || 'combined',
    syncType: options.syncType || 'manual',
    status: 'success',
    startedAt,
    completedAt: new Date(),
    recordsFetched: totalRecords,
    recordsUpdated: totalRecords,
    message: `Synchronized ${savedRepositories.length} repos, ${savedIssues.length} Jira issues, ${savedPullRequests.length} PRs, ${savedCommits.length} commits.`,
  });

  return {
    status: 'success',
    syncedAt: new Date().toISOString(),
    syncLogId: syncLog?._id,
    summary: dashboardData.summary,
    records: {
      repositories: savedRepositories.length,
      issues: savedIssues.length,
      pullRequests: savedPullRequests.length,
      commits: savedCommits.length,
    },
  };
}

async function handleGitHubWebhook(event, payload, deliveryId) {
  if (global.isMongoConnected) {
    await ActionAuditLog.create({
      actionType: 'webhook_received',
      targetSystem: 'github',
      targetEntity: payload.repository?.full_name || 'github',
      payload: { event, deliveryId, action: payload.action },
      result: 'success',
      initiatedBy: 'github-webhook',
      message: `Processed GitHub event '${event}' (${payload.action || 'default'}).`,
    });
  }

  if (event === 'pull_request' && payload.pull_request) {
    await persistPullRequestData([payload.pull_request]);
  } else if (event === 'push' && payload.commits?.length) {
    await persistCommitData(payload.commits.map((c) => ({
      ...c,
      repoFullName: payload.repository?.full_name,
    })));
  }

  return { status: 'processed', event, deliveryId };
}

async function handleJiraWebhook(event, payload) {
  if (global.isMongoConnected) {
    await ActionAuditLog.create({
      actionType: 'webhook_received',
      targetSystem: 'jira',
      targetEntity: payload.issue?.key || 'jira',
      payload: { event, issueKey: payload.issue?.key },
      result: 'success',
      initiatedBy: 'jira-webhook',
      message: `Processed Jira webhook event '${event}'.`,
    });
  }

  if (payload.issue) {
    await persistIssueData([{
      key: payload.issue.key,
      summary: payload.issue.fields?.summary || '',
      status: payload.issue.fields?.status?.name || 'Unknown',
      issueType: payload.issue.fields?.issuetype?.name || 'Task',
      priority: payload.issue.fields?.priority?.name || 'Medium',
      assignee: payload.issue.fields?.assignee?.displayName || 'Unassigned',
      projectKey: payload.issue.fields?.project?.key || 'KAN',
    }]);
  }

  return { status: 'processed', event };
}

async function getRecentSyncLogs(limit = 15) {
  if (!global.isMongoConnected) {
    return [
      {
        provider: 'combined',
        syncType: 'manual',
        status: 'success',
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 3595000),
        recordsFetched: 24,
        recordsUpdated: 24,
        message: 'Dashboard sync completed successfully.',
      },
    ];
  }
  return SyncLog.find().sort({ startedAt: -1 }).limit(limit).lean();
}

async function getRecentAuditLogs(limit = 20) {
  if (!global.isMongoConnected) {
    return [
      {
        actionType: 'add_comment',
        targetSystem: 'jira',
        targetEntity: 'KAN-1',
        result: 'success',
        initiatedBy: 'user',
        message: 'Linked PR #42 correlation confirmed.',
        createdAt: new Date(),
      },
    ];
  }
  return ActionAuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}

module.exports = {
  getDashboardData,
  runSync,
  handleGitHubWebhook,
  handleJiraWebhook,
  getRecentSyncLogs,
  getRecentAuditLogs,
  persistRepositoryData,
  persistIssueData,
  persistPullRequestData,
  persistCommitData,
  persistSyncLog,
};
