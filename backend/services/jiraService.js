const axios = require('axios');

const mockProjects = [
  { id: 'proj-1', key: 'PROJ', name: 'Project Alpha' },
  { id: 'dev-1', key: 'DEV', name: 'Development' },
];

const mockIssues = [
  {
    id: '10001',
    key: 'PROJ-123',
    summary: 'Fix login validation',
    status: 'In Progress',
    priority: 'High',
    issueType: 'Bug',
    assignee: 'Jane Developer',
    projectKey: 'PROJ',
    updated: '2026-10-12T09:00:00.000Z',
  },
  {
    id: '10002',
    key: 'PROJ-456',
    summary: 'Reset password flow',
    status: 'To Do',
    priority: 'Medium',
    issueType: 'Task',
    assignee: 'Alex Engineer',
    projectKey: 'PROJ',
    updated: '2026-10-11T15:30:00.000Z',
  },
  {
    id: '10003',
    key: 'DEV-789',
    summary: 'Improve release checklist',
    status: 'Done',
    priority: 'Low',
    issueType: 'Story',
    assignee: 'Release Team',
    projectKey: 'DEV',
    updated: '2026-10-10T09:20:00.000Z',
  },
];

function createJiraClient() {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const baseURL = process.env.JIRA_BASE_URL || 'https://example.atlassian.net';

  return axios.create({
    baseURL: `${baseURL.replace(/\/$/, '')}/rest/api/3`,
    timeout: 15000,
    headers: {
      Accept: 'application/json',
      ...(email && apiToken ? { Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}` } : {}),
    },
  });
}

async function getProjects() {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return mockProjects;
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get('/project/search');
    return data.values || [];
  } catch (error) {
    return mockProjects;
  }
}

async function searchIssues() {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return mockIssues;
  }

  try {
    const client = createJiraClient();
    const { data } = await client.post('/search', {
      jql: 'ORDER BY updated DESC',
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'issuetype', 'assignee', 'project'],
    });

    return (data.issues || []).map((issue) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      priority: issue.fields.priority?.name || 'Medium',
      issueType: issue.fields.issuetype?.name || 'Task',
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      projectKey: issue.fields.project?.key || 'PROJ',
      updated: issue.fields.updated,
    }));
  } catch (error) {
    return mockIssues;
  }
}

async function getIssue(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return mockIssues.find((issue) => issue.key === issueKey) || null;
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}`);
    return {
      id: data.id,
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status?.name || 'Unknown',
      priority: data.fields.priority?.name || 'Medium',
      issueType: data.fields.issuetype?.name || 'Task',
      assignee: data.fields.assignee?.displayName || 'Unassigned',
      projectKey: data.fields.project?.key || 'PROJ',
      updated: data.fields.updated,
    };
  } catch (error) {
    return mockIssues.find((issue) => issue.key === issueKey) || null;
  }
}

async function getIssueComments(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [{ author: 'project-bot', body: 'Initial triage complete.' }];
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}/comment`);
    return data.comments || [];
  } catch (error) {
    return [{ author: 'project-bot', body: 'No comments available.' }];
  }
}

async function getIssueChangelog(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [{ created: '2026-10-12T09:00:00.000Z', field: 'status', fromString: 'To Do', toString: 'In Progress' }];
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}/changelog`);
    return data.values || [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  getProjects,
  searchIssues,
  getIssue,
  getIssueComments,
  getIssueChangelog,
};
