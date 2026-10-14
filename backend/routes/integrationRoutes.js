const express = require('express');
const githubService = require('../services/githubService');
const jiraService = require('../services/jiraService');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const [githubHealth, jiraHealth] = await Promise.all([
      githubService.verifyConnection(),
      jiraService.verifyConnection(),
    ]);

    const databaseConnected = Boolean(global.isMongoConnected);

    res.json({
      status: githubHealth.connected && jiraHealth.connected ? 'healthy' : 'degraded',
      database: {
        connected: databaseConnected,
        status: databaseConnected ? 'connected' : 'disconnected',
      },
      github: {
        configured: Boolean(process.env.GITHUB_TOKEN),
        connected: githubHealth.connected,
        mode: githubHealth.mode,
        user: githubHealth.user?.login || 'demo-github-user',
        scopes: githubHealth.scopes,
        rateLimit: githubHealth.rateLimit,
        latencyMs: githubHealth.latencyMs,
        message: githubHealth.message,
      },
      jira: {
        configured: Boolean(process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN),
        connected: jiraHealth.connected,
        mode: jiraHealth.mode,
        siteUrl: jiraHealth.siteUrl || process.env.JIRA_BASE_URL,
        user: jiraHealth.user?.displayName || 'Demo Jira User',
        projectCount: jiraHealth.projectCount || 0,
        latencyMs: jiraHealth.latencyMs,
        message: jiraHealth.message,
      },
      lastChecked: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to check integration status.', error: error.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const [githubHealth, jiraHealth] = await Promise.all([
      githubService.verifyConnection(),
      jiraService.verifyConnection(),
    ]);

    res.json({
      status: 'verified',
      timestamp: new Date().toISOString(),
      github: githubHealth,
      jira: jiraHealth,
    });
  } catch (error) {
    res.status(500).json({ message: 'Verification failed.', error: error.message });
  }
});

module.exports = router;
