const express = require('express');
const githubService = require('../services/githubService');
const jiraService = require('../services/jiraService');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const githubUser = await githubService.getAuthenticatedUser();
    const jiraProjects = await jiraService.getProjects();
    const githubConfigured = Boolean(process.env.GITHUB_TOKEN);
    const jiraConfigured = Boolean(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);

    res.json({
      githubConfigured,
      jiraConfigured,
      githubUser: githubUser.login || 'demo-github-user',
      jiraProjectCount: jiraProjects.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to check integration status.', error: error.message });
  }
});

module.exports = router;
