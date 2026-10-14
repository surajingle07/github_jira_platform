const express = require('express');
const jiraService = require('../services/jiraService');

const router = express.Router();

router.get('/projects', async (req, res) => {
  try {
    const projects = await jiraService.getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch Jira projects.', error: error.message });
  }
});

router.get('/issues', async (req, res) => {
  try {
    const { jql } = req.query;
    const issues = await jiraService.searchIssues(jql);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch Jira issues.', error: error.message });
  }
});

router.get('/issues/:issueKey', async (req, res) => {
  try {
    const issue = await jiraService.getIssue(req.params.issueKey);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found.' });
    }
    res.json(issue);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch issue details.', error: error.message });
  }
});

router.get('/issues/:issueKey/comments', async (req, res) => {
  try {
    const comments = await jiraService.getIssueComments(req.params.issueKey);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch comments.', error: error.message });
  }
});

// Controlled write action: Add comment (FR-11)
router.post('/issues/:issueKey/comment', async (req, res) => {
  try {
    const { comment, author } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: 'Comment content is required.' });
    }
    const result = await jiraService.addIssueComment(req.params.issueKey, comment, author || 'User');
    res.status(201).json({ message: 'Comment added successfully.', comment: result });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add comment.', error: error.message });
  }
});

// Controlled write action: Discover permitted workflow transitions (FR-11)
router.get('/issues/:issueKey/transitions', async (req, res) => {
  try {
    const transitions = await jiraService.getIssueTransitions(req.params.issueKey);
    res.json(transitions);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch transitions.', error: error.message });
  }
});

// Controlled write action: Execute workflow transition (FR-11)
router.post('/issues/:issueKey/transitions', async (req, res) => {
  try {
    const { transitionId, comment, initiatedBy } = req.body;
    if (!transitionId) {
      return res.status(400).json({ message: 'transitionId is required.' });
    }
    const result = await jiraService.transitionIssue(req.params.issueKey, transitionId, comment, initiatedBy || 'User');
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to execute transition.', error: error.message });
  }
});

router.get('/issues/:issueKey/changelog', async (req, res) => {
  try {
    const changes = await jiraService.getIssueChangelog(req.params.issueKey);
    res.json(changes);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch changelog.', error: error.message });
  }
});

router.get('/boards', async (req, res) => {
  try {
    const boards = await jiraService.getAgileBoards();
    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch boards.', error: error.message });
  }
});

router.get('/boards/:boardId/sprints', async (req, res) => {
  try {
    const sprints = await jiraService.getBoardSprints(req.params.boardId);
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch sprints.', error: error.message });
  }
});

module.exports = router;
