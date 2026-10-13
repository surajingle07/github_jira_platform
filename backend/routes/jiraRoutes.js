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
    const issues = await jiraService.searchIssues();
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

router.get('/issues/:issueKey/changelog', async (req, res) => {
  try {
    const changes = await jiraService.getIssueChangelog(req.params.issueKey);
    res.json(changes);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch changelog.', error: error.message });
  }
});

module.exports = router;
