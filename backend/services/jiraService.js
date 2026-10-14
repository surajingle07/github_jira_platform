const axios = require('axios');
const ActionAuditLog = require('../models/ActionAuditLog');

const mockProjects = [
  { id: 'proj-1', key: 'KAN', name: 'My Kanban Project', projectTypeKey: 'software' },
  { id: 'dev-1', key: 'DEV', name: 'Platform Development', projectTypeKey: 'software' },
];

const mockIssues = [
  {
    id: '10001',
    key: 'KAN-1',
    summary: 'Implement GitHub webhook event processing',
    status: 'In Progress',
    priority: 'High',
    issueType: 'Task',
    assignee: 'Suraj Ingle',
    projectKey: 'KAN',
    updated: '2026-10-14T08:30:00.000Z',
    sprint: 'Sprint 1',
  },
  {
    id: '10002',
    key: 'KAN-2',
    summary: 'Update CI/CD pipeline and release checklist',
    status: 'To Do',
    priority: 'Medium',
    issueType: 'Story',
    assignee: 'Suraj Ingle',
    projectKey: 'KAN',
    updated: '2026-10-14T08:29:00.000Z',
    sprint: 'Sprint 1',
  },
  {
    id: '10003',
    key: 'KAN-3',
    summary: 'Resolve authentication & token refresh error',
    status: 'To Do',
    priority: 'High',
    issueType: 'Task',
    assignee: 'Suraj Ingle',
    projectKey: 'KAN',
    updated: '2026-10-14T08:30:00.000Z',
    sprint: 'Sprint 1',
  },
  {
    id: '10004',
    key: 'DEV-101',
    summary: 'Setup automated branch protection rules',
    status: 'Done',
    priority: 'Low',
    issueType: 'Story',
    assignee: 'Release Bot',
    projectKey: 'DEV',
    updated: '2026-10-13T14:15:00.000Z',
    sprint: 'Sprint 1',
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
      'Content-Type': 'application/json',
      ...(email && apiToken ? { Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}` } : {}),
    },
  });
}

function createAgileClient() {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const baseURL = process.env.JIRA_BASE_URL || 'https://example.atlassian.net';

  return axios.create({
    baseURL: `${baseURL.replace(/\/$/, '')}/rest/agile/1.0`,
    timeout: 15000,
    headers: {
      Accept: 'application/json',
      ...(email && apiToken ? { Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}` } : {}),
    },
  });
}

/**
 * Extracts plain text from Atlassian Document Format (ADF) or returns string as is
 */
function extractTextFromADF(body) {
  if (!body) return '';
  if (typeof body === 'string') return body;

  if (body.type === 'doc' && Array.isArray(body.content)) {
    const texts = [];
    function traverse(node) {
      if (node.text) texts.push(node.text);
      if (Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    }
    traverse(body);
    return texts.join(' ').trim() || 'Comment with formatted content';
  }

  return JSON.stringify(body);
}

async function verifyConnection() {
  const startTime = Date.now();
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN || !process.env.JIRA_BASE_URL) {
    return {
      connected: false,
      configured: false,
      mode: 'mock',
      message: 'Jira environment variables (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN) not set.',
      user: null,
      projects: mockProjects.length,
      latencyMs: 0,
    };
  }

  try {
    const client = createJiraClient();
    const { data: user } = await client.get('/myself');
    const { data: projectsData } = await client.get('/project/search');
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      configured: true,
      mode: 'live',
      siteUrl: process.env.JIRA_BASE_URL,
      user: {
        displayName: user.displayName,
        emailAddress: user.emailAddress,
        accountId: user.accountId,
        active: user.active,
        timeZone: user.timeZone,
      },
      projectCount: (projectsData.values || []).length,
      latencyMs,
      message: 'Jira Cloud connection verified successfully.',
    };
  } catch (error) {
    return {
      connected: false,
      configured: true,
      mode: 'fallback-mock',
      message: error.response?.data?.message || error.message || 'Jira connection test failed.',
      status: error.response?.status,
      user: null,
      projectCount: mockProjects.length,
      latencyMs: Date.now() - startTime,
    };
  }
}

async function getProjects() {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return mockProjects;
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get('/project/search');
    return (data.values || []).map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      avatarUrls: p.avatarUrls,
    }));
  } catch (error) {
    console.warn('Jira getProjects error, using fallback:', error.message);
    return mockProjects;
  }
}

async function searchIssues(customJql) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return mockIssues;
  }

  try {
    const client = createJiraClient();
    // In Jira Cloud REST API v3, use /search/jql with a bounded search restriction
    const jql = customJql || 'project is not EMPTY ORDER BY updated DESC';

    const { data } = await client.post('/search/jql', {
      jql,
      maxResults: 50,
      fields: ['summary', 'status', 'priority', 'issuetype', 'assignee', 'project', 'updated', 'sprint', 'fixVersions', 'description'],
    });

    const issues = (data.issues || []).map((issue) => {
      let sprintName = '';
      if (issue.fields.sprint && typeof issue.fields.sprint === 'object') {
        sprintName = issue.fields.sprint.name || '';
      }

      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || 'Unknown',
        statusCategory: issue.fields.status?.statusCategory?.name || 'To Do',
        priority: issue.fields.priority?.name || 'Medium',
        issueType: issue.fields.issuetype?.name || 'Task',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        assigneeAvatar: issue.fields.assignee?.avatarUrls?.['24x24'] || null,
        projectKey: issue.fields.project?.key || 'KAN',
        projectName: issue.fields.project?.name || '',
        updated: issue.fields.updated,
        sprint: sprintName,
        url: `${process.env.JIRA_BASE_URL?.replace(/\/$/, '')}/browse/${issue.key}`,
      };
    });

    if (issues.length === 0) {
      // If live Jira returns no issues yet, combine with mock so dashboard shows rich data
      return mockIssues;
    }

    return issues;
  } catch (error) {
    console.warn('Jira searchIssues error, using fallback:', error.response?.data || error.message);
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
      description: extractTextFromADF(data.fields.description),
      status: data.fields.status?.name || 'Unknown',
      priority: data.fields.priority?.name || 'Medium',
      issueType: data.fields.issuetype?.name || 'Task',
      assignee: data.fields.assignee?.displayName || 'Unassigned',
      projectKey: data.fields.project?.key || 'KAN',
      updated: data.fields.updated,
      url: `${process.env.JIRA_BASE_URL?.replace(/\/$/, '')}/browse/${data.key}`,
    };
  } catch (error) {
    return mockIssues.find((issue) => issue.key === issueKey) || null;
  }
}

async function getIssueComments(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [
      { id: 'c1', author: 'Project Bot', body: 'Initial issue triage complete. Linked GitHub activity detected.', created: '2026-10-14T08:00:00Z' }
    ];
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}/comment`);
    return (data.comments || []).map((comment) => ({
      id: comment.id,
      author: comment.author?.displayName || 'User',
      body: extractTextFromADF(comment.body),
      created: comment.created,
      updated: comment.updated,
    }));
  } catch (error) {
    return [];
  }
}

/**
 * Controlled write action: Add comment to Jira issue (FR-11)
 */
async function addIssueComment(issueKey, commentText, initiatedBy = 'user') {
  if (!commentText || !commentText.trim()) {
    throw new Error('Comment text cannot be empty.');
  }

  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    // Return mock success in demo mode
    const mockComment = {
      id: `mock-${Date.now()}`,
      author: initiatedBy,
      body: commentText,
      created: new Date().toISOString(),
    };

    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'add_comment',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { comment: commentText },
        result: 'success',
        initiatedBy,
        message: `Added comment to ${issueKey} (demo mode).`,
      });
    }

    return mockComment;
  }

  try {
    const client = createJiraClient();
    const payload = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: commentText,
              },
            ],
          },
        ],
      },
    };

    const { data } = await client.post(`/issue/${issueKey}/comment`, payload);

    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'add_comment',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { commentId: data.id, text: commentText },
        result: 'success',
        initiatedBy,
        message: `Successfully added comment to ${issueKey}.`,
      });
    }

    return {
      id: data.id,
      author: data.author?.displayName || initiatedBy,
      body: extractTextFromADF(data.body),
      created: data.created,
    };
  } catch (error) {
    const errMsg = error.response?.data?.errorMessages?.[0] || error.message;
    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'add_comment',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { text: commentText },
        result: 'failed',
        initiatedBy,
        error: errMsg,
        message: `Failed to add comment to ${issueKey}.`,
      });
    }
    throw new Error(errMsg);
  }
}

/**
 * Controlled write action: Get workflow transitions (FR-11)
 */
async function getIssueTransitions(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [
      { id: '11', name: 'To Do', to: { name: 'To Do' } },
      { id: '21', name: 'In Progress', to: { name: 'In Progress' } },
      { id: '31', name: 'Done', to: { name: 'Done' } },
    ];
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}/transitions`);
    return (data.transitions || []).map((t) => ({
      id: t.id,
      name: t.name,
      to: {
        id: t.to?.id,
        name: t.to?.name,
        category: t.to?.statusCategory?.name,
      },
    }));
  } catch (error) {
    console.warn(`getIssueTransitions error for ${issueKey}:`, error.message);
    return [
      { id: '11', name: 'To Do', to: { name: 'To Do' } },
      { id: '21', name: 'In Progress', to: { name: 'In Progress' } },
      { id: '31', name: 'Done', to: { name: 'Done' } },
    ];
  }
}

/**
 * Controlled write action: Execute workflow transition on Jira issue (FR-11)
 */
async function transitionIssue(issueKey, transitionId, comment = '', initiatedBy = 'user') {
  if (!transitionId) {
    throw new Error('transitionId is required.');
  }

  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'transition_issue',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { transitionId, comment },
        result: 'success',
        initiatedBy,
        message: `Transitioned ${issueKey} to transition ID ${transitionId} (demo mode).`,
      });
    }
    return { status: 'success', message: `Transition ${transitionId} applied (demo mode).` };
  }

  try {
    const client = createJiraClient();
    const payload = {
      transition: { id: String(transitionId) },
    };

    if (comment && comment.trim()) {
      payload.update = {
        comment: [
          {
            add: {
              body: {
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text: comment }] }],
              },
            },
          },
        ],
      };
    }

    await client.post(`/issue/${issueKey}/transitions`, payload);

    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'transition_issue',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { transitionId, comment },
        result: 'success',
        initiatedBy,
        message: `Successfully executed workflow transition ${transitionId} on ${issueKey}.`,
      });
    }

    return { status: 'success', message: `Transition ${transitionId} applied successfully to ${issueKey}.` };
  } catch (error) {
    const errMsg = error.response?.data?.errorMessages?.[0] || error.message;
    if (global.isMongoConnected) {
      await ActionAuditLog.create({
        actionType: 'transition_issue',
        targetSystem: 'jira',
        targetEntity: issueKey,
        payload: { transitionId },
        result: 'failed',
        initiatedBy,
        error: errMsg,
        message: `Failed to transition ${issueKey}.`,
      });
    }
    throw new Error(errMsg);
  }
}

async function getIssueChangelog(issueKey) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [
      { created: '2026-10-14T08:00:00.000Z', author: { displayName: 'Lead Engineer' }, items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] }
    ];
  }

  try {
    const client = createJiraClient();
    const { data } = await client.get(`/issue/${issueKey}/changelog`);
    return data.values || [];
  } catch (error) {
    return [];
  }
}

async function getAgileBoards() {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [{ id: 1, name: 'KAN Board', type: 'kanban' }];
  }

  try {
    const client = createAgileClient();
    const { data } = await client.get('/board');
    return data.values || [];
  } catch (error) {
    return [{ id: 1, name: 'KAN Board', type: 'kanban' }];
  }
}

async function getBoardSprints(boardId) {
  if (!process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    return [{ id: 1, name: 'Sprint 1', state: 'active', startDate: '2026-10-01', endDate: '2026-10-20' }];
  }

  try {
    const client = createAgileClient();
    const { data } = await client.get(`/board/${boardId}/sprint`);
    return data.values || [];
  } catch (error) {
    return [{ id: 1, name: 'Sprint 1', state: 'active', startDate: '2026-10-01', endDate: '2026-10-20' }];
  }
}

module.exports = {
  verifyConnection,
  getProjects,
  searchIssues,
  getIssue,
  getIssueComments,
  addIssueComment,
  getIssueTransitions,
  transitionIssue,
  getIssueChangelog,
  getAgileBoards,
  getBoardSprints,
};
